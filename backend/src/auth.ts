import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PoolClient, QueryResultRow } from 'pg';
import { pool, queryOne } from './db.ts';

const scrypt = promisify(scryptCallback);
const passwordKeyLength = 64;
const verificationTokenHours = 24;
const sessionDays = 30;

type DbClient = PoolClient;

type StatusError = Error & { statusCode: number };

type UserRow = QueryResultRow & {
  id: number;
  email: string;
  display_name: string;
  email_verified_at: string | null;
};

type LoginUserRow = UserRow & {
  password_hash: string;
};

export type AuthUser = {
  id: number;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

function statusError(message: string, statusCode: number): StatusError {
  const error = new Error(message) as StatusError;
  error.statusCode = statusCode;
  return error;
}

function cleanEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw statusError('请输入邮箱', 400);
  }

  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw statusError('邮箱格式不正确', 400);
  }

  return email;
}

function cleanDisplayName(value: unknown): string {
  if (typeof value !== 'string') {
    throw statusError('请输入显示名', 400);
  }

  const displayName = value.trim();
  if (displayName.length < 1 || displayName.length > 40) {
    throw statusError('显示名长度需为 1 到 40 个字符', 400);
  }

  return displayName;
}

function cleanPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8) {
    throw statusError('密码至少需要 8 个字符', 400);
  }

  return value;
}

function cleanToken(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 32) {
    throw statusError('验证链接无效或已过期', 400);
  }

  return value.trim();
}

function toPublicUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    emailVerified: user.email_verified_at !== null
  };
}

async function clientQueryOne<T extends QueryResultRow>(
  client: DbClient,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const result = await client.query<T>(sql, params);
  return result.rows[0] ?? null;
}

async function withTransaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const key = (await scrypt(password, salt, passwordKeyLength)) as Buffer;
  return `scrypt$${salt}$${key.toString('base64url')}`;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, salt, storedKey] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !storedKey) {
    return false;
  }

  const storedBuffer = Buffer.from(storedKey, 'base64url');
  const key = (await scrypt(password, salt, storedBuffer.length)) as Buffer;
  return key.length === storedBuffer.length && timingSafeEqual(key, storedBuffer);
}

function createPlainToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('Email service is not configured');
  }

  return { apiKey, from };
}

function buildVerificationUrl(token: string): string {
  const origin = process.env.APP_ORIGIN ?? process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  const url = new URL('/verify-email', origin);
  url.searchParams.set('token', token);
  return url.toString();
}

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  const verificationUrl = buildVerificationUrl(token);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: '验证你的 Pokopia Wiki 邮箱',
      html: `<p>请点击下面的链接完成邮箱验证：</p><p><a href="${verificationUrl}">验证邮箱</a></p><p>链接将在 ${verificationTokenHours} 小时后失效。</p>`,
      text: `请打开以下链接完成 Pokopia Wiki 邮箱验证：${verificationUrl}\n链接将在 ${verificationTokenHours} 小时后失效。`
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${responseText.slice(0, 500)}`);
  }
}

export async function registerUser(payload: Record<string, unknown>) {
  const email = cleanEmail(payload.email);
  const displayName = cleanDisplayName(payload.displayName);
  const password = cleanPassword(payload.password);
  const passwordHash = await hashPassword(password);
  const verificationToken = createPlainToken();
  const verificationTokenHash = hashToken(verificationToken);

  await withTransaction(async (client) => {
    const existingUser = await clientQueryOne<UserRow>(
      client,
      'SELECT id, email, display_name, email_verified_at FROM users WHERE email = $1',
      [email]
    );

    if (existingUser?.email_verified_at) {
      throw statusError('该邮箱已注册', 409);
    }

    const user = existingUser
      ? await clientQueryOne<UserRow>(
          client,
          `
            UPDATE users
            SET display_name = $1, password_hash = $2, updated_at = now()
            WHERE id = $3
            RETURNING id, email, display_name, email_verified_at
          `,
          [displayName, passwordHash, existingUser.id]
        )
      : await clientQueryOne<UserRow>(
          client,
          `
            INSERT INTO users (email, display_name, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, email, display_name, email_verified_at
          `,
          [email, displayName, passwordHash]
        );

    if (!user) {
      throw new Error('Failed to save user');
    }

    await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL', [user.id]);
    await client.query(
      `
        INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, now() + ($3 * interval '1 hour'))
      `,
      [user.id, verificationTokenHash, verificationTokenHours]
    );
  });

  await sendVerificationEmail(email, verificationToken);
  return { message: '请查收验证邮件' };
}

export async function verifyEmail(payload: Record<string, unknown>) {
  const token = cleanToken(payload.token);
  const tokenHash = hashToken(token);

  return withTransaction(async (client) => {
    const tokenRow = await clientQueryOne<{ id: number; user_id: number }>(
      client,
      `
        SELECT id, user_id
        FROM email_verification_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        FOR UPDATE
      `,
      [tokenHash]
    );

    if (!tokenRow) {
      throw statusError('验证链接无效或已过期', 400);
    }

    const user = await clientQueryOne<UserRow>(
      client,
      `
        UPDATE users
        SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
        WHERE id = $1
        RETURNING id, email, display_name, email_verified_at
      `,
      [tokenRow.user_id]
    );

    if (!user) {
      throw statusError('验证链接无效或已过期', 400);
    }

    await client.query('UPDATE email_verification_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [
      user.id
    ]);

    return { message: '邮箱已验证', user: toPublicUser(user) };
  });
}

export async function loginUser(payload: Record<string, unknown>) {
  const email = cleanEmail(payload.email);
  const password = cleanPassword(payload.password);
  const user = await queryOne<LoginUserRow>(
    'SELECT id, email, display_name, email_verified_at, password_hash FROM users WHERE email = $1',
    [email]
  );

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw statusError('邮箱或密码不正确', 401);
  }

  if (!user.email_verified_at) {
    throw statusError('请先完成邮箱验证', 403);
  }

  const sessionToken = createPlainToken();
  await pool.query(
    `
      INSERT INTO user_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, now() + ($3 * interval '1 day'))
    `,
    [user.id, hashToken(sessionToken), sessionDays]
  );

  return { token: sessionToken, user: toPublicUser(user) };
}

export async function getUserBySessionToken(token: string): Promise<AuthUser | null> {
  if (token.length < 32) {
    return null;
  }

  const user = await queryOne<UserRow>(
    `
      SELECT u.id, u.email, u.display_name, u.email_verified_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
    `,
    [hashToken(token)]
  );

  return user ? toPublicUser(user) : null;
}

export async function logoutSession(token: string): Promise<void> {
  if (token.length < 32) {
    return;
  }

  await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
}
