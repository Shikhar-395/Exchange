ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prepare
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune market-maker --docker

FROM base AS builder
WORKDIR /app
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
RUN pnpm --filter market-maker build
RUN pnpm deploy --filter=market-maker --prod /prod/market-maker

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

COPY --from=builder /prod/market-maker/node_modules ./node_modules
COPY --from=builder /app/apps/market-maker/dist ./dist
COPY --from=builder /app/apps/market-maker/package.json ./package.json

CMD ["node", "dist/index.js"]
