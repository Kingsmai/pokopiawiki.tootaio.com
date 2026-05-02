FROM node:22-alpine

WORKDIR /app
COPY backend/package.json ./
RUN corepack enable && pnpm install
COPY backend/. .
COPY data ./data
EXPOSE 3001
CMD ["pnpm", "run", "start"]
