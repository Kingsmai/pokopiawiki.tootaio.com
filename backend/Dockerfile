FROM node:22-alpine

WORKDIR /app
COPY package.json ./
RUN corepack enable && pnpm install
COPY . .
EXPOSE 3001
CMD ["pnpm", "run", "start"]
