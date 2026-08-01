# syntax=docker/dockerfile:1
###############################################################################
# Sabse Pehle AI — API (NestJS) — multi-stage build using `turbo prune` so the
# final image only carries @sabsepehle/api's actual dependency subset (not the
# whole monorepo's, e.g. Next.js).
# Build context MUST be the monorepo root, e.g.:
#   docker build -f apps/api/Dockerfile -t sabsepehle-api .
###############################################################################

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

###############################################################################
FROM base AS pruner
COPY . .
RUN npx turbo prune @sabsepehle/api --docker

###############################################################################
FROM base AS deps
COPY --from=pruner /app/out/json/ .
RUN npm ci

###############################################################################
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
# out/full has no package-lock.json (only out/json does) — carry it over so the
# `npm ci --omit=dev` prune step below has a lockfile to install from.
COPY --from=pruner /app/out/json/package-lock.json ./package-lock.json
COPY --from=pruner /app/out/full/ .
COPY turbo.json ./turbo.json

RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npx turbo run build --filter=@sabsepehle/api

# Prune devDependencies out, then regenerate the Prisma client — `npm ci` wipes
# node_modules from the lockfile only, which would otherwise drop the generated
# (not lockfile-tracked) .prisma/client output from the step above.
RUN npm ci --omit=dev
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

###############################################################################
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN chmod +x /app/apps/api/docker-entrypoint.sh && chown -R nestjs:nodejs /app

USER nestjs
WORKDIR /app/apps/api
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
