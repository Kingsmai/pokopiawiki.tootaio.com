import cors from '@fastify/cors';
import multipart, { type MultipartFile } from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import {
  changeCurrentUserPassword,
  createPermission,
  createRole,
  deletePermission,
  deleteRole,
  getReferralSummary,
  getUserBySessionToken,
  listAdminUsers,
  listPermissions,
  listRoles,
  loginUser,
  logoutSession,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updateAdminUserRoles,
  updateCurrentUser,
  updatePermission,
  updateRole,
  updateRolePermissions,
  userHasAnyPermission,
  userHasPermission,
  verifyEmail,
  type AuthUser
} from './auth.ts';
import { initializeDatabase, pool } from './db.ts';
import {
  cleanLocale,
  createAncientArtifact,
  createConfig,
  createDailyChecklistItem,
  createDish,
  createDishCategory,
  createEntityDiscussionComment,
  createEntityDiscussionReply,
  createHabitat,
  createItem,
  createLanguage,
  createLifeComment,
  createLifeCommentReply,
  createLifePost,
  createPokemon,
  createRecipe,
  deleteConfig,
  deleteAncientArtifact,
  deleteDailyChecklistItem,
  deleteDish,
  deleteDishCategory,
  deleteEntityDiscussionComment,
  deleteHabitat,
  deleteItem,
  deleteLanguage,
  deleteEntityDiscussionCommentLike,
  deleteLifeComment,
  deleteLifeCommentLike,
  deleteLifePost,
  deleteLifePostRating,
  deleteLifePostReaction,
  deletePokemon,
  deleteRecipe,
  exportAdminData,
  fetchPokemonData,
  fetchPokemonImageOptions,
  followUser,
  getAdminDataToolsSummary,
  getAncientArtifact,
  getHabitat,
  getItem,
  listDish,
  getLifePost,
  getOptions,
  getPokemon,
  getPublicUserProfile,
  getRecipe,
  globalSearch,
  importAdminData,
  importAdminHabitatsCsv,
  importAdminItemsCsv,
  isConfigType,
  listAncientArtifacts,
  listEntityDiscussionComments,
  listConfig,
  listDailyChecklistItems,
  listHabitats,
  listFollowingLifePosts,
  listItems,
  listLifeComments,
  listLanguages,
  listLifePosts,
  listLifePostReactionUsers,
  listPokemon,
  listPokemonFetchOptions,
  listRecipes,
  listUserCommentActivities,
  listUserLifePosts,
  listUserReactionActivities,
  reorderConfig,
  reorderAncientArtifacts,
  reorderDailyChecklistItems,
  reorderDishCategories,
  reorderDishes,
  reorderHabitats,
  reorderItems,
  reorderLanguages,
  reorderRecipes,
  retryEntityDiscussionCommentModeration,
  retryLifeCommentModeration,
  retryLifePostModeration,
  restoreLifeComment,
  setLifePostRating,
  setLifePostReaction,
  setEntityDiscussionCommentLike,
  setLifeCommentLike,
  updateConfig,
  updateAncientArtifact,
  updateDailyChecklistItem,
  updateDish,
  updateDishCategory,
  updateHabitat,
  updateItem,
  updateLanguage,
  updateLifePost,
  updatePokemon,
  updateRecipe,
  unfollowUser,
  wipeAdminData
} from './queries.ts';
import {
  getAiModerationSettings,
  startAiModerationWorker,
  updateAiModerationSettings
} from './aiModeration.ts';
import {
  getSystemWordings,
  listSystemWordingRows,
  localizedStatusMessage,
  syncSystemWordingCatalog,
  systemMessage,
  updateSystemWordingValue
} from './systemWordingQueries.ts';
import {
  imageUploadMaxBytes,
  isUploadEntityType,
  saveEntityImageUpload,
  uploadRoot
} from './uploads.ts';
import {
  createNotificationWebSocketTicket,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setupNotificationWebSocketServer
} from './notifications.ts';

const app = Fastify({
  logger: true,
  trustProxy: process.env.TRUST_PROXY === 'true'
});
const sessionCookieName = 'pokopia_session';
const rememberedSessionDays = 30;
const sessionOnlySessionDays = 1;

function configuredCorsOrigin(): true | string | string[] {
  const rawOrigin = process.env.FRONTEND_ORIGIN?.trim();
  if (!rawOrigin) {
    return true;
  }

  const origins = rawOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length <= 1 ? (origins[0] ?? true) : origins;
}

await app.register(cors, {
  allowedHeaders: ['Content-Type', 'X-Locale'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  origin: configuredCorsOrigin()
});

await app.register(rateLimit, {
  global: false,
  hook: 'preHandler'
});

await mkdir(uploadRoot, { recursive: true });
await app.register(multipart, {
  limits: {
    fileSize: imageUploadMaxBytes,
    files: 1
  }
});
await app.register(fastifyStatic, {
  root: uploadRoot,
  prefix: '/uploads/',
  decorateReply: false
});

app.setErrorHandler(async (error, _request, reply) => {
  const pgError = error as Error & { code?: string; constraint?: string; detail?: string; statusCode?: number };
  const locale = requestLocale(_request);

  if (pgError.code === '23503') {
    return reply.code(409).send({ message: await serverMessage(locale, 'foreignKey') });
  }

  if (pgError.code === '23505') {
    return reply.code(409).send({ message: await serverMessage(locale, 'duplicate') });
  }

  if (pgError.code === '23502' || pgError.code === '23514') {
    return reply.code(400).send({ message: await serverMessage(locale, 'invalidField') });
  }

  if (pgError.statusCode === 429) {
    return reply.code(429).send({ message: await serverMessage(locale, 'rateLimited') });
  }

  if (pgError.statusCode === 503) {
    return reply.code(503).send({ message: await localizedStatusMessage(locale, pgError.message) });
  }

  if (pgError.statusCode && pgError.statusCode < 500) {
    return reply.code(pgError.statusCode).send({ message: await localizedStatusMessage(locale, pgError.message) });
  }

  app.log.error(error);
  return reply.code(500).send({ message: await serverMessage(locale, 'serverError') });
});

app.get('/health', async () => ({ ok: true }));

app.get('/api/search', async (request) =>
  globalSearch(request.query as Record<string, string | string[] | undefined>, requestLocale(request))
);

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const cookiePart of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookiePart.trim().split('=');
    if (rawName === name) {
      try {
        return decodeURIComponent(rawValue.join('='));
      } catch {
        return rawValue.join('=');
      }
    }
  }

  return null;
}

function getSessionToken(request: FastifyRequest): string | null {
  return getCookieValue(request.headers.cookie, sessionCookieName);
}

function sessionCookieSecure(): boolean {
  const origin = process.env.APP_ORIGIN ?? process.env.FRONTEND_ORIGIN ?? '';
  return origin.split(',').some((value) => value.trim().startsWith('https://'));
}

