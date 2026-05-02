FROM node:22-alpine

WORKDIR /app/frontend
COPY frontend/package.json ./
RUN corepack enable && pnpm install
COPY frontend/. .
COPY package.json /app/package.json
COPY system-wordings.ts /app/system-wordings.ts
EXPOSE 3000
CMD ["pnpm", "run", "dev"]
