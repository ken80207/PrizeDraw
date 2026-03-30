# ============================================================
# Multi-stage Dockerfile for the Next.js customer service app
# Build context: project root (for pnpm workspace lockfile)
# ============================================================

FROM node:20-alpine AS base
RUN npm install -g pnpm

# ---- Build Stage ----
FROM base AS builder
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY cs/ ./cs/

WORKDIR /app/cs
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ---- Runtime Stage ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/cs/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/cs/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/cs/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