function sessionCookie(value: string, maxAgeSeconds: number): string {
  return [
    `${sessionCookieName}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    ...(sessionCookieSecure() ? ['Secure'] : [])
  ].join('; ');
}

function setSessionCookie(reply: FastifyReply, token: string, rememberMe: boolean): void {
  const sessionDays = rememberMe ? rememberedSessionDays : sessionOnlySessionDays;
  reply.header('Set-Cookie', sessionCookie(token, sessionDays * 24 * 60 * 60));
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.header('Set-Cookie', `${sessionCookie('', 0)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}

function requestLocale(request: FastifyRequest): string {
  const query = request.query as Record<string, string | string[] | undefined>;
  const queryLocale = Array.isArray(query.locale) ? query.locale[0] : query.locale;
  const headerLocale = request.headers['x-locale'];
  return cleanLocale(queryLocale ?? (Array.isArray(headerLocale) ? headerLocale[0] : headerLocale));
}

type ProjectUpdatesRepository = {
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  updatedAt: string | null;
};

type ProjectUpdateCommit = {
  sha: string;
  shortSha: string;
  title: string;
  message: string;
  createdAt: string;
  authorName: string;
  url: string;
};

type ProjectUpdateRelease = {
  tagName: string;
  name: string;
  publishedAt: string | null;
  url: string;
};

type ProjectCommitPage = {
  items: ProjectUpdateCommit[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ProjectUpdatesCursor = {
  page: number;
  limit: number;
};

type ProjectUpdatesResponse = {
  repository: ProjectUpdatesRepository;
  commits: ProjectCommitPage;
  releases: ProjectUpdateRelease[];
};

const projectUpdatesConfig = {
  apiBaseUrl: 'https://git.tootaio.com/api/v1',
  publicBaseUrl: 'https://git.tootaio.com',
  owner: 'Kingsmai',
  repo: 'pokopiawiki.tootaio.com',
  commitLimit: 5,
  maxCommitLimit: 20,
  releaseLimit: 3,
  timeoutMs: 5000
} as const;

function projectRepositoryPath(): string {
  return `${encodeURIComponent(projectUpdatesConfig.owner)}/${encodeURIComponent(projectUpdatesConfig.repo)}`;
}

function projectRepositoryUrl(): string {
  return `${projectUpdatesConfig.publicBaseUrl}/${projectUpdatesConfig.owner}/${projectUpdatesConfig.repo}`;
}

function projectApiUrl(path = '', params: Record<string, string | number | boolean> = {}): string {
  const apiBaseUrl = projectUpdatesConfig.apiBaseUrl.replace(/\/$/, '');
  const url = new URL(`${apiBaseUrl}/repos/${projectRepositoryPath()}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectField(record: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  if (!record) return null;
  const value = record[key];
  return isObjectRecord(value) ? value : null;
}

function stringField(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizedDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function projectCommitTitle(message: string | null, fallback: string): string {
  const [firstLine] = (message ?? '').split('\n');
  return firstLine?.trim() || fallback;
}

function projectUpdatesQueryValue(value: string | string[] | undefined): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue?.trim() || null;
}

function cleanProjectUpdatesLimit(query: Record<string, string | string[] | undefined>): number {
  const rawLimit = Number(projectUpdatesQueryValue(query.limit));
  if (!Number.isInteger(rawLimit)) {
    return projectUpdatesConfig.commitLimit;
  }

  return Math.min(Math.max(rawLimit, 1), projectUpdatesConfig.maxCommitLimit);
}

function encodeProjectUpdatesCursor(page: number, limit: number): string {
  return Buffer.from(JSON.stringify({ page, limit }), 'utf8').toString('base64url');
}

function decodeProjectUpdatesCursor(cursor: string | null): ProjectUpdatesCursor | null {
  if (!cursor) return null;

  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!isObjectRecord(payload)) {
      return null;
    }

    const { page, limit } = payload;
    if (
      typeof page === 'number' &&
      Number.isInteger(page) &&
      page > 0 &&
      typeof limit === 'number' &&
      Number.isInteger(limit) &&
      limit > 0 &&
      limit <= projectUpdatesConfig.maxCommitLimit
    ) {
      return { page, limit };
    }

    return null;
  } catch {
    return null;
  }
}

function fallbackProjectRepository(): ProjectUpdatesRepository {
  return {
    name: projectUpdatesConfig.repo,
    fullName: `${projectUpdatesConfig.owner}/${projectUpdatesConfig.repo}`,
    url: projectRepositoryUrl(),
    defaultBranch: 'main',
    updatedAt: null
  };
}

async function fetchProjectJson(path = '', params: Record<string, string | number | boolean> = {}): Promise<unknown> {
  const response = await fetch(projectApiUrl(path, params), {
    headers: {
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(projectUpdatesConfig.timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Project updates source failed (${response.status})`);
  }

  return response.json() as Promise<unknown>;
}

function mapProjectRepository(value: unknown): ProjectUpdatesRepository {
  if (!isObjectRecord(value)) {
    return fallbackProjectRepository();
  }

  return {
    name: stringField(value, 'name') ?? projectUpdatesConfig.repo,
    fullName: stringField(value, 'full_name') ?? `${projectUpdatesConfig.owner}/${projectUpdatesConfig.repo}`,
    url: projectRepositoryUrl(),
    defaultBranch: stringField(value, 'default_branch') ?? 'main',
    updatedAt: normalizedDate(stringField(value, 'updated_at'))
  };
}

function mapProjectCommit(value: unknown): ProjectUpdateCommit | null {
  if (!isObjectRecord(value)) return null;

  const sha = stringField(value, 'sha');
  if (!sha) return null;

  const commit = objectField(value, 'commit');
  const commitAuthor = objectField(commit, 'author');
  const message = stringField(commit, 'message') ?? sha.slice(0, 7);
  const fallback = sha.slice(0, 7);
  const createdAt =
    normalizedDate(stringField(value, 'created')) ??
    normalizedDate(stringField(commitAuthor, 'date')) ??
    normalizedDate(stringField(objectField(commit, 'committer'), 'date'));

  if (!createdAt) return null;

  return {
    sha,
    shortSha: sha.slice(0, 7),
    title: projectCommitTitle(message, fallback),
    message,
    createdAt,
    authorName:
      stringField(commitAuthor, 'name') ??
      stringField(objectField(value, 'author'), 'login') ??
      projectUpdatesConfig.owner,
    url: `${projectRepositoryUrl()}/commit/${sha}`
  };
}

function mapProjectRelease(value: unknown): ProjectUpdateRelease | null {
  if (!isObjectRecord(value)) return null;

  const tagName = stringField(value, 'tag_name');
  if (!tagName) return null;

  return {
    tagName,
    name: stringField(value, 'name') ?? tagName,
    publishedAt: normalizedDate(stringField(value, 'published_at')) ?? normalizedDate(stringField(value, 'created_at')),
    url: `${projectRepositoryUrl()}/releases/tag/${encodeURIComponent(tagName)}`
  };
}

function logProjectUpdatesError(source: string, error: unknown): void {
  app.log.warn({ err: error, source }, 'Project updates source unavailable');
}

async function getProjectCommitPage(query: Record<string, string | string[] | undefined>): Promise<ProjectCommitPage> {
  const cursor = decodeProjectUpdatesCursor(projectUpdatesQueryValue(query.cursor));
  const limit = cursor?.limit ?? cleanProjectUpdatesLimit(query);
  const page = cursor?.page ?? 1;
  const value = await fetchProjectJson('/commits', {
    page,
    limit: limit + 1,
    stat: false,
    files: false,
    verification: false
  });
  const commits = Array.isArray(value)
    ? value.map(mapProjectCommit).filter((commit): commit is ProjectUpdateCommit => commit !== null)
    : [];
  const hasMore = commits.length > limit;

  return {
    items: commits.slice(0, limit),
    nextCursor: hasMore ? encodeProjectUpdatesCursor(page + 1, limit) : null,
    hasMore
  };
}

async function getProjectUpdates(query: Record<string, string | string[] | undefined> = {}): Promise<ProjectUpdatesResponse> {
  const [repository, commits, releases] = await Promise.all([
    fetchProjectJson()
      .then(mapProjectRepository)
      .catch((error: unknown) => {
        logProjectUpdatesError('repository', error);
        return fallbackProjectRepository();
      }),
    getProjectCommitPage(query).catch((error: unknown) => {
      logProjectUpdatesError('commits', error);
      throw error;
    }),
    fetchProjectJson('/releases', { limit: projectUpdatesConfig.releaseLimit, draft: false, 'pre-release': false })
      .then((value) =>
        Array.isArray(value) ? value.map(mapProjectRelease).filter((release): release is ProjectUpdateRelease => release !== null) : []
      )
      .catch((error: unknown) => {
        logProjectUpdatesError('releases', error);
        return [];
      })
  ]);

  return { repository, commits, releases };
}

function serverMessage(
  locale: string,
  key:
    | 'foreignKey'
    | 'duplicate'
    | 'invalidField'
    | 'serverError'
    | 'loginRequired'
    | 'verifyEmailFirst'
    | 'permissionDenied'
    | 'notFound'
    | 'rateLimited'
): Promise<string> {
  return systemMessage(locale, `server.errors.${key}`);
}

type RateLimitCheck = ReturnType<typeof app.createRateLimit>;
type RateLimitPolicy = 'accountWrite' | 'adminWrite' | 'communityReaction' | 'communityWrite' | 'fetch' | 'upload' | 'wikiWrite';
type RateLimitPolicySettings = {
  maxRequests: number;
  timeWindowSeconds: number;
  cooldownSeconds: number;
};
type RateLimitPolicySettingsMap = Record<RateLimitPolicy, RateLimitPolicySettings>;
type RateLimitFailure = {
  max: number;
  ttlInSeconds: number;
  isBanned?: boolean;
};
type RateLimitSettingsRow = {
  settings: unknown;
  updatedAt: Date | string;
  updatedBy: { id: number; displayName: string } | null;
};
type PublicRateLimitSettings = {
  policies: RateLimitPolicySettingsMap;
  updatedAt: Date | string | null;
  updatedBy: { id: number; displayName: string } | null;
};

function hashRateLimitPart(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function routeRateLimitPart(request: FastifyRequest): string {
  return `${request.method}:${request.routeOptions.url ?? request.url.split('?')[0]}`;
}

function emailRateLimitPart(request: FastifyRequest): string {
  const body = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  return hashRateLimitPart(email || 'missing-email');
}

function ipRouteRateLimitKey(scope: string, request: FastifyRequest): string {
  return `${scope}:ip:${hashRateLimitPart(request.ip)}:route:${routeRateLimitPart(request)}`;
}

const authRouteIpRateLimit = app.createRateLimit({
  max: 20,
  timeWindow: '10 minutes',
  keyGenerator: (request) => ipRouteRateLimitKey('auth', request)
});
const loginEmailRateLimit = app.createRateLimit({
  max: 5,
  timeWindow: '15 minutes',
  keyGenerator: (request) => `auth:login:email:${emailRateLimitPart(request)}`
});
const registerEmailRateLimit = app.createRateLimit({
  max: 3,
  timeWindow: '1 hour',
  keyGenerator: (request) => `auth:register:email:${emailRateLimitPart(request)}`
});
const passwordResetEmailRateLimit = app.createRateLimit({
  max: 3,
  timeWindow: '1 hour',
  keyGenerator: (request) => `auth:password-reset:email:${emailRateLimitPart(request)}`
});
const passwordResetRouteIpRateLimit = app.createRateLimit({
  max: 10,
  timeWindow: '15 minutes',
  keyGenerator: (request) => ipRouteRateLimitKey('auth:password-reset', request)
});
const protectedRouteIpRateLimit = app.createRateLimit({
  max: 120,
  timeWindow: '10 minutes',
  keyGenerator: (request) => ipRouteRateLimitKey('protected', request)
});

const rateLimitPolicyKeys: RateLimitPolicy[] = [
  'accountWrite',
  'adminWrite',
  'communityReaction',
  'communityWrite',
  'fetch',
  'upload',
  'wikiWrite'
];
const defaultUserRateLimitSettings: RateLimitPolicySettingsMap = {
  accountWrite: { maxRequests: 20, timeWindowSeconds: 60 * 60, cooldownSeconds: 5 },
  adminWrite: { maxRequests: 120, timeWindowSeconds: 60 * 60, cooldownSeconds: 2 },
  communityReaction: { maxRequests: 120, timeWindowSeconds: 60 * 60, cooldownSeconds: 1 },
  communityWrite: { maxRequests: 60, timeWindowSeconds: 60 * 60, cooldownSeconds: 5 },
  fetch: { maxRequests: 60, timeWindowSeconds: 10 * 60, cooldownSeconds: 1 },
  upload: { maxRequests: 20, timeWindowSeconds: 60 * 60, cooldownSeconds: 30 },
  wikiWrite: { maxRequests: 120, timeWindowSeconds: 60 * 60, cooldownSeconds: 2 }
};
const rateLimitSettingsCacheTtlMs = 30_000;
const minRateLimitWindowSeconds = 60;
const maxRateLimitWindowSeconds = 24 * 60 * 60;
const maxRateLimitRequests = 5_000;
const maxRateLimitCooldownSeconds = 60 * 60;
let rateLimitSettingsCache: { settings: RateLimitPolicySettingsMap; expiresAt: number } | null = null;
let lastRateLimitSweepAt = 0;
const userRateLimitWindows = new Map<string, { count: number; resetAt: number }>();
const userRateLimitCooldowns = new Map<string, number>();

function cloneRateLimitSettings(settings: RateLimitPolicySettingsMap): RateLimitPolicySettingsMap {
  return Object.fromEntries(
    rateLimitPolicyKeys.map((policy) => [policy, { ...settings[policy] }])
  ) as RateLimitPolicySettingsMap;
}

function cleanRateLimitInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    return fallback;
  }

  return numeric;
}

function cleanRateLimitPolicySettings(value: unknown, fallback: RateLimitPolicySettings): RateLimitPolicySettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    maxRequests: cleanRateLimitInteger(raw.maxRequests, fallback.maxRequests, 1, maxRateLimitRequests),
    timeWindowSeconds: cleanRateLimitInteger(
      raw.timeWindowSeconds,
      fallback.timeWindowSeconds,
      minRateLimitWindowSeconds,
      maxRateLimitWindowSeconds
    ),
    cooldownSeconds: cleanRateLimitInteger(raw.cooldownSeconds, fallback.cooldownSeconds, 0, maxRateLimitCooldownSeconds)
  };
}

