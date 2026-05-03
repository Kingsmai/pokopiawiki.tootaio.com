FROM node:22-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate && pnpm install --frozen-lockfile --filter @pokopia/backend...
COPY backend ./backend
COPY data ./data
COPY system-wordings.ts ./system-wordings.ts
RUN mkdir -p /app/uploads && chown -R node:node /app

ENV NODE_ENV=production
WORKDIR /app/backend
USER node
EXPOSE 3001
CMD ["pnpm", "run", "start"]
