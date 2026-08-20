# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
# Persist SQLite on a Railway volume mounted at /data
ENV DATABASE_URL="file:/data/portal.db"

EXPOSE 3000

CMD ["sh", "-c", "mkdir -p /data && npx prisma migrate deploy && node src/index.js"]