function normalizeRateLimitSettings(value: unknown): RateLimitPolicySettingsMap {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    rateLimitPolicyKeys.map((policy) => [
      policy,
      cleanRateLimitPolicySettings(raw[policy], defaultUserRateLimitSettings[policy])
    ])
  ) as RateLimitPolicySettingsMap;
}

function publicRateLimitSettings(row: RateLimitSettingsRow | null, settings: RateLimitPolicySettingsMap): PublicRateLimitSettings {
  return {
    policies: cloneRateLimitSettings(settings),
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null
  };
}

async function rateLimitSettingsRow(): Promise<RateLimitSettingsRow | null> {
  const result = await pool.query<RateLimitSettingsRow>(
    `
      SELECT
        s.settings,
        s.updated_at AS "updatedAt",
        CASE
          WHEN updated_user.id IS NULL THEN NULL
          ELSE json_build_object('id', updated_user.id, 'displayName', updated_user.display_name)
        END AS "updatedBy"
      FROM rate_limit_settings s
      LEFT JOIN users updated_user ON updated_user.id = s.updated_by_user_id
      WHERE s.id = true
    `
  );

  return result.rows[0] ?? null;
}

async function runtimeRateLimitSettings(): Promise<RateLimitPolicySettingsMap> {
  const now = Date.now();
  if (rateLimitSettingsCache && rateLimitSettingsCache.expiresAt > now) {
    return rateLimitSettingsCache.settings;
  }

  const row = await rateLimitSettingsRow();
  const settings = normalizeRateLimitSettings(row?.settings);
  rateLimitSettingsCache = { settings, expiresAt: now + rateLimitSettingsCacheTtlMs };
  return settings;
}

