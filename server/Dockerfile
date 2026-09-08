# syntax=docker/dockerfile:1
FROM node:20-slim

WORKDIR /app

# Install dependencies first for better layer caching — only re-runs npm ci
# when package.json/package-lock.json actually change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production

# Run as a non-root user inside the container.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --gid 1001 studiomind \
  && chown -R studiomind:nodejs /app
USER studiomind

# Cloud Run injects PORT and routes traffic to it; config/env.js reads
# process.env.PORT (falls back to 3000 for local `docker run` without -e PORT).
EXPOSE 8080

CMD ["node", "src/server.js"]
