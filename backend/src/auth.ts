import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PoolClient, QueryResultRow } from 'pg';
import { pool, query, queryOne } from './db.ts';
import { systemMessage } from './systemWordingQueries.ts';

const scrypt = promisify(scryptCallback);
const passwordKeyLength = 64;
const verificationTokenHours = 24;
const passwordResetTokenHours = 1;
const rememberedSessionDays = 30;
const sessionOnlySessionDays = 1;
const defaultLocale = 'en';
const referralCodeLength = 8;
const referralAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const referralCodePattern = /^[A-Z0-9]{8,16}$/;

type DbClient = PoolClient;

type StatusError = Error & { statusCode: number };

type UserRow = QueryResultRow & {
  id: number;
  email: string;
  display_name: string;
  email_verified_at: string | null;
  created_at?: string;
  updated_at?: string;
};

type LoginUserRow = UserRow & {
  password_hash: string;
};

type RegistrationUserRow = UserRow & {
  referral_code: string | null;
  referred_by_user_id: number | null;
};

type ReferralCodeRow = QueryResultRow & {
  referral_code: string | null;
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
  | 'invalidReferralCode'
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
  roles: RoleSummary[];
  permissions: string[];
};

export type ReferralSummary = {
  code: string;
  url: string;
  verifiedReferralCount: number;
};

export type RoleSummary = {
  id: number;
  key: string;
  name: string;
  level: number;
};

export type PermissionSummary = {
  id: number;
  key: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  systemPermission: boolean;
};

export type RoleDetail = RoleSummary & {
  description: string;
  enabled: boolean;
  systemRole: boolean;
  permissionIds: number[];
};

export type AdminUser = AuthUser & {
  roleIds: number[];
  createdAt: string;
  updatedAt: string;
};

type RoleRow = QueryResultRow & {
  id: number;
  key: string;
  name: string;
  description: string;
  level: number;
  enabled: boolean;
  system_role: boolean;
};

type PermissionRow = QueryResultRow & {
  id: number;
  key: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  system_permission: boolean;
};

type RolePermissionRow = QueryResultRow & {
  role_id: number;
  permission_id: number;
};

const roleKeyPattern = /^[a-z][a-z0-9-]{1,63}$/;
const permissionKeyPattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
const criticalPermissionKeys = [
  'admin.access',
  'admin.users.read',
  'admin.users.update',
  'admin.roles.read',
  'admin.roles.create',
  'admin.roles.update',
  'admin.roles.delete',
  'admin.permissions.read',
  'admin.permissions.create',
  'admin.permissions.update',
  'admin.permissions.delete'
];

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
    invalidReferralCode: 'server.auth.invalidReferralCode',
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

async function cleanReferralCode(value: unknown, locale: string): Promise<string | null> {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw statusError(await authMessage(locale, 'invalidReferralCode'), 400);
  }

  const referralCode = value.trim().toUpperCase();
  if (!referralCode) {
    return null;
  }

  if (!referralCodePattern.test(referralCode)) {
    throw statusError(await authMessage(locale, 'invalidReferralCode'), 400);
  }

  return referralCode;
}

function toPublicUser(user: UserRow, roles: RoleSummary[] = [], permissions: string[] = []): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    emailVerified: user.email_verified_at !== null,
    roles,
    permissions
  };
}

async function clientQuery<T extends QueryResultRow>(
  client: DbClient,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await client.query<T>(sql, params);
  return result.rows;
}

async function clientQueryOne<T extends QueryResultRow>(
  client: DbClient,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const result = await client.query<T>(sql, params);
  return result.rows[0] ?? null;
}

async function runQuery<T extends QueryResultRow>(
  client: DbClient | null,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return client ? clientQuery<T>(client, sql, params) : query<T>(sql, params);
}