async function getRateLimitSettings(): Promise<PublicRateLimitSettings> {
  const row = await rateLimitSettingsRow();
  return publicRateLimitSettings(row, normalizeRateLimitSettings(row?.settings));
}

async function updateRateLimitSettings(payload: Record<string, unknown>, userId: number): Promise<PublicRateLimitSettings> {
  const policies = payload.policies && typeof payload.policies === 'object' ? payload.policies : payload;
  const settings = normalizeRateLimitSettings(policies);
  await pool.query(
    `
      INSERT INTO rate_limit_settings (id, settings, updated_by_user_id, updated_at)
      VALUES (true, $1::jsonb, $2, now())
      ON CONFLICT (id)
      DO UPDATE SET settings = EXCLUDED.settings,
                    updated_by_user_id = EXCLUDED.updated_by_user_id,
                    updated_at = now()
    `,
    [JSON.stringify(settings), userId]
  );
  rateLimitSettingsCache = { settings, expiresAt: Date.now() + rateLimitSettingsCacheTtlMs };
  return getRateLimitSettings();
}

function sweepUserRateLimitEntries(now: number): void {
  if (now - lastRateLimitSweepAt < 60_000) {
    return;
  }

  lastRateLimitSweepAt = now;
  for (const [key, bucket] of userRateLimitWindows.entries()) {
    if (bucket.resetAt <= now) {
      userRateLimitWindows.delete(key);
    }
  }
  for (const [key, resetAt] of userRateLimitCooldowns.entries()) {
    if (resetAt <= now) {
      userRateLimitCooldowns.delete(key);
    }
  }
}

function checkUserPolicyRateLimit(userId: number, policy: RateLimitPolicy, settings: RateLimitPolicySettings): RateLimitFailure | null {
  const now = Date.now();
  sweepUserRateLimitEntries(now);

  const cooldownKey = `${policy}:user:${userId}:cooldown`;
  const cooldownResetAt = userRateLimitCooldowns.get(cooldownKey) ?? 0;
  if (cooldownResetAt > now) {
    return { max: 1, ttlInSeconds: Math.ceil((cooldownResetAt - now) / 1000) };
  }

  const windowKey = `${policy}:user:${userId}:window`;
  const windowResetMs = settings.timeWindowSeconds * 1000;
  const existingBucket = userRateLimitWindows.get(windowKey);
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : { count: 0, resetAt: now + windowResetMs };

  if (bucket.count >= settings.maxRequests) {
    userRateLimitWindows.set(windowKey, bucket);
    return { max: settings.maxRequests, ttlInSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  userRateLimitWindows.set(windowKey, bucket);

  if (settings.cooldownSeconds > 0) {
    userRateLimitCooldowns.set(cooldownKey, now + settings.cooldownSeconds * 1000);
  }

  return null;
}

async function sendRateLimited(
  request: FastifyRequest,
  reply: FastifyReply,
  result: RateLimitFailure
): Promise<false> {
  const retryAfter = Math.max(1, result.ttlInSeconds);
  reply.header('retry-after', retryAfter);
  reply.header('x-ratelimit-limit', result.max);
  reply.header('x-ratelimit-remaining', 0);
  reply.header('x-ratelimit-reset', retryAfter);
  reply.code(result.isBanned === true ? 403 : 429).send({ message: await serverMessage(requestLocale(request), 'rateLimited') });
  return false;
}

async function enforceRateLimits(
  request: FastifyRequest,
  reply: FastifyReply,
  checks: RateLimitCheck[]
): Promise<boolean> {
  for (const check of checks) {
    const result = await check(request);
    if (!result.isAllowed && result.isExceeded) {
      return sendRateLimited(request, reply, result);
    }
  }

  return true;
}

async function enforceAuthRateLimits(
  request: FastifyRequest,
  reply: FastifyReply,
  checks: RateLimitCheck[]
): Promise<boolean> {
  return enforceRateLimits(request, reply, [authRouteIpRateLimit, ...checks]);
}

async function enforceUserRateLimits(
  request: FastifyRequest,
  reply: FastifyReply,
  user: AuthUser,
  policy: RateLimitPolicy
): Promise<boolean> {
  const settings = (await runtimeRateLimitSettings())[policy];
  const result = checkUserPolicyRateLimit(user.id, policy, settings);
  return result ? sendRateLimited(request, reply, result) : true;
}

function badRequest(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}

async function notFound(reply: FastifyReply, request: FastifyRequest) {
  return reply.code(404).send({ message: await serverMessage(requestLocale(request), 'notFound') });
}

async function requireVerifiedUser(request: FastifyRequest, reply: FastifyReply): Promise<AuthUser | null> {
  if (!(await enforceRateLimits(request, reply, [protectedRouteIpRateLimit]))) {
    return null;
  }

  const token = getSessionToken(request);
  const user = token ? await getUserBySessionToken(token) : null;
  const locale = requestLocale(request);

  if (!user) {
    reply.code(401).send({ message: await serverMessage(locale, 'loginRequired') });
    return null;
  }

  if (!user.emailVerified) {
    reply.code(403).send({ message: await serverMessage(locale, 'verifyEmailFirst') });
    return null;
  }

  return user;
}

async function requirePermission(
  request: FastifyRequest,
  reply: FastifyReply,
  permissionKey: string
): Promise<AuthUser | null> {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return null;
  }

  if (!userHasPermission(user, permissionKey)) {
    reply.code(403).send({ message: await serverMessage(requestLocale(request), 'permissionDenied') });
    return null;
  }

  return user;
}

async function requireAnyPermission(
  request: FastifyRequest,
  reply: FastifyReply,
  permissionKeys: string[]
): Promise<AuthUser | null> {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return null;
  }

  if (!userHasAnyPermission(user, permissionKeys)) {
    reply.code(403).send({ message: await serverMessage(requestLocale(request), 'permissionDenied') });
    return null;
  }

  return user;
}

async function requirePermissionWithRateLimits(
  request: FastifyRequest,
  reply: FastifyReply,
  permissionKey: string,
  policy: RateLimitPolicy
): Promise<AuthUser | null> {
  const user = await requirePermission(request, reply, permissionKey);
  if (!user || !(await enforceUserRateLimits(request, reply, user, policy))) {
    return null;
  }

  return user;
}

async function requireAnyPermissionWithRateLimits(
  request: FastifyRequest,
  reply: FastifyReply,
  permissionKeys: string[],
  policy: RateLimitPolicy
): Promise<AuthUser | null> {
  const user = await requireAnyPermission(request, reply, permissionKeys);
  if (!user || !(await enforceUserRateLimits(request, reply, user, policy))) {
    return null;
  }

  return user;
}

async function optionalUser(request: FastifyRequest): Promise<AuthUser | null> {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  try {
    return await getUserBySessionToken(token);
  } catch {
    return null;
  }
}

