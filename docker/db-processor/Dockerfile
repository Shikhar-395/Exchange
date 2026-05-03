ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prepare
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune db-processor --docker

FROM base AS builder
WORKDIR /app
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
RUN pnpm --filter db-processor build
RUN pnpm deploy --filter=db-processor --prod /prod/db-processor

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 db-processor \
 && adduser --system --uid 1001 db-processor
USER db-processor

COPY --from=builder --chown=db-processor:db-processor /prod/db-processor/node_modules ./node_modules
COPY --from=builder --chown=db-processor:db-processor /app/apps/db-processor/dist ./dist
COPY --from=builder --chown=db-processor:db-processor /app/apps/db-processor/package.json ./package.json

CMD ["node", "dist/index.js"]