async function runQueryOne<T extends QueryResultRow>(
  client: DbClient | null,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  return client ? clientQueryOne<T>(client, sql, params) : queryOne<T>(sql, params);
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

function createReferralCode(): string {
  const bytes = randomBytes(referralCodeLength);
  return [...bytes].map((byte) => referralAlphabet[byte % referralAlphabet.length]).join('');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === '23505';
}

async function ensureReferralCode(client: DbClient, userId: number): Promise<string> {
  const existing = await clientQueryOne<ReferralCodeRow>(client, 'SELECT referral_code FROM users WHERE id = $1', [userId]);
  if (existing?.referral_code) {
    return existing.referral_code;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const referralCode = createReferralCode();
    try {
      const updated = await clientQueryOne<ReferralCodeRow>(
        client,
        `
          UPDATE users
          SET referral_code = $1, updated_at = now()
          WHERE id = $2
            AND referral_code IS NULL
          RETURNING referral_code
        `,
        [referralCode, userId]
      );

      if (updated?.referral_code) {
        return updated.referral_code;
      }

      const current = await clientQueryOne<ReferralCodeRow>(client, 'SELECT referral_code FROM users WHERE id = $1', [
        userId
      ]);
      if (current?.referral_code) {
        return current.referral_code;
      }
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  throw new Error('Failed to assign referral code');
}

async function ensureOwnerRoleForUser(client: DbClient, userId: number): Promise<void> {
  const existingOwner = await clientQueryOne<QueryResultRow & { id: number }>(
    client,
    `
      SELECT u.id
      FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.key = 'owner'
        AND u.email_verified_at IS NOT NULL
      LIMIT 1
    `
  );

  if (existingOwner) {
    return;
  }

  const ownerRole = await clientQueryOne<QueryResultRow & { id: number }>(client, "SELECT id FROM roles WHERE key = 'owner'");
  if (!ownerRole) {
    return;
  }

  await client.query(
    `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [userId, ownerRole.id]
  );
}

function toRoleSummary(row: RoleRow): RoleSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    level: row.level
  };
}

function toPermissionSummary(row: PermissionRow): PermissionSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    enabled: row.enabled,
    systemPermission: row.system_permission
  };
}

function toRoleDetail(row: RoleRow, permissionIds: number[]): RoleDetail {
  return {
    ...toRoleSummary(row),
    description: row.description,
    enabled: row.enabled,
    systemRole: row.system_role,
    permissionIds
  };
}

async function userRoles(userId: number, client: DbClient | null = null): Promise<RoleSummary[]> {
  const rows = await runQuery<RoleRow>(
    client,
    `
      SELECT r.id, r.key, r.name, r.description, r.level, r.enabled, r.system_role
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
        AND r.enabled = true
      ORDER BY r.level DESC, r.name ASC, r.id ASC
    `,
    [userId]
  );

  return rows.map(toRoleSummary);
}

async function userPermissions(userId: number, client: DbClient | null = null): Promise<string[]> {
  const rows = await runQuery<QueryResultRow & { key: string }>(
    client,
    `
      SELECT DISTINCT p.key
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = $1
        AND r.enabled = true
        AND p.enabled = true
      ORDER BY p.key
    `,
    [userId]
  );

  return rows.map((row) => row.key);
}

async function publicUserById(userId: number, client: DbClient | null = null): Promise<AuthUser | null> {
  const user = await runQueryOne<UserRow>(
    client,
    'SELECT id, email, display_name, email_verified_at FROM users WHERE id = $1',
    [userId]
  );

  if (!user) {
    return null;
  }

  return toPublicUser(user, await userRoles(user.id, client), await userPermissions(user.id, client));
}

function hasPermission(user: AuthUser, permissionKey: string): boolean {
  return user.emailVerified && user.permissions.includes(permissionKey);
}

export function userHasPermission(user: AuthUser, permissionKey: string): boolean {
  return hasPermission(user, permissionKey);
}

export function userHasAnyPermission(user: AuthUser, permissionKeys: string[]): boolean {
  return user.emailVerified && permissionKeys.some((permissionKey) => user.permissions.includes(permissionKey));
}

function cleanKey(value: unknown, pattern: RegExp, message: string): string {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!pattern.test(key)) {
    throw statusError(message, 400);
  }
  return key;
}

function cleanText(value: unknown, options: { required?: boolean; max?: number } = {}): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (options.required && !text) {
    throw statusError('server.permissions.nameRequired', 400);
  }
  if (options.max && text.length > options.max) {
    throw statusError('server.permissions.valueTooLong', 400);
  }
  return text;
}

function cleanInteger(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    return fallback;
  }
  return numeric;
}

function cleanBoolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanIdList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw statusError('server.permissions.invalidSelection', 400);
  }

  const ids = [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  if (ids.length !== value.length) {
    throw statusError('server.permissions.invalidSelection', 400);
  }

  return ids;
}

async function assertCriticalPermissionsEnabled(client: DbClient): Promise<void> {
  const row = await clientQueryOne<QueryResultRow & { count: string }>(
    client,
    'SELECT COUNT(*)::text AS count FROM permissions WHERE key = ANY($1::text[]) AND enabled = true',
    [criticalPermissionKeys]
  );

  if (Number(row?.count ?? 0) !== criticalPermissionKeys.length) {
    throw statusError('server.permissions.criticalPermissionRequired', 400);
  }
}

async function assertOwnerExists(client: DbClient): Promise<void> {
  const row = await clientQueryOne<QueryResultRow & { count: string }>(
    client,
    `
      SELECT COUNT(DISTINCT u.id)::text AS count
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.key = 'owner'
        AND r.enabled = true
        AND u.email_verified_at IS NOT NULL
    `
  );

  if (Number(row?.count ?? 0) < 1) {
    throw statusError('server.permissions.ownerRequired', 400);
  }
}

async function assertPermissionManagerExists(client: DbClient): Promise<void> {
  const row = await clientQueryOne<QueryResultRow & { count: string }>(
    client,
    `
      SELECT COUNT(DISTINCT u.id)::text AS count
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.email_verified_at IS NOT NULL
        AND r.enabled = true
        AND p.enabled = true
        AND p.key = 'admin.permissions.update'
    `
  );

  if (Number(row?.count ?? 0) < 1) {
    throw statusError('server.permissions.permissionManagerRequired', 400);
  }
}

async function assertAccessControlSafe(client: DbClient): Promise<void> {
  await assertCriticalPermissionsEnabled(client);
  await assertOwnerExists(client);
  await assertPermissionManagerExists(client);
}

async function referralUserId(
  client: DbClient,
  referralCode: string,
  currentUserId: number | null,
  locale: string
): Promise<number> {
  const row = await clientQueryOne<QueryResultRow & { id: number }>(client, 'SELECT id FROM users WHERE referral_code = $1', [
    referralCode
  ]);

  if (!row || (currentUserId !== null && row.id === currentUserId)) {
    throw statusError(await authMessage(locale, 'invalidReferralCode'), 400);
  }

  return row.id;
}

function buildReferralUrl(code: string): string {
  const origin = process.env.APP_ORIGIN ?? process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  const url = new URL('/register', origin);
  url.searchParams.set('ref', code);
  return url.toString();
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
  const referralCode = await cleanReferralCode(payload.referralCode, locale);
  const passwordHash = await hashPassword(password);
  const verificationToken = createPlainToken();
  const verificationTokenHash = hashToken(verificationToken);

  await withTransaction(async (client) => {
    const existingUser = await clientQueryOne<RegistrationUserRow>(
      client,
      'SELECT id, email, display_name, referral_code, referred_by_user_id, email_verified_at FROM users WHERE email = $1',
      [email]
    );

    if (existingUser?.email_verified_at) {
      throw statusError(await authMessage(locale, 'emailAlreadyRegistered'), 409);
    }

    const referrerUserId = referralCode ? await referralUserId(client, referralCode, existingUser?.id ?? null, locale) : null;
    const user = existingUser
      ? await clientQueryOne<RegistrationUserRow>(
          client,
          `
            UPDATE users
            SET display_name = $1, password_hash = $2, updated_at = now()
            WHERE id = $3
            RETURNING id, email, display_name, referral_code, referred_by_user_id, email_verified_at
          `,
          [displayName, passwordHash, existingUser.id]
        )
      : await clientQueryOne<RegistrationUserRow>(
          client,
          `
            INSERT INTO users (email, display_name, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, email, display_name, referral_code, referred_by_user_id, email_verified_at
          `,
          [email, displayName, passwordHash]
        );

    if (!user) {
      throw new Error('Failed to save user');
    }

    await ensureReferralCode(client, user.id);
    if (referrerUserId && user.referred_by_user_id === null) {
      await client.query('UPDATE users SET referred_by_user_id = $1, updated_at = now() WHERE id = $2', [
        referrerUserId,
        user.id
      ]);
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
    await ensureOwnerRoleForUser(client, user.id);

    const publicUser = await publicUserById(user.id, client);
    return { message: await authMessage(locale, 'emailVerified'), user: publicUser ?? toPublicUser(user) };
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

  return { token: sessionToken, user: (await publicUserById(user.id)) ?? toPublicUser(user) };
}

export async function getUserBySessionToken(token: string): Promise<AuthUser | null> {
  if (token.length < 32) {
    return null;
  }

  const session = await queryOne<QueryResultRow & { user_id: number }>(
    `
      SELECT s.user_id
      FROM user_sessions s
      WHERE s.token_hash = $1
        AND s.expires_at > now()
    `,
    [hashToken(token)]
  );

  return session ? publicUserById(session.user_id) : null;
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

  return (await publicUserById(user.id)) ?? toPublicUser(user);
}

export async function getReferralSummary(userId: number): Promise<ReferralSummary> {
  return withTransaction(async (client) => {
    const code = await ensureReferralCode(client, userId);
    const countRow = await clientQueryOne<QueryResultRow & { count: string }>(
      client,
      'SELECT COUNT(*)::text AS count FROM users WHERE referred_by_user_id = $1 AND email_verified_at IS NOT NULL',
      [userId]
    );

    return {
      code,
      url: buildReferralUrl(code),
      verifiedReferralCount: Number(countRow?.count ?? 0)
    };
  });
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const rows = await query<UserRow & { created_at: string; updated_at: string }>(
    `
      SELECT id, email, display_name, email_verified_at, created_at, updated_at
      FROM users
      ORDER BY created_at DESC, id DESC
    `
  );

  const roleRows = await query<QueryResultRow & { user_id: number; role_id: number }>(
    `
      SELECT ur.user_id, ur.role_id
      FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      ORDER BY ur.user_id, ur.role_id
    `
  );
  const rolesByUserId = new Map<number, number[]>();
  for (const roleRow of roleRows) {
    rolesByUserId.set(roleRow.user_id, [...(rolesByUserId.get(roleRow.user_id) ?? []), roleRow.role_id]);
  }

  return Promise.all(
    rows.map(async (row) => {
      const publicUser = (await publicUserById(row.id)) ?? toPublicUser(row);
      return {
        ...publicUser,
        roleIds: rolesByUserId.get(row.id) ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    })
  );
}

export async function listPermissions(): Promise<PermissionSummary[]> {
  const rows = await query<PermissionRow>(
    `
      SELECT id, key, name, description, category, enabled, system_permission
      FROM permissions
      ORDER BY category ASC, key ASC, id ASC
    `
  );

  return rows.map(toPermissionSummary);
}

export async function createPermission(payload: Record<string, unknown>): Promise<PermissionSummary[]> {
  const permissionKey = cleanKey(payload.key, permissionKeyPattern, 'server.permissions.permissionKeyInvalid');
  const name = cleanText(payload.name, { required: true, max: 120 });
  const description = cleanText(payload.description, { max: 500 });
  const category = cleanText(payload.category, { required: true, max: 80 });

  await withTransaction(async (client) => {
    const permission = await clientQueryOne<PermissionRow>(
      client,
      `
        INSERT INTO permissions (key, name, description, category, enabled)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, key, name, description, category, enabled, system_permission
      `,
      [permissionKey, name, description, category, cleanBoolean(payload.enabled)]
    );

    if (!permission) {
      throw new Error('Failed to create permission');
    }

    await client.query(
      `
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, $1
        FROM roles r
        WHERE r.key = 'owner'
        ON CONFLICT DO NOTHING
      `,
      [permission.id]
    );
  });

  return listPermissions();
}

export async function updatePermission(id: number, payload: Record<string, unknown>): Promise<PermissionSummary[]> {
  const name = cleanText(payload.name, { required: true, max: 120 });
  const description = cleanText(payload.description, { max: 500 });
  const category = cleanText(payload.category, { required: true, max: 80 });
  const enabled = cleanBoolean(payload.enabled);

  await withTransaction(async (client) => {
    const permission = await clientQueryOne<PermissionRow>(
      client,
      'SELECT id, key, name, description, category, enabled, system_permission FROM permissions WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!permission) {
      throw statusError('server.permissions.permissionNotFound', 404);
    }
    if (!enabled && criticalPermissionKeys.includes(permission.key)) {
      throw statusError('server.permissions.criticalPermissionRequired', 400);
    }

    await client.query(
      `
        UPDATE permissions
        SET name = $1,
            description = $2,
            category = $3,
            enabled = $4,
            updated_at = now()
        WHERE id = $5
      `,
      [name, description, category, enabled, id]
    );
    await assertAccessControlSafe(client);
  });

  return listPermissions();
}

export async function deletePermission(id: number): Promise<void> {
  await withTransaction(async (client) => {
    const permission = await clientQueryOne<PermissionRow>(
      client,
      'SELECT id, key, name, description, category, enabled, system_permission FROM permissions WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!permission) {
      throw statusError('server.permissions.permissionNotFound', 404);
    }
    if (criticalPermissionKeys.includes(permission.key)) {
      throw statusError('server.permissions.criticalPermissionRequired', 400);
    }

    await client.query('DELETE FROM permissions WHERE id = $1', [id]);
    await assertAccessControlSafe(client);
  });
}

export async function listRoles(): Promise<RoleDetail[]> {
  const rows = await query<RoleRow>(
    `
      SELECT id, key, name, description, level, enabled, system_role
      FROM roles
      ORDER BY level DESC, name ASC, id ASC
    `
  );
  const permissionRows = await query<RolePermissionRow>(
    `
      SELECT role_id, permission_id
      FROM role_permissions
      ORDER BY role_id, permission_id
    `
  );
  const permissionIdsByRoleId = new Map<number, number[]>();
  for (const row of permissionRows) {
    permissionIdsByRoleId.set(row.role_id, [...(permissionIdsByRoleId.get(row.role_id) ?? []), row.permission_id]);
  }

  return rows.map((row) => toRoleDetail(row, permissionIdsByRoleId.get(row.id) ?? []));
}

export async function createRole(payload: Record<string, unknown>): Promise<RoleDetail[]> {
  const roleKey = cleanKey(payload.key, roleKeyPattern, 'server.permissions.roleKeyInvalid');
  const name = cleanText(payload.name, { required: true, max: 80 });
  const description = cleanText(payload.description, { max: 500 });
  const level = cleanInteger(payload.level, 0);
  const enabled = cleanBoolean(payload.enabled);

  await pool.query(
    `
      INSERT INTO roles (key, name, description, level, enabled)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [roleKey, name, description, level, enabled]
  );

  return listRoles();
}

export async function updateRole(id: number, payload: Record<string, unknown>): Promise<RoleDetail[]> {
  const name = cleanText(payload.name, { required: true, max: 80 });
  const description = cleanText(payload.description, { max: 500 });
  const level = cleanInteger(payload.level, 0);
  const enabled = cleanBoolean(payload.enabled);

  await withTransaction(async (client) => {
    const role = await clientQueryOne<RoleRow>(
      client,
      'SELECT id, key, name, description, level, enabled, system_role FROM roles WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!role) {
      throw statusError('server.permissions.roleNotFound', 404);
    }
    if (role.key === 'owner' && !enabled) {
      throw statusError('server.permissions.ownerRequired', 400);
    }

    await client.query(
      `
        UPDATE roles
        SET name = $1,
            description = $2,
            level = $3,
            enabled = $4,
            updated_at = now()
        WHERE id = $5
      `,
      [name, description, level, enabled, id]
    );
    await assertAccessControlSafe(client);
  });

  return listRoles();
}

export async function deleteRole(id: number): Promise<void> {
  await withTransaction(async (client) => {
    const role = await clientQueryOne<RoleRow>(
      client,
      'SELECT id, key, name, description, level, enabled, system_role FROM roles WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!role) {
      throw statusError('server.permissions.roleNotFound', 404);
    }
    if (role.key === 'owner') {
      throw statusError('server.permissions.ownerRequired', 400);
    }

    await client.query('DELETE FROM roles WHERE id = $1', [id]);
    await assertAccessControlSafe(client);
  });
}

export async function updateRolePermissions(roleId: number, payload: Record<string, unknown>): Promise<RoleDetail[]> {
  const permissionIds = cleanIdList(payload.permissionIds);

  await withTransaction(async (client) => {
    const role = await clientQueryOne<RoleRow>(
      client,
      'SELECT id, key, name, description, level, enabled, system_role FROM roles WHERE id = $1 FOR UPDATE',
      [roleId]
    );
    if (!role) {
      throw statusError('server.permissions.roleNotFound', 404);
    }
    if (role.key === 'owner') {
      throw statusError('server.permissions.ownerRoleLocked', 400);
    }

    if (permissionIds.length) {
      const countRow = await clientQueryOne<QueryResultRow & { count: string }>(
        client,
        'SELECT COUNT(*)::text AS count FROM permissions WHERE id = ANY($1::int[])',
        [permissionIds]
      );
      if (Number(countRow?.count ?? 0) !== permissionIds.length) {
        throw statusError('server.permissions.permissionNotFound', 404);
      }
    }

    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    if (permissionIds.length) {
      await client.query(
        `
          INSERT INTO role_permissions (role_id, permission_id)
          SELECT $1, unnest($2::int[])
          ON CONFLICT DO NOTHING
        `,
        [roleId, permissionIds]
      );
    }
    await assertAccessControlSafe(client);
  });

  return listRoles();
}

export async function updateAdminUserRoles(
  targetUserId: number,
  payload: Record<string, unknown>,
  assignedByUserId: number
): Promise<AdminUser[]> {
  const roleIds = cleanIdList(payload.roleIds);

  await withTransaction(async (client) => {
    const user = await clientQueryOne<UserRow>(client, 'SELECT id, email, display_name, email_verified_at FROM users WHERE id = $1 FOR UPDATE', [
      targetUserId
    ]);
    if (!user) {
      throw statusError('server.permissions.userNotFound', 404);
    }

    if (roleIds.length) {
      const countRow = await clientQueryOne<QueryResultRow & { count: string }>(
        client,
        'SELECT COUNT(*)::text AS count FROM roles WHERE id = ANY($1::int[])',
        [roleIds]
      );
      if (Number(countRow?.count ?? 0) !== roleIds.length) {
        throw statusError('server.permissions.roleNotFound', 404);
      }
    }

    await client.query('DELETE FROM user_roles WHERE user_id = $1', [targetUserId]);
    if (roleIds.length) {
      await client.query(
        `
          INSERT INTO user_roles (user_id, role_id, assigned_by_user_id)
          SELECT $1, unnest($2::int[]), $3
          ON CONFLICT DO NOTHING
        `,
        [targetUserId, roleIds, assignedByUserId]
      );
    }
    await assertAccessControlSafe(client);
  });

  return listAdminUsers();
}

export async function logoutSession(token: string): Promise<void> {
  if (token.length < 32) {
    return;
  }

  await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
}