app.post('/api/auth/register', async (request, reply) => {
  if (!(await enforceAuthRateLimits(request, reply, [registerEmailRateLimit]))) {
    return;
  }

  return reply.code(201).send(await registerUser(request.body as Record<string, unknown>, requestLocale(request)));
});

app.post('/api/auth/verify-email', async (request, reply) => {
  if (!(await enforceAuthRateLimits(request, reply, []))) {
    return;
  }

  return verifyEmail(request.body as Record<string, unknown>, requestLocale(request));
});

app.post('/api/auth/login', async (request, reply) => {
  if (!(await enforceAuthRateLimits(request, reply, [loginEmailRateLimit]))) {
    return;
  }

  const payload = request.body as Record<string, unknown>;
  const response = await loginUser(payload, requestLocale(request));
  setSessionCookie(reply, response.token, payload.rememberMe === true);
  return { user: response.user };
});

app.post('/api/auth/request-password-reset', async (request, reply) => {
  if (!(await enforceAuthRateLimits(request, reply, [passwordResetEmailRateLimit, passwordResetRouteIpRateLimit]))) {
    return;
  }

  return requestPasswordReset(request.body as Record<string, unknown>, requestLocale(request));
});

app.post('/api/auth/reset-password', async (request, reply) => {
  if (!(await enforceAuthRateLimits(request, reply, [passwordResetRouteIpRateLimit]))) {
    return;
  }

  return resetPassword(request.body as Record<string, unknown>, requestLocale(request));
});

app.get('/api/auth/me', async (request, reply) => {
  if (!(await enforceRateLimits(request, reply, [protectedRouteIpRateLimit]))) {
    return;
  }

  const token = getSessionToken(request);
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user) {
    return reply.code(401).send({ message: await serverMessage(requestLocale(request), 'loginRequired') });
  }

  return { user };
});

app.patch('/api/auth/me', async (request, reply) => {
  if (!(await enforceRateLimits(request, reply, [protectedRouteIpRateLimit]))) {
    return;
  }

  const token = getSessionToken(request);
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user) {
    return reply.code(401).send({ message: await serverMessage(requestLocale(request), 'loginRequired') });
  }

  if (!(await enforceUserRateLimits(request, reply, user, 'accountWrite'))) {
    return;
  }

  const payload = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {};
  return { user: await updateCurrentUser(user.id, payload, requestLocale(request)) };
});

app.patch('/api/auth/me/password', async (request, reply) => {
  if (!(await enforceRateLimits(request, reply, [protectedRouteIpRateLimit]))) {
    return;
  }

  const token = getSessionToken(request);
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user || !token) {
    return reply.code(401).send({ message: await serverMessage(requestLocale(request), 'loginRequired') });
  }

  if (!(await enforceUserRateLimits(request, reply, user, 'accountWrite'))) {
    return;
  }

  const payload = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {};
  return changeCurrentUserPassword(user.id, payload, token, requestLocale(request));
});

app.get('/api/auth/referral', async (request, reply) => {
  if (!(await enforceRateLimits(request, reply, [protectedRouteIpRateLimit]))) {
    return;
  }

  const token = getSessionToken(request);
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user) {
    return reply.code(401).send({ message: await serverMessage(requestLocale(request), 'loginRequired') });
  }

  return { referral: await getReferralSummary(user.id) };
});

app.get('/api/notifications', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? listNotifications(user.id, request.query as Record<string, string | string[] | undefined>) : undefined;
});

app.post('/api/notifications/ws-ticket', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? createNotificationWebSocketTicket(user.id) : undefined;
});

app.post('/api/notifications/read-all', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? markAllNotificationsRead(user.id) : undefined;
});

app.post('/api/notifications/:id/read', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }

  const { id } = request.params as { id: string };
  const result = await markNotificationRead(Number(id), user.id);
  return result.notification ? result : notFound(reply, request);
});

app.post('/api/auth/logout', async (request, reply) => {
  const token = getSessionToken(request);
  if (token) {
    await logoutSession(token);
  }

  clearSessionCookie(reply);
  return reply.code(204).send();
});

app.get('/api/admin/users', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.users.read');
  return user ? listAdminUsers() : undefined;
});

app.put('/api/admin/users/:id/roles', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.users.update', 'adminWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  return updateAdminUserRoles(Number(id), request.body as Record<string, unknown>, user.id);
});

app.get('/api/admin/roles', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.roles.read');
  return user ? listRoles() : undefined;
});

app.post('/api/admin/roles', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.roles.create', 'adminWrite');
  return user ? reply.code(201).send(await createRole(request.body as Record<string, unknown>)) : undefined;
});

app.put('/api/admin/roles/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.roles.update', 'adminWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  return updateRole(Number(id), request.body as Record<string, unknown>);
});

app.put('/api/admin/roles/:id/permissions', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.roles.update', 'adminWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  return updateRolePermissions(Number(id), request.body as Record<string, unknown>);
});

app.delete('/api/admin/roles/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.roles.delete', 'adminWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  await deleteRole(Number(id));
  return reply.code(204).send();
});

app.get('/api/admin/permissions', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.permissions.read');
  return user ? listPermissions() : undefined;
});

app.post('/api/admin/permissions', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.permissions.create', 'adminWrite');
  return user ? reply.code(201).send(await createPermission(request.body as Record<string, unknown>)) : undefined;
});

app.put('/api/admin/permissions/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.permissions.update', 'adminWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  return updatePermission(Number(id), request.body as Record<string, unknown>);
});

app.delete('/api/admin/permissions/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.permissions.delete', 'adminWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  await deletePermission(Number(id));
  return reply.code(204).send();
});

app.get('/api/languages', async () => listLanguages());

app.get('/api/system-wordings', async (request) => getSystemWordings(requestLocale(request)));

app.get('/api/options', async (request) => getOptions(requestLocale(request)));

app.get('/api/project-updates', async (request) =>
  getProjectUpdates(request.query as Record<string, string | string[] | undefined>)
);

app.get('/api/daily-checklist', async (request) =>
  listDailyChecklistItems(request.query as Record<string, string | string[] | undefined>, requestLocale(request))
);

app.get('/api/users/:id/profile', async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await optionalUser(request);
  const profile = await getPublicUserProfile(Number(id), user?.id ?? null);
  return profile ? { profile } : notFound(reply, request);
});

app.put('/api/users/:id/follow', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'users.follow', 'communityReaction');
  if (!user) {
    return;
  }

  const { id } = request.params as { id: string };
  const profile = await followUser(user.id, Number(id));
  return profile ? { profile } : notFound(reply, request);
});

app.delete('/api/users/:id/follow', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'users.follow', 'communityReaction');
  if (!user) {
    return;
  }

  const { id } = request.params as { id: string };
  const profile = await unfollowUser(user.id, Number(id));
  return profile ? { profile } : notFound(reply, request);
});

app.get('/api/users/:id/life-posts', async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await optionalUser(request);
  const canViewAll = user
    ? userHasPermission(user, 'life.posts.update-any') || userHasPermission(user, 'life.posts.delete-any')
    : false;
  const posts = await listUserLifePosts(
    Number(id),
    request.query as Record<string, string | string[] | undefined>,
    user?.id ?? null,
    requestLocale(request),
    canViewAll
  );
  return posts ? posts : notFound(reply, request);
});

app.get('/api/users/:id/reactions', async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await optionalUser(request);
  const reactions = await listUserReactionActivities(
    Number(id),
    request.query as Record<string, string | string[] | undefined>,
    user?.id ?? null,
    requestLocale(request)
  );
  return reactions ? reactions : notFound(reply, request);
});

