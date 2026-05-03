ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prepare
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune websocket --docker

FROM base AS builder
WORKDIR /app
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
RUN pnpm --filter websocket build
RUN pnpm deploy --filter=websocket --prod /prod/websocket

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

COPY --from=builder /prod/websocket/node_modules ./node_modules
COPY --from=builder /app/apps/websocket/dist ./dist
COPY --from=builder /app/apps/websocket/package.json ./package.json

EXPOSE 3002
CMD ["node", "dist/index.js"]
