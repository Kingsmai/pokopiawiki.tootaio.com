import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  getUserBySessionToken,
  loginUser,
  logoutSession,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updateCurrentUser,
  verifyEmail,
  type AuthUser
} from './auth.ts';
import { initializeDatabase, pool } from './db.ts';
import {
  cleanLocale,
  createConfig,
  createDailyChecklistItem,
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
  deleteDailyChecklistItem,
  deleteEntityDiscussionComment,
  deleteHabitat,
  deleteItem,
  deleteLanguage,
  deleteLifeComment,
  deleteLifePost,
  deleteLifePostReaction,
  deletePokemon,
  deleteRecipe,
  fetchPokemonData,
  fetchPokemonImageOptions,
  getHabitat,
  getItem,
  getOptions,
  getPokemon,
  getRecipe,
  isConfigType,
  listEntityDiscussionComments,
  listConfig,
  listDailyChecklistItems,
  listHabitats,
  listItems,
  listLanguages,
  listLifePosts,
  listPokemon,
  listPokemonFetchOptions,
  listRecipes,
  reorderConfig,
  reorderDailyChecklistItems,
  reorderHabitats,
  reorderItems,
  reorderLanguages,
  reorderPokemon,
  reorderRecipes,
  setLifePostReaction,
  updateConfig,
  updateDailyChecklistItem,
  updateHabitat,
  updateItem,
  updateLanguage,
  updateLifePost,
  updatePokemon,
  updateRecipe
} from './queries.ts';
import {
  getSystemWordings,
  listSystemWordingRows,
  localizedStatusMessage,
  syncSystemWordingCatalog,
  systemMessage,
  updateSystemWordingValue
} from './systemWordingQueries.ts';

const app = Fastify({
  logger: true
});

await app.register(cors, {
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Locale'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  origin: process.env.FRONTEND_ORIGIN ?? true
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

  if (pgError.code === '23514') {
    return reply.code(400).send({ message: await serverMessage(locale, 'invalidField') });
  }

  if (pgError.statusCode && pgError.statusCode < 500) {
    return reply.code(pgError.statusCode).send({ message: await localizedStatusMessage(locale, pgError.message) });
  }

  app.log.error(error);
  return reply.code(500).send({ message: await serverMessage(locale, 'serverError') });
});

app.get('/health', async () => ({ ok: true }));

function getBearerToken(authorization: string | undefined): string | null {
  const [scheme, token] = authorization?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : null;
}

function requestLocale(request: FastifyRequest): string {
  const query = request.query as Record<string, string | string[] | undefined>;
  const queryLocale = Array.isArray(query.locale) ? query.locale[0] : query.locale;
  const headerLocale = request.headers['x-locale'];
  return cleanLocale(queryLocale ?? (Array.isArray(headerLocale) ? headerLocale[0] : headerLocale));
}

function serverMessage(
  locale: string,
  key: 'foreignKey' | 'duplicate' | 'invalidField' | 'serverError' | 'loginRequired' | 'verifyEmailFirst' | 'notFound'
): Promise<string> {
  return systemMessage(locale, `server.errors.${key}`);
}

async function notFound(reply: FastifyReply, request: FastifyRequest) {
  return reply.code(404).send({ message: await serverMessage(requestLocale(request), 'notFound') });
}

async function requireVerifiedUser(request: FastifyRequest, reply: FastifyReply): Promise<AuthUser | null> {
  const token = getBearerToken(request.headers.authorization);
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

async function optionalUser(request: FastifyRequest): Promise<AuthUser | null> {
  const token = getBearerToken(request.headers.authorization);
  if (!token) {
    return null;
  }

  try {
    return await getUserBySessionToken(token);
  } catch {
    return null;
  }
}

app.post('/api/auth/register', async (request, reply) =>
  reply.code(201).send(await registerUser(request.body as Record<string, unknown>, requestLocale(request)))
);

app.post('/api/auth/verify-email', async (request) => verifyEmail(request.body as Record<string, unknown>, requestLocale(request)));

app.post('/api/auth/login', async (request) => loginUser(request.body as Record<string, unknown>, requestLocale(request)));

app.post('/api/auth/request-password-reset', async (request) =>
  requestPasswordReset(request.body as Record<string, unknown>, requestLocale(request))
);

app.post('/api/auth/reset-password', async (request) =>
  resetPassword(request.body as Record<string, unknown>, requestLocale(request))
);

app.get('/api/auth/me', async (request, reply) => {
  const token = getBearerToken(request.headers.authorization);
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user) {
    return reply.code(401).send({ message: await serverMessage(requestLocale(request), 'loginRequired') });
  }

  return { user };
});

app.patch('/api/auth/me', async (request, reply) => {
  const token = getBearerToken(request.headers.authorization);
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user) {
    return reply.code(401).send({ message: await serverMessage(requestLocale(request), 'loginRequired') });
  }

  const payload = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {};
  return { user: await updateCurrentUser(user.id, payload, requestLocale(request)) };
});

app.post('/api/auth/logout', async (request, reply) => {
  const token = getBearerToken(request.headers.authorization);
  if (token) {
    await logoutSession(token);
  }

  return reply.code(204).send();
});