app.get('/api/users/:id/comments', async (request, reply) => {
  const { id } = request.params as { id: string };
  const comments = await listUserCommentActivities(
    Number(id),
    request.query as Record<string, string | string[] | undefined>,
    requestLocale(request)
  );
  return comments ? comments : notFound(reply, request);
});

app.get('/api/life-posts', async (request) => {
  const user = await optionalUser(request);
  const canViewAll = user
    ? userHasPermission(user, 'life.posts.update-any') || userHasPermission(user, 'life.posts.delete-any')
    : false;
  return listLifePosts(
    request.query as Record<string, string | string[] | undefined>,
    user?.id ?? null,
    requestLocale(request),
    canViewAll
  );
});

app.get('/api/life-posts/following', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const canViewAll = userHasPermission(user, 'life.posts.update-any') || userHasPermission(user, 'life.posts.delete-any');
  return listFollowingLifePosts(
    user.id,
    request.query as Record<string, string | string[] | undefined>,
    requestLocale(request),
    canViewAll
  );
});

app.get('/api/life-posts/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await optionalUser(request);
  const canViewAll = user
    ? userHasPermission(user, 'life.posts.update-any') || userHasPermission(user, 'life.posts.delete-any')
    : false;
  const post = await getLifePost(Number(id), user?.id ?? null, requestLocale(request), canViewAll);
  return post ? post : notFound(reply, request);
});

app.get('/api/life-posts/:id/reactions', async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await optionalUser(request);
  const canViewAll = user
    ? userHasPermission(user, 'life.posts.update-any') || userHasPermission(user, 'life.posts.delete-any')
    : false;
  const reactions = await listLifePostReactionUsers(
    Number(id),
    request.query as Record<string, string | string[] | undefined>,
    user?.id ?? null,
    canViewAll
  );
  return reactions ? reactions : notFound(reply, request);
});

app.get('/api/life-posts/:postId/comments', async (request, reply) => {
  const { postId } = request.params as { postId: string };
  const user = await optionalUser(request);
  const canViewAll = user ? userHasPermission(user, 'life.comments.delete-any') : false;
  const comments = await listLifeComments(
    Number(postId),
    request.query as Record<string, string | string[] | undefined>,
    user?.id ?? null,
    canViewAll
  );
  return comments ? comments : notFound(reply, request);
});

app.post('/api/life-posts', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.posts.create', 'communityWrite');
  return user
    ? reply.code(201).send(await createLifePost(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.post('/api/life-posts/:postId/comments', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.comments.create', 'communityWrite');
  if (!user) {
    return;
  }
  const { postId } = request.params as { postId: string };
  const comment = await createLifeComment(Number(postId), request.body as Record<string, unknown>, user.id);
  return comment ? reply.code(201).send(comment) : notFound(reply, request);
});

app.post('/api/life-posts/:postId/comments/:commentId/replies', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.comments.create', 'communityWrite');
  if (!user) {
    return;
  }
  const { postId, commentId } = request.params as { postId: string; commentId: string };
  const comment = await createLifeCommentReply(
    Number(postId),
    Number(commentId),
    request.body as Record<string, unknown>,
    user.id
  );
  return comment ? reply.code(201).send(comment) : notFound(reply, request);
});

app.put('/api/life-posts/:id', async (request, reply) => {
  const user = await requireAnyPermissionWithRateLimits(
    request,
    reply,
    ['life.posts.update', 'life.posts.update-any'],
    'communityWrite'
  );
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const post = await updateLifePost(
    Number(id),
    request.body as Record<string, unknown>,
    user.id,
    requestLocale(request),
    userHasPermission(user, 'life.posts.update-any')
  );
  return post ? post : notFound(reply, request);
});

app.post('/api/life-posts/:id/moderation/retry', async (request, reply) => {
  const user = await requireAnyPermissionWithRateLimits(
    request,
    reply,
    ['life.posts.update', 'life.posts.update-any'],
    'communityWrite'
  );
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const post = await retryLifePostModeration(
    Number(id),
    user.id,
    requestLocale(request),
    userHasPermission(user, 'life.posts.update-any')
  );
  return post ? post : notFound(reply, request);
});

app.put('/api/life-posts/:id/reaction', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.reactions.set', 'communityReaction');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const post = await setLifePostReaction(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));
  return post ? post : notFound(reply, request);
});

app.delete('/api/life-posts/:id/reaction', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.reactions.set', 'communityReaction');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const post = await deleteLifePostReaction(Number(id), user.id, requestLocale(request));
  return post ? post : notFound(reply, request);
});

app.put('/api/life-posts/:id/rating', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.ratings.set', 'communityReaction');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const post = await setLifePostRating(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));
  return post ? post : notFound(reply, request);
});

app.delete('/api/life-posts/:id/rating', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.ratings.set', 'communityReaction');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const post = await deleteLifePostRating(Number(id), user.id, requestLocale(request));
  return post ? post : notFound(reply, request);
});

app.delete('/api/life-posts/:id', async (request, reply) => {
  const user = await requireAnyPermissionWithRateLimits(
    request,
    reply,
    ['life.posts.delete', 'life.posts.delete-any'],
    'communityWrite'
  );
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteLifePost(Number(id), user.id, userHasPermission(user, 'life.posts.delete-any'));
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.delete('/api/life-comments/:id', async (request, reply) => {
  const user = await requireAnyPermissionWithRateLimits(
    request,
    reply,
    ['life.comments.delete', 'life.comments.delete-any'],
    'communityWrite'
  );
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteLifeComment(Number(id), user.id, userHasPermission(user, 'life.comments.delete-any'));
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.post('/api/life-comments/:id/restore', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.comments.delete', 'communityWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const comment = await restoreLifeComment(Number(id), user.id);
  return comment ? comment : notFound(reply, request);
});

app.put('/api/life-comments/:id/like', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.comments.like', 'communityReaction');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const comment = await setLifeCommentLike(Number(id), user.id);
  return comment ? comment : notFound(reply, request);
});

app.delete('/api/life-comments/:id/like', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'life.comments.like', 'communityReaction');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const comment = await deleteLifeCommentLike(Number(id), user.id);
  return comment ? comment : notFound(reply, request);
});

app.post('/api/life-comments/:id/moderation/retry', async (request, reply) => {
  const user = await requireAnyPermissionWithRateLimits(
    request,
    reply,
    ['life.comments.create', 'life.comments.delete-any'],
    'communityWrite'
  );
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const comment = await retryLifeCommentModeration(
    Number(id),
    user.id,
    userHasPermission(user, 'life.comments.delete-any')
  );
  return comment ? comment : notFound(reply, request);
});

app.get('/api/discussions/:entityType/:entityId/comments', async (request, reply) => {
  const { entityType, entityId } = request.params as { entityType: string; entityId: string };
  const user = await optionalUser(request);
  const canViewAll = user ? userHasPermission(user, 'discussions.comments.delete-any') : false;
  const comments = await listEntityDiscussionComments(
    entityType,
    Number(entityId),
    request.query as Record<string, string | string[] | undefined>,
    user?.id ?? null,
    canViewAll
  );
  return comments ? comments : notFound(reply, request);
});

app.post('/api/discussions/:entityType/:entityId/comments', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'discussions.comments.create', 'communityWrite');
  if (!user) {
    return;
  }

  const { entityType, entityId } = request.params as { entityType: string; entityId: string };
  const comment = await createEntityDiscussionComment(
    entityType,
    Number(entityId),
    request.body as Record<string, unknown>,
    user.id
  );
  return comment ? reply.code(201).send(comment) : notFound(reply, request);
});

