ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prepare
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune engine --docker

FROM base AS builder
WORKDIR /app
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
RUN cd packages/database && pnpm dlx prisma generate
RUN pnpm --filter engine build
RUN pnpm deploy --filter=engine --prod /prod/engine

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

COPY --from=builder /prod/engine/node_modules ./node_modules
COPY --from=builder /app/apps/engine/dist ./dist
COPY --from=builder /app/apps/engine/package.json ./package.json

CMD ["node", "dist/index.js"]
