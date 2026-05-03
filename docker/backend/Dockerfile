ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prepare
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune backend --docker

FROM base AS builder
WORKDIR /app
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
RUN cd packages/database && pnpm dlx prisma generate
RUN pnpm --filter backend build
RUN pnpm deploy --filter=backend --prod /prod/backend

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 expressjs \
 && adduser --system --uid 1001 expressjs
USER expressjs

COPY --from=builder --chown=expressjs:expressjs /prod/backend/node_modules ./node_modules
COPY --from=builder --chown=expressjs:expressjs /app/apps/backend/dist ./dist
COPY --from=builder --chown=expressjs:expressjs /app/apps/backend/package.json ./package.json

EXPOSE 3001
CMD ["node", "dist/index.js"]
