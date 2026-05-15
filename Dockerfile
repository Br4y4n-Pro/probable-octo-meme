# ─── Build stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Install all workspace deps (incl. dev) for the TypeScript + Vite build
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci

# Copy sources and run the full build (shared → server → client)
COPY shared ./shared
COPY server ./server
COPY client ./client
RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Re-install production deps only. Workspaces stay symlinked so the server
# can import @battlenaval/shared from ./shared/dist.
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/client/package.json ./client/
RUN npm ci --omit=dev --workspaces && npm cache clean --force

# Copy built artifacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Persistent storage for the scoreboard. The actual mount is configured by
# the platform (Railway: dashboard → Volumes; Fly: fly.toml [mounts]).
# We just prep the dir and point DATA_DIR at it so scores.ts knows where
# to read/write.
RUN mkdir -p /data && chown -R node:node /data
ENV DATA_DIR=/data

USER node
EXPOSE 3001
WORKDIR /app/server
CMD ["node", "dist/index.js"]