app.post('/api/discussions/:entityType/:entityId/comments/:commentId/replies', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'discussions.comments.create', 'communityWrite');
  if (!user) {
    return;
  }

  const { entityType, entityId, commentId } = request.params as {
    entityType: string;
    entityId: string;
    commentId: string;
  };
  const comment = await createEntityDiscussionReply(
    entityType,
    Number(entityId),
    Number(commentId),
    request.body as Record<string, unknown>,
    user.id
  );
  return comment ? reply.code(201).send(comment) : notFound(reply, request);
});

app.delete('/api/discussions/comments/:id', async (request, reply) => {
  const user = await requireAnyPermissionWithRateLimits(
    request,
    reply,
    ['discussions.comments.delete', 'discussions.comments.delete-any'],
    'communityWrite'
  );
  if (!user) {
    return;
  }

  const { id } = request.params as { id: string };
  const deleted = await deleteEntityDiscussionComment(
    Number(id),
    user.id,
    userHasPermission(user, 'discussions.comments.delete-any')
  );
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.post('/api/discussions/comments/:id/moderation/retry', async (request, reply) => {
  const user = await requireAnyPermissionWithRateLimits(
    request,
    reply,
    ['discussions.comments.create', 'discussions.comments.delete-any'],
    'communityWrite'
  );
  if (!user) {
    return;
  }

  const { id } = request.params as { id: string };
  const comment = await retryEntityDiscussionCommentModeration(
    Number(id),
    user.id,
    userHasPermission(user, 'discussions.comments.delete-any')
  );
  return comment ? comment : notFound(reply, request);
});

app.put('/api/discussions/comments/:id/like', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'discussions.comments.like', 'communityReaction');
  if (!user) {
    return;
  }

  const { id } = request.params as { id: string };
  const comment = await setEntityDiscussionCommentLike(Number(id), user.id);
  return comment ? comment : notFound(reply, request);
});

app.delete('/api/discussions/comments/:id/like', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'discussions.comments.like', 'communityReaction');
  if (!user) {
    return;
  }

  const { id } = request.params as { id: string };
  const comment = await deleteEntityDiscussionCommentLike(Number(id), user.id);
  return comment ? comment : notFound(reply, request);
});

app.get('/api/pokemon', async (request) =>
  listPokemon(request.query as Record<string, string | string[] | undefined>, requestLocale(request))
);

app.get('/api/pokemon/fetch-options', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'pokemon.fetch', 'fetch');
  return user
    ? listPokemonFetchOptions(request.query as Record<string, string | string[] | undefined>, requestLocale(request))
    : undefined;
});

app.get('/api/pokemon/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const pokemon = await getPokemon(Number(id), requestLocale(request));

  if (!pokemon) {
    return notFound(reply, request);
  }

  return pokemon;
});

app.post('/api/pokemon', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'pokemon.create', 'wikiWrite');
  return user
    ? reply.code(201).send(await createPokemon(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.post('/api/pokemon/fetch', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'pokemon.fetch', 'fetch');
  return user ? fetchPokemonData(request.body as Record<string, unknown>, user.id) : undefined;
});

app.post('/api/pokemon/image-options', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'pokemon.fetch', 'fetch');
  return user ? fetchPokemonImageOptions(request.body as Record<string, unknown>) : undefined;
});

app.post('/api/uploads/:entityType', async (request, reply) => {
  const { entityType } = request.params as { entityType: string };
  if (!isUploadEntityType(entityType)) {
    return notFound(reply, request);
  }

  const permissionKey =
    entityType === 'pokemon'
      ? 'pokemon.upload'
      : entityType === 'items'
        ? 'items.upload'
        : entityType === 'habitats'
          ? 'habitats.upload'
          : 'ancient-artifacts.upload';
  const user = await requirePermissionWithRateLimits(request, reply, permissionKey, 'upload');
  if (!user) {
    return;
  }

  let file: MultipartFile | undefined;
  try {
    file = await request.file();
  } catch (error) {
    const multipartError = error as Error & { code?: string };
    if (multipartError.code === 'FST_REQ_FILE_TOO_LARGE') {
      throw badRequest('server.validation.imageUploadContentInvalid');
    }
    throw error;
  }

  return reply.code(201).send(await saveEntityImageUpload(entityType, file, user));
});

app.put('/api/pokemon/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'pokemon.update', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const pokemon = await updatePokemon(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));

  if (!pokemon) {
    return notFound(reply, request);
  }

  return pokemon;
});

app.delete('/api/pokemon/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'pokemon.delete', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deletePokemon(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/habitats', async (request) =>
  listHabitats(request.query as Record<string, string | string[] | undefined>, requestLocale(request))
);

app.get('/api/habitats/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const habitat = await getHabitat(Number(id), requestLocale(request));

  if (!habitat) {
    return notFound(reply, request);
  }

  return habitat;
});

app.post('/api/habitats', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'habitats.create', 'wikiWrite');
  return user
    ? reply.code(201).send(await createHabitat(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/habitats/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'habitats.update', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const habitat = await updateHabitat(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));

  if (!habitat) {
    return notFound(reply, request);
  }

  return habitat;
});

app.delete('/api/habitats/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'habitats.delete', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteHabitat(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/items', async (request) =>
  listItems(request.query as Record<string, string | string[] | undefined>, requestLocale(request))
);

app.get('/api/items/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const item = await getItem(Number(id), requestLocale(request));

  if (!item) {
    return notFound(reply, request);
  }

  return item;
});

app.post('/api/items', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'items.create', 'wikiWrite');
  if (!user) {
    return undefined;
  }

  const payload = request.body as Record<string, unknown>;
  const hasInsertAnchor =
    (payload.insertBeforeItemId !== undefined && payload.insertBeforeItemId !== null && payload.insertBeforeItemId !== '') ||
    (payload.insertAfterItemId !== undefined && payload.insertAfterItemId !== null && payload.insertAfterItemId !== '');

  if (hasInsertAnchor && !userHasPermission(user, 'items.order')) {
    reply.code(403).send({ message: await serverMessage(requestLocale(request), 'permissionDenied') });
    return undefined;
  }

  return reply.code(201).send(await createItem(payload, user.id, requestLocale(request)));
});

app.put('/api/items/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'items.update', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const item = await updateItem(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));

  if (!item) {
    return notFound(reply, request);
  }

  return item;
});

app.delete('/api/items/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'items.delete', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteItem(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/ancient-artifacts', async (request) =>
  listAncientArtifacts(request.query as Record<string, string | string[] | undefined>, requestLocale(request))
);

app.get('/api/ancient-artifacts/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const artifact = await getAncientArtifact(Number(id), requestLocale(request));

  if (!artifact) {
    return notFound(reply, request);
  }

  return artifact;
});

app.post('/api/ancient-artifacts', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'ancient-artifacts.create', 'wikiWrite');
  return user
    ? reply.code(201).send(await createAncientArtifact(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/ancient-artifacts/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'ancient-artifacts.update', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const artifact = await updateAncientArtifact(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));

  if (!artifact) {
    return notFound(reply, request);
  }

  return artifact;
});

app.delete('/api/ancient-artifacts/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'ancient-artifacts.delete', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteAncientArtifact(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/recipes', async (request) =>
  listRecipes(request.query as Record<string, string | string[] | undefined>, requestLocale(request))
);

app.get('/api/recipes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const recipe = await getRecipe(Number(id), requestLocale(request));

  if (!recipe) {
    return notFound(reply, request);
  }

  return recipe;
});

