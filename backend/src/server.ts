import cors from '@fastify/cors';
import Fastify from 'fastify';
import { initializeDatabase, pool } from './db.ts';
import {
  createConfig,
  createHabitat,
  createItem,
  createPokemon,
  createRecipe,
  deleteConfig,
  deleteHabitat,
  deleteItem,
  deletePokemon,
  deleteRecipe,
  getHabitat,
  getItem,
  getOptions,
  getPokemon,
  getRecipe,
  isConfigType,
  listConfig,
  listHabitats,
  listItems,
  listPokemon,
  listRecipes,
  updateConfig,
  updateHabitat,
  updateItem,
  updatePokemon,
  updateRecipe
} from './queries.ts';

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: process.env.FRONTEND_ORIGIN ?? true
});

app.setErrorHandler(async (error, _request, reply) => {
  const pgError = error as Error & { code?: string; constraint?: string; detail?: string; statusCode?: number };

  if (pgError.code === '23503') {
    return reply.code(409).send({ message: 'Referenced data is missing or this item is in use' });
  }

  if (pgError.code === '23505') {
    return reply.code(409).send({ message: 'A record with the same value already exists' });
  }

  if (pgError.code === '23514') {
    return reply.code(400).send({ message: 'Invalid field value' });
  }

  if (pgError.statusCode && pgError.statusCode < 500) {
    return reply.code(pgError.statusCode).send({ message: pgError.message });
  }

  app.log.error(error);
  return reply.code(500).send({ message: 'Server error' });
});

app.get('/health', async () => ({ ok: true }));

app.get('/api/options', async () => getOptions());

app.get('/api/pokemon', async (request) => listPokemon(request.query as Record<string, string | string[] | undefined>));

app.get('/api/pokemon/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const pokemon = await getPokemon(Number(id));

  if (!pokemon) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return pokemon;
});

app.post('/api/pokemon', async (request, reply) => reply.code(201).send(await createPokemon(request.body as Record<string, unknown>)));

app.put('/api/pokemon/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const pokemon = await updatePokemon(Number(id), request.body as Record<string, unknown>);

  if (!pokemon) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return pokemon;
});

app.delete('/api/pokemon/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const deleted = await deletePokemon(Number(id));
  return deleted ? reply.code(204).send() : reply.code(404).send({ message: 'Not found' });
});

app.get('/api/habitats', async () => listHabitats());

app.get('/api/habitats/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const habitat = await getHabitat(Number(id));

  if (!habitat) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return habitat;
});

app.post('/api/habitats', async (request, reply) => reply.code(201).send(await createHabitat(request.body as Record<string, unknown>)));

app.put('/api/habitats/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const habitat = await updateHabitat(Number(id), request.body as Record<string, unknown>);

  if (!habitat) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return habitat;
});

app.delete('/api/habitats/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const deleted = await deleteHabitat(Number(id));
  return deleted ? reply.code(204).send() : reply.code(404).send({ message: 'Not found' });
});

app.get('/api/items', async (request) => listItems(request.query as Record<string, string | string[] | undefined>));

app.get('/api/items/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const item = await getItem(Number(id));

  if (!item) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return item;
});

app.post('/api/items', async (request, reply) => reply.code(201).send(await createItem(request.body as Record<string, unknown>)));

app.put('/api/items/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const item = await updateItem(Number(id), request.body as Record<string, unknown>);

  if (!item) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return item;
});

app.delete('/api/items/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const deleted = await deleteItem(Number(id));
  return deleted ? reply.code(204).send() : reply.code(404).send({ message: 'Not found' });
});

app.get('/api/recipes', async () => listRecipes());

app.get('/api/recipes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const recipe = await getRecipe(Number(id));

  if (!recipe) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return recipe;
});

app.post('/api/recipes', async (request, reply) => reply.code(201).send(await createRecipe(request.body as Record<string, unknown>)));

app.put('/api/recipes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const recipe = await updateRecipe(Number(id), request.body as Record<string, unknown>);

  if (!recipe) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return recipe;
});

app.delete('/api/recipes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const deleted = await deleteRecipe(Number(id));
  return deleted ? reply.code(204).send() : reply.code(404).send({ message: 'Not found' });
});

app.get('/api/admin/config/:type', async (request, reply) => {
  const { type } = request.params as { type: string };
  if (!isConfigType(type)) {
    return reply.code(404).send({ message: 'Not found' });
  }
  return listConfig(type);
});

app.post('/api/admin/config/:type', async (request, reply) => {
  const { type } = request.params as { type: string };
  if (!isConfigType(type)) {
    return reply.code(404).send({ message: 'Not found' });
  }
  return reply.code(201).send(await createConfig(type, request.body as Record<string, unknown>));
});

app.put('/api/admin/config/:type/:id', async (request, reply) => {
  const { type, id } = request.params as { type: string; id: string };
  if (!isConfigType(type)) {
    return reply.code(404).send({ message: 'Not found' });
  }
  const config = await updateConfig(type, Number(id), request.body as Record<string, unknown>);
  return config ? config : reply.code(404).send({ message: 'Not found' });
});

app.delete('/api/admin/config/:type/:id', async (request, reply) => {
  const { type, id } = request.params as { type: string; id: string };
  if (!isConfigType(type)) {
    return reply.code(404).send({ message: 'Not found' });
  }
  const deleted = await deleteConfig(type, Number(id));
  return deleted ? reply.code(204).send() : reply.code(404).send({ message: 'Not found' });
});

const port = Number(process.env.BACKEND_PORT ?? 3001);

try {
  await initializeDatabase();
  await app.listen({ host: '0.0.0.0', port });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exit(1);
}
