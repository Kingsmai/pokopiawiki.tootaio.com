import cors from '@fastify/cors';
import Fastify from 'fastify';
import { initializeDatabase, pool } from './db.ts';
import {
  getHabitat,
  getItem,
  getOptions,
  getPokemon,
  getRecipe,
  listHabitats,
  listItems,
  listPokemon,
  listRecipes
} from './queries.ts';

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: process.env.FRONTEND_ORIGIN ?? true
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

app.get('/api/habitats', async () => listHabitats());

app.get('/api/habitats/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const habitat = await getHabitat(Number(id));

  if (!habitat) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return habitat;
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

app.get('/api/recipes', async () => listRecipes());

app.get('/api/recipes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const recipe = await getRecipe(Number(id));

  if (!recipe) {
    return reply.code(404).send({ message: 'Not found' });
  }

  return recipe;
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
