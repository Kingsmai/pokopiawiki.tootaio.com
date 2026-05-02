import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PoolClient, QueryResultRow } from 'pg';
import { pool, queryOne } from './db.ts';
import { systemMessage } from './systemWordingQueries.ts';

const scrypt = promisify(scryptCallback);
const passwordKeyLength = 64;
const verificationTokenHours = 24;
const passwordResetTokenHours = 1;
const rememberedSessionDays = 30;
const sessionOnlySessionDays = 1;
const defaultLocale = 'en';

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

type AuthMessageKey =
  | 'emailRequired'
  | 'invalidEmail'
  | 'displayNameRequired'
  | 'displayNameLength'
  | 'passwordLength'
  | 'invalidToken'
  | 'emailAlreadyRegistered'
  | 'checkVerificationEmail'
  | 'emailVerified'
  | 'checkPasswordResetEmail'
  | 'passwordResetComplete'
  | 'invalidCredentials'
  | 'verifyEmailFirst'
  | 'invalidResetToken'
  | 'emailSubject'
  | 'emailHtml'
  | 'emailText'
  | 'passwordResetSubject'
  | 'passwordResetHtml'
  | 'passwordResetText';

type AuthTokenMessageKey = 'invalidToken' | 'invalidResetToken';

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

function authMessage(locale: string, key: AuthMessageKey, params: Record<string, string | number> = {}): Promise<string> {
  const messageKeys: Record<AuthMessageKey, string> = {
    emailRequired: 'server.auth.emailRequired',
    invalidEmail: 'server.auth.invalidEmail',
    displayNameRequired: 'server.auth.displayNameRequired',
    displayNameLength: 'server.auth.displayNameLength',
    passwordLength: 'server.auth.passwordLength',
    invalidToken: 'server.auth.invalidToken',
    emailAlreadyRegistered: 'server.auth.emailAlreadyRegistered',
    checkVerificationEmail: 'server.auth.checkVerificationEmail',
    emailVerified: 'server.auth.emailVerified',
    checkPasswordResetEmail: 'server.auth.checkPasswordResetEmail',
    passwordResetComplete: 'server.auth.passwordResetComplete',
    invalidCredentials: 'server.auth.invalidCredentials',
    verifyEmailFirst: 'server.auth.verifyEmailFirst',
    invalidResetToken: 'server.auth.invalidResetToken',
    emailSubject: 'email.auth.verificationSubject',
    emailHtml: 'email.auth.verificationHtml',
    emailText: 'email.auth.verificationText',
    passwordResetSubject: 'email.auth.passwordResetSubject',
    passwordResetHtml: 'email.auth.passwordResetHtml',
    passwordResetText: 'email.auth.passwordResetText'
  };

  return systemMessage(locale || defaultLocale, messageKeys[key], params);
}

async function cleanEmail(value: unknown, locale: string): Promise<string> {
  if (typeof value !== 'string') {
    throw statusError(await authMessage(locale, 'emailRequired'), 400);
  }

  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw statusError(await authMessage(locale, 'invalidEmail'), 400);
  }

  return email;
}

async function cleanDisplayName(value: unknown, locale: string): Promise<string> {
  if (typeof value !== 'string') {
    throw statusError(await authMessage(locale, 'displayNameRequired'), 400);
  }

  const displayName = value.trim();
  if (displayName.length < 1 || displayName.length > 40) {
    throw statusError(await authMessage(locale, 'displayNameLength'), 400);
  }

  return displayName;
}

async function cleanPassword(value: unknown, locale: string): Promise<string> {
  if (typeof value !== 'string' || value.length < 8) {
    throw statusError(await authMessage(locale, 'passwordLength'), 400);
  }

  return value;
}

async function cleanToken(
  value: unknown,
  locale: string,
  messageKey: AuthTokenMessageKey = 'invalidToken'
): Promise<string> {
  if (typeof value !== 'string' || value.trim().length < 32) {
    throw statusError(await authMessage(locale, messageKey), 400);
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

function buildTokenUrl(pathname: string, token: string): string {
  const origin = process.env.APP_ORIGIN ?? process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  const url = new URL(pathname, origin);
  url.searchParams.set('token', token);
  return url.toString();
}

function buildVerificationUrl(token: string): string {
  return buildTokenUrl('/verify-email', token);
}

function buildPasswordResetUrl(token: string): string {
  return buildTokenUrl('/reset-password', token);
}

async function sendVerificationEmail(email: string, token: string, locale: string): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  const verificationUrl = buildVerificationUrl(token);
  const subject = await authMessage(locale, 'emailSubject');
  const html = await authMessage(locale, 'emailHtml', { url: verificationUrl, hours: verificationTokenHours });
  const text = await authMessage(locale, 'emailText', { url: verificationUrl, hours: verificationTokenHours });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      html,
      text
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${responseText.slice(0, 500)}`);
  }
}

async function sendPasswordResetEmail(email: string, token: string, locale: string): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  const resetUrl = buildPasswordResetUrl(token);
  const subject = await authMessage(locale, 'passwordResetSubject');
  const html = await authMessage(locale, 'passwordResetHtml', { url: resetUrl, hours: passwordResetTokenHours });
  const text = await authMessage(locale, 'passwordResetText', { url: resetUrl, hours: passwordResetTokenHours });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      html,
      text
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${responseText.slice(0, 500)}`);
  }
}

