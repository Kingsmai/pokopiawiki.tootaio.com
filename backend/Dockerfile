FROM node:22-alpine

WORKDIR /app/backend
COPY backend/package.json ./
RUN corepack enable && pnpm install
COPY backend/. .
COPY data /app/data
COPY package.json /app/package.json
COPY system-wordings.ts /app/system-wordings.ts
EXPOSE 3001
CMD ["pnpm", "run", "start"]