app.get('/api/languages', async () => listLanguages());

app.get('/api/system-wordings', async (request) => getSystemWordings(requestLocale(request)));

app.get('/api/options', async (request) => getOptions(requestLocale(request)));

app.get('/api/daily-checklist', async (request) => listDailyChecklistItems(requestLocale(request)));

app.get('/api/life-posts', async (request) => {
  const user = await optionalUser(request);
  return listLifePosts(request.query as Record<string, string | string[] | undefined>, user?.id ?? null, requestLocale(request));
});

app.post('/api/life-posts', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user
    ? reply.code(201).send(await createLifePost(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.post('/api/life-posts/:postId/comments', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { postId } = request.params as { postId: string };
  const comment = await createLifeComment(Number(postId), request.body as Record<string, unknown>, user.id);
  return comment ? reply.code(201).send(comment) : notFound(reply, request);
});

app.post('/api/life-posts/:postId/comments/:commentId/replies', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const post = await updateLifePost(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));
  return post ? post : notFound(reply, request);
});

app.put('/api/life-posts/:id/reaction', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const post = await setLifePostReaction(Number(id), request.body as Record<string, unknown>, user.id, requestLocale(request));
  return post ? post : notFound(reply, request);
});

app.delete('/api/life-posts/:id/reaction', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const post = await deleteLifePostReaction(Number(id), user.id, requestLocale(request));
  return post ? post : notFound(reply, request);
});

app.delete('/api/life-posts/:id', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteLifePost(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.delete('/api/life-comments/:id', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteLifeComment(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/discussions/:entityType/:entityId/comments', async (request, reply) => {
  const { entityType, entityId } = request.params as { entityType: string; entityId: string };
  const comments = await listEntityDiscussionComments(entityType, Number(entityId));
  return comments ? comments : notFound(reply, request);
});

app.post('/api/discussions/:entityType/:entityId/comments', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }

  const { id } = request.params as { id: string };
  const deleted = await deleteEntityDiscussionComment(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/pokemon', async (request) =>
  listPokemon(request.query as Record<string, string | string[] | undefined>, requestLocale(request))
);

app.get('/api/pokemon/fetch-options', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
  return user
    ? reply.code(201).send(await createPokemon(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.post('/api/pokemon/fetch', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? fetchPokemonData(request.body as Record<string, unknown>, user.id) : undefined;
});

app.post('/api/pokemon/image-options', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? fetchPokemonImageOptions(request.body as Record<string, unknown>) : undefined;
});

app.put('/api/pokemon/:id', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deletePokemon(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/habitats', async (request) => listHabitats(requestLocale(request)));

app.get('/api/habitats/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const habitat = await getHabitat(Number(id), requestLocale(request));

  if (!habitat) {
    return notFound(reply, request);
  }

  return habitat;
});

app.post('/api/habitats', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user
    ? reply.code(201).send(await createHabitat(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/habitats/:id', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
  return user
    ? reply.code(201).send(await createItem(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/items/:id', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteItem(Number(id), user.id);
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
  const user = await requireVerifiedUser(request, reply);
  return user
    ? reply.code(201).send(await createRecipe(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/recipes/:id', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteRecipe(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.post('/api/admin/daily-checklist', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user
    ? reply
        .code(201)
        .send(await createDailyChecklistItem(request.body as Record<string, unknown>, user.id, requestLocale(request)))
    : undefined;
});

app.put('/api/admin/daily-checklist/order', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? reorderDailyChecklistItems(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/daily-checklist/:id', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { id } = request.params as { id: string };
  const deleted = await deleteDailyChecklistItem(Number(id), user.id);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.put('/api/admin/pokemon/order', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? reorderPokemon(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/items/order', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? reorderItems(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/recipes/order', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? reorderRecipes(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.put('/api/admin/habitats/order', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? reorderHabitats(request.body as Record<string, unknown>, user.id, requestLocale(request)) : undefined;
});

app.get('/api/admin/languages', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? listLanguages(true) : undefined;
});

app.post('/api/admin/languages', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? reply.code(201).send(await createLanguage(request.body as Record<string, unknown>)) : undefined;
});

app.put('/api/admin/languages/order', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? reorderLanguages(request.body as Record<string, unknown>) : undefined;
});

app.put('/api/admin/languages/:code', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { code } = request.params as { code: string };
  return updateLanguage(code, request.body as Record<string, unknown>);
});

app.delete('/api/admin/languages/:code', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { code } = request.params as { code: string };
  const deleted = await deleteLanguage(code);
  return deleted ? reply.code(204).send() : notFound(reply, request);
});

app.get('/api/admin/system-wordings', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  return user ? listSystemWordingRows(request.query as Record<string, unknown>) : undefined;
});

app.put('/api/admin/system-wordings/:key', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
  if (!user) {
    return;
  }
  const { key } = request.params as { key: string };
  return updateSystemWordingValue(key, request.body as Record<string, unknown>, user.id);
});

app.get('/api/admin/config/:type', async (request, reply) => {
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
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
  const user = await requireVerifiedUser(request, reply);
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
  await app.listen({ host: '0.0.0.0', port });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exit(1);
}