app.post('/api/recipes', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'recipes.create', 'wikiWrite');
  return user
    ? reply.code(201).send(await createRecipe(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/recipes/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'recipes.update', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const recipe = await updateRecipe(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));

  if (!recipe) {
    return notFound(reply, request);
  }

  return recipe;
});

app.delete('/api/recipes/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'recipes.delete', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteRecipe(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/dish', async (request) => listDish(requestLocale(request)));

app.post('/api/admin/dish/categories', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'dish.create', 'wikiWrite');
  return user
    ? reply.code(201).send(await createDishCategory(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/admin/dish/categories/order', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'dish.order', 'wikiWrite');
  return user ? reorderDishCategories(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/dish/categories/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'dish.update', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const category = await updateDishCategory(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));
  return category ? category : notFound(reply, request);
});

app.delete('/api/admin/dish/categories/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'dish.delete', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteDishCategory(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.post('/api/admin/dish/dishes', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'dish.create', 'wikiWrite');
  return user
    ? reply.code(201).send(await createDish(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/admin/dish/dishes/order', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'dish.order', 'wikiWrite');
  return user ? reorderDishes(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/dish/dishes/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'dish.update', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const dish = await updateDish(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));
  return dish ? dish : notFound(reply, request);
});

app.delete('/api/admin/dish/dishes/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'dish.delete', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteDish(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.post('/api/admin/daily-checklist', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'checklist.create', 'wikiWrite');
  return user
    ? reply
        .code(201)
        .send(await createDailyChecklistItem(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/admin/daily-checklist/order', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'checklist.order', 'wikiWrite');
  return user ? reorderDailyChecklistItems(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/daily-checklist/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'checklist.update', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const item = await updateDailyChecklistItem(
    Number(id),
    request.body as Record<string, unknown>,
    user.id,
    requestLocale(request)
  );
  return item ? item : notFound(reply, request);
});

app.delete('/api/admin/daily-checklist/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'checklist.delete', 'wikiWrite');
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteDailyChecklistItem(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.put('/api/admin/items/order', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'items.order', 'wikiWrite');
  return user ? reorderItems(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/ancient-artifacts/order', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'ancient-artifacts.order', 'wikiWrite');
  return user ? reorderAncientArtifacts(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/recipes/order', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'recipes.order', 'wikiWrite');
  return user ? reorderRecipes(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/habitats/order', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'habitats.order', 'wikiWrite');
  return user ? reorderHabitats(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.get('/api/admin/languages', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.languages.read');
  return user ? listLanguages(true) : undefined;
});

app.post('/api/admin/languages', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.languages.create', 'adminWrite');
  return user ? reply.code(201).send(await createLanguage(request.body as Record<string, unknown>)) : undefined;
});

app.put('/api/admin/languages/order', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.languages.order', 'adminWrite');
  return user ? reorderLanguages(request.body as Record<string, unknown>) : undefined;
});

app.put('/api/admin/languages/:code', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.languages.update', 'adminWrite');
  if (!user) {
    return;
  }
  const { code } = request.params as { code: string };
  return updateLanguage(code, request.body as Record<string, unknown>);
});

app.delete('/api/admin/languages/:code', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.languages.delete', 'adminWrite');
  if (!user) {
    return;
  }
  const { code } = request.params as { code: string };
  const deleted = await deleteLanguage(code);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/admin/system-wordings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.wordings.read');
  return user ? listSystemWordingRows(request.query as Record<string, unknown>) : undefined;
});

app.put('/api/admin/system-wordings/:key', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.wordings.update', 'adminWrite');
  if (!user) {
    return;
  }
  const { key } = request.params as { key: string };
  return updateSystemWordingValue(key, request.body as Record<string, unknown>, user.id);
});

app.get('/api/admin/ai-moderation', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.ai-moderation.read');
  return user ? getAiModerationSettings() : undefined;
});

app.put('/api/admin/ai-moderation', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.ai-moderation.update', 'adminWrite');
  if (!user) {
    return;
  }
  return updateAiModerationSettings(request.body as Record<string, unknown>, user.id);
});

app.get('/api/admin/rate-limits', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.rate-limits.read');
  return user ? getRateLimitSettings() : undefined;
});

app.put('/api/admin/rate-limits', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.rate-limits.update', 'adminWrite');
  if (!user) {
    return;
  }
  return updateRateLimitSettings(request.body as Record<string, unknown>, user.id);
});

app.get('/api/admin/data-tools/summary', async (request, reply) => {
  const user = await requireAnyPermission(request, reply, ['admin.data.export', 'admin.data.import']);
  return user ? getAdminDataToolsSummary() : undefined;
});

app.post('/api/admin/data-tools/export', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.data.export', 'adminWrite');
  return user ? exportAdminData(request.body as Record<string, unknown>) : undefined;
});

app.post('/api/admin/data-tools/import', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.data.import', 'adminWrite');
  return user ? importAdminData(request.body as Record<string, unknown>) : undefined;
});

app.post('/api/admin/data-tools/import-items-csv', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.data.import', 'adminWrite');
  return user ? importAdminItemsCsv(request.body as Record<string, unknown>, user.id) : undefined;
});

app.post('/api/admin/data-tools/import-habitats-csv', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.data.import', 'adminWrite');
  return user ? importAdminHabitatsCsv(request.body as Record<string, unknown>, user.id) : undefined;
});

app.post('/api/admin/data-tools/wipe', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.data.import', 'adminWrite');
  return user ? wipeAdminData(request.body as Record<string, unknown>) : undefined;
});

app.get('/api/admin/config/:type', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.config.read');
  if (!user) {
    return;
  }
  const { type } = request.params as { type: string };
  if (!isConfigType(type)) {
    return notFound(reply, request);
  }
  return listConfig(type, requestLocale(request));
});

app.post('/api/admin/config/:type', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.config.create', 'adminWrite');
  if (!user) {
    return;
  }
  const { type } = request.params as { type: string };
  if (!isConfigType(type)) {
    return notFound(reply, request);
  }
  return reply
    .code(201)
    .send(await createConfig(type, request.body as Record<string, unknown>, user.id, requestLocale(request)));
});

app.put('/api/admin/config/:type/order', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.config.order', 'adminWrite');
  if (!user) {
    return;
  }
  const { type } = request.params as { type: string };
  if (!isConfigType(type)) {
    return notFound(reply, request);
  }
  return reorderConfig(type, request.body as Record<string, unknown>, user.id, requestLocale(request));
});

app.put('/api/admin/config/:type/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.config.update', 'adminWrite');
  if (!user) {
    return;
  }
  const { type, id } = request.params as { type: string; id: string };
  if (!isConfigType(type)) {
    return notFound(reply, request);
  }
  const config = await updateConfig(type, Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));
  return config ? config : notFound(reply, request);
});

app.delete('/api/admin/config/:type/:id', async (request, reply) => {
  const user = await requirePermissionWithRateLimits(request, reply, 'admin.config.delete', 'adminWrite');
  if (!user) {
    return;
  }
  const { type, id } = request.params as { type: string; id: string };
  if (!isConfigType(type)) {
    return notFound(reply, request);
  }
  const deleted = await deleteConfig(type, Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

const port = Number(process.env.BACKEND_PORT ?? 3001);

try {
  await initializeDatabase();
  await syncSystemWordingCatalog();
  await startAiModerationWorker(app.log);
  setupNotificationWebSocketServer(app.server, app.log);
  await app.listen({ host: '0.0.0.0', port });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exit(1);
}
