# syntax=docker/dockerfile:1
###############################################################################
# Sabse Pehle AI — Web (Next.js) — multi-stage build using `turbo prune` so the
# final image only carries @sabsepehle/web's actual dependency subset.
# Build context MUST be the monorepo root, e.g.:
#   docker build -f apps/web/Dockerfile -t sabsepehle-web .
###############################################################################

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

###############################################################################
FROM base AS pruner
COPY . .
RUN npx turbo prune @sabsepehle/web --docker

###############################################################################
FROM base AS deps
COPY --from=pruner /app/out/json/ .
RUN npm ci

###############################################################################
FROM base AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
COPY turbo.json ./turbo.json

RUN npx turbo run build --filter=@sabsepehle/web

###############################################################################
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/apps/web/public ./apps/web/public
# With `outputFileTracingRoot` correctly set in next.config.ts (pointing at the
# monorepo root), the standalone tracer bundles node_modules at the root (./node_modules)
# while server.js and .next/static stay nested at their workspace-relative path —
# this is the documented, correct Next.js monorepo standalone layout. (Without that
# config, the tracer misdetects the root and silently drops node_modules entirely —
# don't remove it.)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
WORKDIR /app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
