# ============================================================
# Multi-stage Dockerfile for the Next.js customer service app
# Build context: project root (for pnpm workspace lockfile)
# ============================================================

FROM node:20-alpine AS base
RUN npm install -g pnpm

# ---- Dependencies Stage ----
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY cs/package.json ./cs/
RUN pnpm install --frozen-lockfile --filter cs

# ---- Builder Stage ----
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/cs/node_modules ./cs/node_modules
COPY cs/ ./cs/

ENV NEXT_TELEMETRY_DISABLED=1

RUN cd cs && pnpm run build

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