export async function registerUser(payload: Record<string, unknown>, locale = defaultLocale) {
  const email = await cleanEmail(payload.email, locale);
  const displayName = await cleanDisplayName(payload.displayName, locale);
  const password = await cleanPassword(payload.password, locale);
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
      throw statusError(await authMessage(locale, 'emailAlreadyRegistered'), 409);
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

  await sendVerificationEmail(email, verificationToken, locale);
  return { message: await authMessage(locale, 'checkVerificationEmail') };
}

export async function verifyEmail(payload: Record<string, unknown>, locale = defaultLocale) {
  const token = await cleanToken(payload.token, locale);
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
      throw statusError(await authMessage(locale, 'invalidToken'), 400);
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
      throw statusError(await authMessage(locale, 'invalidToken'), 400);
    }

    await client.query('UPDATE email_verification_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [
      user.id
    ]);

    return { message: await authMessage(locale, 'emailVerified'), user: toPublicUser(user) };
  });
}

export async function requestPasswordReset(payload: Record<string, unknown>, locale = defaultLocale) {
  const email = await cleanEmail(payload.email, locale);
  const user = await queryOne<UserRow>(
    'SELECT id, email, display_name, email_verified_at FROM users WHERE email = $1',
    [email]
  );

  if (user) {
    const resetToken = createPlainToken();
    const resetTokenHash = hashToken(resetToken);

    await withTransaction(async (client) => {
      await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL', [user.id]);
      await client.query(
        `
          INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
          VALUES ($1, $2, now() + ($3 * interval '1 hour'))
        `,
        [user.id, resetTokenHash, passwordResetTokenHours]
      );
    });

    try {
      await sendPasswordResetEmail(email, resetToken, locale);
    } catch (error) {
      console.error('Password reset email failed', error);
    }
  }

  return { message: await authMessage(locale, 'checkPasswordResetEmail') };
}

export async function resetPassword(payload: Record<string, unknown>, locale = defaultLocale) {
  const token = await cleanToken(payload.token, locale, 'invalidResetToken');
  const password = await cleanPassword(payload.password, locale);
  const passwordHash = await hashPassword(password);
  const tokenHash = hashToken(token);

  return withTransaction(async (client) => {
    const tokenRow = await clientQueryOne<{ id: number; user_id: number }>(
      client,
      `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        FOR UPDATE
      `,
      [tokenHash]
    );

    if (!tokenRow) {
      throw statusError(await authMessage(locale, 'invalidResetToken'), 400);
    }

    const user = await clientQueryOne<UserRow>(
      client,
      `
        UPDATE users
        SET password_hash = $1, updated_at = now()
        WHERE id = $2
        RETURNING id, email, display_name, email_verified_at
      `,
      [passwordHash, tokenRow.user_id]
    );

    if (!user) {
      throw statusError(await authMessage(locale, 'invalidResetToken'), 400);
    }

    await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [
      user.id
    ]);
    await client.query('DELETE FROM user_sessions WHERE user_id = $1', [user.id]);

    return { message: await authMessage(locale, 'passwordResetComplete') };
  });
}

export async function loginUser(payload: Record<string, unknown>, locale = defaultLocale) {
  const email = await cleanEmail(payload.email, locale);
  const password = await cleanPassword(payload.password, locale);
  const sessionDays = payload.rememberMe === true ? rememberedSessionDays : sessionOnlySessionDays;
  const user = await queryOne<LoginUserRow>(
    'SELECT id, email, display_name, email_verified_at, password_hash FROM users WHERE email = $1',
    [email]
  );

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw statusError(await authMessage(locale, 'invalidCredentials'), 401);
  }

  if (!user.email_verified_at) {
    throw statusError(await authMessage(locale, 'verifyEmailFirst'), 403);
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

export async function updateCurrentUser(
  userId: number,
  payload: Record<string, unknown>,
  locale = defaultLocale
): Promise<AuthUser> {
  const displayName = await cleanDisplayName(payload.displayName, locale);
  const user = await queryOne<UserRow>(
    `
      UPDATE users
      SET display_name = $1, updated_at = now()
      WHERE id = $2
      RETURNING id, email, display_name, email_verified_at
    `,
    [displayName, userId]
  );

  if (!user) {
    throw statusError(await systemMessage(locale || defaultLocale, 'server.errors.loginRequired'), 401);
  }

  return toPublicUser(user);
}

export async function logoutSession(token: string): Promise<void> {
  if (token.length < 32) {
    return;
  }

  await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
}
