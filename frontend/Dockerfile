FROM node:22-alpine AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate && pnpm install --frozen-lockfile --filter @pokopia/frontend...
COPY frontend ./frontend
COPY system-wordings.ts ./system-wordings.ts

ARG VITE_API_BASE_URL=http://localhost:3001
ARG VITE_SITE_URL=https://pokopiawiki.tootaio.com
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
RUN pnpm --filter @pokopia/frontend build

FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=20015

WORKDIR /app
COPY --from=build /app/frontend/dist ./dist
COPY frontend/static-server.mjs ./static-server.mjs

USER node
EXPOSE 20015
CMD ["node", "static-server.mjs"]
