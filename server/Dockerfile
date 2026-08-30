FROM node:22-alpine
WORKDIR /app

# Install against the manifest first so this layer caches across source edits.
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server/ ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Coolify needs an endpoint that proves the database is reachable, not merely
# that node is running — a container that cannot see Postgres is not healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "index.js"]
