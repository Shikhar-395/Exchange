# Exchange — Project Overview

## 1. What This Project Is

Exchange is a full-stack crypto exchange monorepo built as a job-level, systems-heavy project. It implements the core surfaces of a professional trading venue: an authenticated web trading interface, an HTTP API for order and market-data requests, an in-memory matching engine, Redis-backed service communication, WebSocket market-data fanout, TimescaleDB trade persistence, and a market-maker process that seeds and moves liquidity.

The project solves the problem of turning a browser order form into exchange behavior:

1. A user signs in and opens a market such as `SOL_USDC`.
2. The frontend calls the backend REST API to place an order.
3. The backend serializes the command and pushes it into Redis.
4. The matching engine consumes the command, mutates the correct in-memory orderbook, emits database work, and publishes live market streams.
5. The DB processor writes trades into a time-series store.
6. The WebSocket server relays market streams to subscribed clients.
7. The UI updates the depth view, trade-driven chart, market bar, and orderbook display.

It was built as a monorepo because the system has multiple deployable services that share TypeScript contracts. `pnpm` workspaces make local package linking cheap, Turborepo coordinates cross-package build/dev tasks, and shared packages prevent each service from hand-rolling message shapes, auth validation schemas, UI primitives, or TypeScript/ESLint configuration.

The likely users are:

- Developers evaluating or extending a crypto exchange architecture.
- Interviewers or reviewers assessing full-stack/backend systems ability.
- A future team that wants to split responsibilities across API, matching, streaming, persistence, and UI services.
- Local testers who want to run the complete stack with Postgres, Redis, TimescaleDB, WebSocket feeds, and a seeded market maker.

Architecturally, the interesting pieces are:

- `apps/engine/src/trade/orderbook.ts` implements a custom `Orderbook` with `matchBid`, `matchAsk`, partial fills, resting orders, and per-market state.
- `apps/engine/src/trade/engine.ts` owns the command processor, user balances, orderbook registry, snapshots, DB messages, and WebSocket publications.
- Redis is used as both a command queue (`messages`, `db_processor`) and a pub/sub layer (`depth@${market}`, `trade@${market}`, and request/reply `clientId` channels).
- `apps/websocket` is deliberately thin: it tracks client subscriptions and relays Redis pub/sub messages to WebSocket users.
- `apps/db-processor` keeps write-heavy time-series trade persistence outside the latency-sensitive matching path.
- `apps/web` is a Next.js 16 app with a professional exchange-style interface, `lightweight-charts`, depth tables, auth flows, and a singleton WebSocket signaling manager.

Current implementation note: the README and requested architecture use conceptual names like `ORDER_FILLED` and `BOOK_UPDATED`. The current code does not define those literal message constants. It emits persistence messages named `TRADE_ADDED` and `ORDER_UPDATE`, and WebSocket messages with `data.e` values of `"trade"` and `"depth"`.

## 2. High-Level Architecture

```mermaid
flowchart LR
  Browser["Browser / Next.js UI\napps/web"]
  API["Backend API\napps/backend\nExpress + Better Auth"]
  RedisQueue[("Redis list: messages\nAPI -> Engine commands")]
  Engine["Matching Engine\napps/engine\nEngine + Orderbook[]"]
  RedisDbQueue[("Redis list: db_processor\ntrade/order persistence work")]
  RedisPubSub[("Redis pub/sub\ntrade@market, depth@market,\nrequest clientId replies")]
  WS["WebSocket Server\napps/websocket\nws on :3002"]
  DBP["DB Processor\napps/db-processor"]
  Postgres[("Postgres\nPrisma auth + markets")]
  Timescale[("TimescaleDB\ntrades hypertable + klines views")]
  MM["Market Maker\napps/market-maker"]
  Backpack["Backpack public APIs\n/tickers, /openInterest, /marketDataKlines"]

  Browser -- "REST /api/v1/order, /depth, /klines" --> API
  Browser -- "WS SUBSCRIBE/UNSUBSCRIBE" --> WS
  API -- "lPush messages" --> RedisQueue
  RedisQueue -- "rPop messages" --> Engine
  Engine -- "publish clientId response" --> RedisPubSub
  RedisPubSub -- "clientId response" --> API
  API -- "HTTP response" --> Browser
  Engine -- "lPush db_processor" --> RedisDbQueue
  RedisDbQueue -- "rPop db_processor" --> DBP
  DBP -- "INSERT trades" --> Timescale
  API -- "SELECT klines" --> Timescale
  API -- "Prisma auth/markets" --> Postgres
  Engine -- "load active markets" --> Postgres
  Engine -- "publish depth@market/trade@market" --> RedisPubSub
  RedisPubSub -- "subscribed market streams" --> WS
  WS -- "JSON WebSocket messages" --> Browser
  MM -- "REST /api/v1/tickers,/depth,/order/open,/order" --> API
  API -- "market metadata fallback" --> Backpack
```

The primary order path is:

```text
Browser
  -> Backend API
  -> Redis list "messages"
  -> Engine
  -> Redis pub/sub "depth@${market}" and "trade@${market}"
  -> WebSocket server
  -> subscribed browser clients

Engine
  -> Redis list "db_processor"
  -> DB Processor
  -> TimescaleDB
```

The backend is also a synchronous Redis request/reply bridge. `apps/backend/src/redisManager.ts` generates a `randomUUID()` `clientId`, subscribes to that Redis channel, `lPush`es `{ clientId, message }` to `messages`, then resolves the HTTP response when the engine publishes a `MessageFromEngine` back to that `clientId`.

Service communication summary:

| From         | To               | Mechanism           | Actual channel/endpoint                                                                                                    |
| ------------ | ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Browser      | Backend          | HTTP REST           | `/api/v1/order`, `/api/v1/depth`, `/api/v1/klines`, `/api/v1/tickers`, `/api/v1/openInterest`, `/wapi/v1/marketDataKlines` |
| Backend      | Engine           | Redis list queue    | `lPush("messages", JSON.stringify({ clientId, message }))`                                                                 |
| Engine       | Backend          | Redis pub/sub reply | `publish(clientId, MessageFromEngine)`                                                                                     |
| Engine       | DB Processor     | Redis list queue    | `lPush("db_processor", DbMessage)`                                                                                         |
| Engine       | WebSocket Server | Redis pub/sub       | `depth@${market}`, `trade@${market}`                                                                                       |
| Browser      | WebSocket Server | WebSocket           | JSON `SUBSCRIBE` / `UNSUBSCRIBE` messages                                                                                  |
| Backend      | Postgres         | Prisma              | Auth, markets, users, balances, orders schema                                                                              |
| Engine       | Postgres         | Prisma              | Active market load on startup                                                                                              |
| DB Processor | TimescaleDB      | `pg` SQL            | `trades`, `klines_1m`, `klines_1h`, `klines_1w`                                                                            |
| Market Maker | Backend          | HTTP REST           | `/api/v1/tickers`, `/api/v1/depth`, `/api/v1/order/open`, `/api/v1/order`                                                  |

Current implementation note: `apps/web` subscribes to `ticker@${market}` in `Depth`, and `SignalingManager` knows how to handle `data.e === "ticker"`. There is no publisher for `ticker@${market}` in `apps/backend`, `apps/engine`, or `apps/websocket` today.

## 3. Monorepo Structure & Tooling

Top-level shape:

```text
apps/
  backend/           Express API, auth, REST routes, Redis request/reply
  engine/            Matching engine and in-memory orderbooks
  websocket/         Redis pub/sub -> WebSocket relay
  db-processor/      Redis DB queue consumer and Timescale writer
  market-maker/      REST-driven liquidity bot
  web/               Next.js exchange UI
  integration-test/  Vitest + Docker-backed smoke tests

packages/
  common/            Shared message types, constants, schemas, orderbook types
  database/          Prisma client export, schema, migrations, market seed
  email/             Resend/Nodemailer email delivery and OTP template
  ui/                Shared React UI primitives, Tailwind globals, toast
  eslint-config/     Shared ESLint flat configs
  typescript-config/ Shared tsconfig bases

docker/
  backend/
  engine/
  websocket/
  db-processor/
  market-maker/
  web/
  compose-files/
```

### pnpm workspaces

`pnpm-workspace.yaml` defines:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

This lets apps import internal packages through workspace aliases such as `@repo/common`, `@repo/database`, `@repo/email`, `@repo/ui`, `@repo/eslint-config`, and `@repo/typescript-config`.

The root `package.json` declares `packageManager: "pnpm@9.0.0"` and scripts:

| Script             | Meaning                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build`       | Runs `turbo run build` across the monorepo.                                                                                |
| `pnpm dev`         | Runs `turbo run dev`.                                                                                                      |
| `pnpm dev:backend` | Runs dev for `backend`, `engine`, `db-processor`, `market-maker`, and `websocket`. It intentionally excludes the frontend. |
| `pnpm lint`        | Runs `turbo run lint`.                                                                                                     |
| `pnpm check-types` | Runs `turbo run check-types`.                                                                                              |
| `pnpm format`      | Runs Prettier over `**/*.{ts,tsx,md}`.                                                                                     |
| `pnpm prepare`     | Installs Husky hooks.                                                                                                      |

### Turborepo

`turbo.json` defines four tasks:

- `build`: depends on upstream package builds via `^build`, includes `.env*` in inputs, forwards selected env vars, and caches `.next/**` and `dist/**`.
- `lint`: depends on `^lint`.
- `check-types`: depends on `^check-types`.
- `dev`: uncached and persistent, suitable for long-running local services.

The build env list is:

```json
["DATABASE_URL", "PORT", "FRONTEND_URL_DEPLOYED", "SMTP_*", "RESEND_API_KEY"]
```

That matters because Turborepo uses declared env vars as part of task hashing/caching.

### .npmrc

`.npmrc` exists but is empty. It currently does not override pnpm, registry, hoisting, or package resolution behavior.

### Husky

`.husky/pre-commit` runs:

```sh
pnpm prettier --write "**/*.{ts,tsx,md}"
git add -u
```

The hook enforces repository formatting before commits and re-stages modified tracked files. It does not stage newly created untracked files because it uses `git add -u`.

### CI/CD

`.github/workflows/ci.yml` has two jobs:

- `build`: checks out the repo, sets up pnpm 9, sets up Node `24.11.0`, installs with `pnpm install --frozen-lockfile`, generates Prisma client in `packages/database`, then runs `pnpm run build`.
- `integration-test`: checks out the repo, sets up pnpm and Node, installs dependencies, then runs `cd apps/integration-test && pnpm run test:ci`.

`.github/workflows/cd.yml`:

- Uses `dorny/paths-filter` to detect which app/package areas changed.
- Builds and pushes Docker images to `${IMAGE_PREFIX}/*` (for example `ghcr.io/shikhar/exchange/*`).
- Starts auxiliary services on a VM.
- Runs Prisma generate/migrate and seeds Postgres markets.
- Initializes the Timescale schema through `apps/db-processor/src/seedTimescale.ts`.
- Deploys backend, engine, db-processor, websocket, market-maker, and web through `docker-compose-deploy.yml`.

## 4. Every App — Detailed Breakdown

### apps/backend — API Server

`apps/backend` is the Express HTTP API and auth boundary. It owns browser-facing REST endpoints, Better Auth wiring, CORS, auxiliary service startup checks, and the Redis request/reply adapter into the engine.

Why it is separate:

- It isolates HTTP/auth concerns from the latency-sensitive matching engine.
- It gives the frontend and market maker a stable REST surface.
- It converts synchronous HTTP requests into asynchronous Redis commands and waits for engine replies.

Responsibility boundary:

- Owns REST routes, Better Auth routes, CORS, API-level request handling, market-data proxy/enrichment, and Timescale read queries.
- Does not own matching logic, orderbook mutation, WebSocket fanout, or trade writes.
- Does not currently validate order payloads beyond destructuring fields from `req.body`.

Key files:

| File                                                | Purpose                                                                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/index.ts`                         | Express app setup, CORS, Better Auth handler, route mounting, service connectivity checks, `app.listen(process.env.PORT)`, graceful shutdown wiring.                       |
| `apps/backend/src/redisManager.ts`                  | `RedisManager.connect`, `RedisManager.getInstance`, `RedisManager.sendAndAwait`. Pushes engine commands to `messages` and waits on a generated `clientId` pub/sub channel. |
| `apps/backend/src/router/orderRouter.ts`            | `POST /api/v1/order`, `DELETE /api/v1/order`, `GET /api/v1/order/open`.                                                                                                    |
| `apps/backend/src/router/depthRouter.ts`            | `GET /api/v1/depth?symbol=...`, forwards `GET_DEPTH` to engine.                                                                                                            |
| `apps/backend/src/router/klineRouter.ts`            | `GET /api/v1/klines`, queries Timescale `trades` with `time_bucket`.                                                                                                       |
| `apps/backend/src/router/tickerRouter.ts`           | `GET /api/v1/tickers`, fetches Backpack tickers and filters/enriches by Prisma `market`.                                                                                   |
| `apps/backend/src/router/openInterestRouter.ts`     | `GET /api/v1/openInterest`, fetches Backpack open interest and filters by Prisma markets.                                                                                  |
| `apps/backend/src/router/marketDataKlinesRouter.ts` | `GET /wapi/v1/marketDataKlines`, fetches Backpack klines and filters by Prisma markets.                                                                                    |
| `apps/backend/src/router/tradesRouter.ts`           | `GET /api/v1/trades`, currently returns `{}`.                                                                                                                              |
| `apps/backend/src/lib/auth.ts`                      | Better Auth config, Prisma adapter, social providers, email/password, email OTP plugin.                                                                                    |
| `apps/backend/src/middlewares/authMiddleware.ts`    | Reads Better Auth session and sets `req.userId`; used by `/api/v1/todos`.                                                                                                  |
| `apps/backend/src/timescaleClient.ts`               | `pg.Client` configured from `TIMESCALE_*`.                                                                                                                                 |
| `apps/backend/build.mjs`                            | esbuild bundle script for `src/index.ts`.                                                                                                                                  |

REST routes mounted in `index.ts`:

| Route prefix                | Router                   | Current behavior                                               |
| --------------------------- | ------------------------ | -------------------------------------------------------------- |
| `/api/auth/{*any}`          | Better Auth              | Auth endpoints via `toNodeHandler(auth)`.                      |
| `/health`                   | inline                   | Returns `{ "message": "healthy" }`.                            |
| `/error`                    | inline                   | Returns HTTP 400 `{ "message": "error" }`.                     |
| `/api/v1/order`             | `orderRouter`            | Place, cancel, and list open engine orders.                    |
| `/api/v1/depth`             | `depthRouter`            | Request current orderbook depth from engine.                   |
| `/api/v1/trades`            | `tradesRouter`           | Stubbed; returns `{}`.                                         |
| `/api/v1/klines`            | `klineRouter`            | Reads OHLCV-style rows from Timescale trades.                  |
| `/api/v1/tickers`           | `tickersRouter`          | Proxies Backpack tickers filtered by local markets.            |
| `/api/v1/openInterest`      | `openInterestRouter`     | Proxies Backpack open interest filtered by local markets.      |
| `/wapi/v1/marketDataKlines` | `marketDataKlinesRouter` | Proxies Backpack market-data klines filtered by local markets. |

Redis consumed/produced:

- Produces `messages` list entries for the engine.
- Subscribes to per-request `clientId` channels.
- Receives engine replies as `MessageFromEngine`.
- Does not publish market-data streams.

Engine commands sent from routes:

```ts
// POST /api/v1/order
{ type: CREATE_ORDER, data: { market, price, quantity, side, userId } }

// DELETE /api/v1/order
{ type: CANCEL_ORDER, data: { orderId, market } }

// GET /api/v1/order/open
{ type: GET_OPEN_ORDERS, data: { userId, market } }

// GET /api/v1/depth
{ type: GET_DEPTH, data: { market: symbol } }
```

Environment variables:

- `PORT`
- `REDIS_URL`
- `DATABASE_URL`
- `TIMESCALE_USER`
- `TIMESCALE_HOST`
- `TIMESCALE_DATABASE`
- `TIMESCALE_PASSWORD`
- `TIMESCALE_PORT`
- `FRONTEND_URL_DEPLOYED`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`

Start and Docker:

- Local dev: `cd apps/backend && pnpm dev`.
- CI dev: `cd apps/backend && pnpm dev:ci`.
- Build: `cd apps/backend && pnpm build`.
- Start built output: `cd apps/backend && pnpm start`.
- Dockerfile: `docker/backend/Dockerfile` prunes the monorepo for `backend`, installs dependencies, runs Prisma generate, builds with esbuild, deploys production dependencies, copies `dist`, and exposes `3001`.
- Deploy compose currently maps `backend` as `"4001:4001"` while the Dockerfile exposes `3001`; this implies deployed `.env.backend` must set `PORT=4001` or the mapping is mismatched.

### apps/engine — Matching Engine

`apps/engine` is the stateful matching core. It owns active orderbooks, user balances, fund locking, matching, fill creation, DB queue messages, WebSocket market stream publication, and periodic snapshots.

Why it is separate:

- Matching requires isolated, predictable state mutation.
- The API can scale or restart independently from engine memory.
- Engine commands can be serialized through Redis so only this process mutates orderbook state.

Responsibility boundary:

- Owns matching behavior and in-memory balances.
- Loads active markets from Prisma on startup.
- Saves `snapshot.json` every three seconds.
- Does not expose HTTP or WebSocket servers.
- Does not write directly to Timescale or Postgres orders.

Key files:

| File                                 | Purpose                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `apps/engine/src/index.ts`           | Connects Redis, creates `Engine`, calls `engine.init()`, then continuously `rPop`s Redis list `messages`. |
| `apps/engine/src/trade/engine.ts`    | `Engine` class: command processor, balances, snapshots, DB messages, WS publications.                     |
| `apps/engine/src/trade/orderbook.ts` | `Orderbook` class: bids/asks arrays, matching, depth, open orders, cancellation.                          |
| `apps/engine/src/redisManager.ts`    | Engine Redis singleton for `pushMessage`, `publishMessage`, and `sendToApi`.                              |
| `apps/engine/build.mjs`              | esbuild bundle script.                                                                                    |

Important functions:

- `Engine.init()`: loads `snapshot.json` when `WITH_SNAPSHOT` is set and available; otherwise loads active markets from `prisma.market.findMany({ where: { isActive: true } })` and calls `setBaseBalances()`.
- `Engine.process({ message, clientId })`: switches over `CREATE_ORDER`, `CANCEL_ORDER`, `GET_OPEN_ORDERS`, `ON_RAMP`, and `GET_DEPTH`.
- `Engine.createOrder(...)`: checks/locks funds, creates an `Order`, calls `orderbook.addOrder`, updates balances, emits DB messages, publishes depth/trade streams, and returns order placement details.
- `Engine.updateDbOrders(...)`: pushes `ORDER_UPDATE` messages to `db_processor`.
- `Engine.createDbTrades(...)`: pushes `TRADE_ADDED` messages to `db_processor`.
- `Engine.publishWsTrades(...)`: publishes `trade@${market}` messages.
- `Engine.publisWsDepthUpdates(...)`: publishes `depth@${market}` messages after placement/fill. The function name is misspelled in code as `publisWsDepthUpdates`.
- `Engine.sendUpdatedDepthAt(...)`: publishes a single price-level depth update after cancellation.
- `Orderbook.addOrder(...)`: routes to `matchBid` or `matchAsk`, then rests remaining quantity.
- `Orderbook.matchBid(...)`: matches a buy order against asks where `ask.price <= order.price`.
- `Orderbook.matchAsk(...)`: matches a sell order against bids where `bid.price >= order.price`.

Redis consumed/produced:

- Consumes `messages` via `rPop`.
- Publishes request replies to the backend on `clientId`.
- Pushes DB work to `db_processor`.
- Publishes WebSocket streams to `depth@${market}` and `trade@${market}`.

Environment variables:

- `REDIS_URL`
- `DATABASE_URL`
- `SNAPSHOT_DIR`
- `WITH_SNAPSHOT`

Start and Docker:

- Local dev: `cd apps/engine && pnpm dev`.
- Build: `cd apps/engine && pnpm build`.
- Start built output: `cd apps/engine && pnpm start`.
- Dockerfile: `docker/engine/Dockerfile` prunes for `engine`, installs dependencies, runs Prisma generate, builds with esbuild, deploys production dependencies, and starts `node dist/index.js`.
- Deploy compose mounts `engine-data:/app/data`; set `SNAPSHOT_DIR=/app/data` if snapshots should persist in that volume.

### apps/websocket — WebSocket Server

`apps/websocket` accepts browser WebSocket connections, tracks stream subscriptions, subscribes to matching Redis pub/sub channels only when needed, and forwards market data to connected clients.

Why it is separate:

- It decouples long-lived client sockets from the API server.
- It allows the engine to publish one Redis message per stream update while the WS server handles client fanout.
- It can scale independently if subscription state is partitioned or replicated later.

Responsibility boundary:

- Owns client connection lifecycle and subscription routing.
- Does not generate market data.
- Does not query orderbooks or databases.
- Does not authenticate WebSocket users in the current implementation.

Key files:

| File                                        | Purpose                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/websocket/src/index.ts`               | Creates `WebSocketServer({ port: 3002 })` and registers new users.                                      |
| `apps/websocket/src/userManager.ts`         | `UserManager` singleton, assigns UUIDs, stores `User` instances, cleans up on close.                    |
| `apps/websocket/src/user.ts`                | Parses client `SUBSCRIBE` and `UNSUBSCRIBE` messages and emits server messages.                         |
| `apps/websocket/src/subscriptionManager.ts` | Tracks user-to-stream and stream-to-user maps; subscribes/unsubscribes Redis channels; relays messages. |
| `apps/websocket/build.mjs`                  | esbuild bundle script.                                                                                  |

Important functions:

- `UserManager.addUser(ws)`: assigns a `uuidv4()` ID, creates `User`, stores it, and registers close cleanup.
- `User.addListeners()`: handles JSON WebSocket messages.
- `SubscriptionManager.subscribe(userId, subscription)`: tracks subscription and subscribes to Redis when the first user joins a stream.
- `SubscriptionManager.unSubscribe(userId, subscription)`: removes subscription and unsubscribes from Redis when no users remain.
- `SubscriptionManager.redisCallbackHandler(message, channel)`: parses Redis JSON and calls `User.emit` for each user subscribed to the channel.

Redis consumed/produced:

- Consumes Redis pub/sub channels requested by clients, commonly `depth@${market}`, `trade@${market}`, and currently also `ticker@${market}` from the frontend.
- Produces no Redis messages.

Environment variables:

- `REDIS_URL`

Start and Docker:

- Local dev: `cd apps/websocket && pnpm dev`.
- Build: `cd apps/websocket && pnpm build`.
- Start built output: `cd apps/websocket && pnpm start`.
- Dockerfile: `docker/websocket/Dockerfile` prunes for `websocket`, installs dependencies, builds, deploys production dependencies, exposes `3002`, and starts `node dist/index.js`.
- Deploy compose maps `"4002:3002"`.

Current implementation notes:

- `User.unsubscribe` mutates a local `subscriptions` array, but `User.addListeners` does not call it; it delegates to `SubscriptionManager`.
- In `SubscriptionManager.subscribe`, `reverseSubscriptions` uses `(this.subscriptions.get(subscription) || []).concat(userId)` instead of reading the existing reverse list. That is likely a bug, although the simple first-subscriber path still works.
- `UNSUBSCRIBE` loops over params but passes `parsedMessage.params[0]` each time. Multi-param unsubscribe currently unsubscribes the first stream repeatedly.

### apps/db-processor — Trade Persistence Worker

`apps/db-processor` consumes persistence messages from Redis and writes trade rows into TimescaleDB. It also owns Timescale schema initialization and periodic materialized-view refreshes.

Why it is separate:

- Trade persistence can be slower than in-memory matching and should not block order execution.
- Timescale writes and materialized view refreshes are operationally different from matching or WebSocket fanout.
- The engine can emit persistence work and keep processing commands.

Responsibility boundary:

- Owns Timescale writes for trade events.
- Owns Timescale hypertable/materialized-view setup through `seedTimescale.ts`.
- Owns refresh cadence for `klines_1m`, `klines_1h`, and `klines_1w`.
- Does not currently persist `ORDER_UPDATE` messages to the Prisma `order` table.

Key files:

| File                                       | Purpose                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `apps/db-processor/src/index.ts`           | Connects Timescale and Redis, starts cron refreshes, continuously `rPop`s `db_processor`, inserts `TRADE_ADDED` rows. |
| `apps/db-processor/src/timescaleClient.ts` | `pg.Client` from `TIMESCALE_*`.                                                                                       |
| `apps/db-processor/src/seedTimescale.ts`   | Creates `trades` hypertable, market-time index, and `klines_1m`, `klines_1h`, `klines_1w` materialized views.         |
| `apps/db-processor/src/cron.ts`            | Refreshes materialized views on intervals.                                                                            |
| `apps/db-processor/build.mjs`              | esbuild bundle script.                                                                                                |

Redis consumed/produced:

- Consumes `db_processor` via `rPop`.
- Handles `DbMessage` entries where `data.type === "TRADE_ADDED"`.
- Ignores `ORDER_UPDATE` messages in the current implementation.
- Produces no Redis messages.

Timescale insert:

```sql
INSERT INTO trades (time, market, price, quantity, quote_quantity)
VALUES ($1, $2, $3, $4, $5)
```

Environment variables:

- `REDIS_URL`
- `TIMESCALE_USER`
- `TIMESCALE_HOST`
- `TIMESCALE_DATABASE`
- `TIMESCALE_PASSWORD`
- `TIMESCALE_PORT`
- `DATABASE_URL` for `seedTimescale.ts`, because it reads active markets from Prisma before creating Timescale structures.

Start and Docker:

- Local dev: `cd apps/db-processor && pnpm dev`.
- Timescale setup: `cd apps/db-processor && pnpm seed`.
- Cron only: `cd apps/db-processor && pnpm cron`.
- Build: `cd apps/db-processor && pnpm build`.
- Start built output: `cd apps/db-processor && pnpm start`.
- Dockerfile: `docker/db-processor/Dockerfile` prunes for `db-processor`, installs dependencies, builds with esbuild, deploys production dependencies, creates a non-root user, and starts `node dist/index.js`.

### apps/market-maker — Liquidity Bot

`apps/market-maker` is a REST-driven liquidity seeding bot. It does not talk to Redis directly. It behaves like an external client by calling backend endpoints, reading tickers/depth/open orders, placing taker orders when local prices drift, and maintaining a ladder of maker bids/asks.

Why it is separate:

- It simulates external exchange activity without polluting the engine.
- It can be run, stopped, tuned, or redeployed independently.
- It exercises the same public API path as real clients.

Responsibility boundary:

- Owns strategy and order placement/cancellation loops.
- Does not own matching or balances.
- Does not manage markets directly; it discovers them through `/api/v1/tickers`.

Key file:

| File                             | Purpose                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/market-maker/src/index.ts` | Full market-making strategy, ticker refresh, target price ramping, depth/open-order fetches, order placement/cancellation, per-market loops. |
| `apps/market-maker/build.mjs`    | esbuild bundle script.                                                                                                                       |

Strategy constants in `index.ts`:

| Constant                |    Value | Meaning                                              |
| ----------------------- | -------: | ---------------------------------------------------- |
| `TICK_MS`               |    `200` | Base per-market loop delay.                          |
| `REAL_PRICE_REFRESH_MS` | `60_000` | Refresh cadence for upstream/reference prices.       |
| `RAMP_WINDOW_MS`        | `60_000` | Smooth target price transitions over one minute.     |
| `LADDER_LEVELS`         |      `8` | Number of maker levels on each side.                 |
| `LADDER_SPREAD_BPS`     |     `25` | Total spread basis points around target.             |
| `STALE_BPS`             |     `60` | Cancel orders too far from target.                   |
| `TAKER_MAX_QTY`         |    `0.5` | Maximum taker order quantity.                        |
| `TAKER_MIN_QTY`         |   `0.05` | Minimum taker order quantity.                        |
| `MAKER_QTY`             |      `1` | Base maker quantity.                                 |
| `DEFAULT_PRICE`         |    `100` | Fallback target when no external price is available. |

Important functions:

- `fetchTickers()`: calls `${BASE_URL}/api/v1/tickers`.
- `refreshRealPrices()`: builds a symbol-to-price map and maintains ramp snapshots.
- `targetFor(symbol)`: returns the current ramped target price.
- `getDepth(market)`: calls `/api/v1/depth?symbol=${market}`.
- `getOpenOrders(market)`: calls `/api/v1/order/open?userId=${USER_ID}&market=${market}`.
- `placeOrder(market, side, price, quantity)`: posts to `/api/v1/order`.
- `cancelOrder(market, orderId)`: deletes `/api/v1/order`.
- `tickMarket(market)`: cancels stale/wrong-side orders, optionally sends taker pressure, and refreshes a bid/ask ladder around target.
- `startMarketLoop(market)`: schedules continuous market ticks.

Environment variables:

- `BASE_URL`, defaulting to `http://localhost:3001`.
- `MARKET_MAKER_USER_ID`, defaulting to `"5"`.

Start and Docker:

- Local dev: `cd apps/market-maker && pnpm dev`.
- Build: `cd apps/market-maker && pnpm build`.
- Start built output: `cd apps/market-maker && pnpm start`.
- Dockerfile: `docker/market-maker/Dockerfile` prunes for `market-maker`, installs dependencies, builds with esbuild, deploys production dependencies, and starts `node dist/index.js`.
- Deploy compose starts it after `backend`.

### apps/web — Next.js Frontend

`apps/web` is the browser trading interface. It uses Next.js App Router, React 19, Better Auth client, React Query, Jotai, shared `@repo/ui` components, `lightweight-charts`, and a singleton WebSocket manager.

Why it is separate:

- It is independently deployable as a Next.js app.
- It consumes the exchange through public HTTP/WebSocket interfaces.
- It can evolve UI, auth, and charting without touching backend services.

Responsibility boundary:

- Owns pages, client-side auth UI, market list UI, chart/depth/order form, WebSocket subscriptions, and API client helpers.
- Does not implement matching logic.
- Does not directly talk to Redis, Postgres, or Timescale.

Key files:

| File                                         | Purpose                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/web/app/layout.tsx`                    | Root layout, local Geist fonts, global CSS, `Providers`, `Navbar`.                                           |
| `apps/web/app/page.tsx`                      | Home page that renders `Markets`.                                                                            |
| `apps/web/app/markets/page.tsx`              | Markets page that renders `Markets`.                                                                         |
| `apps/web/app/trade/[market]/page.tsx`       | Auth-gated trading page with `MarketBar`, `TradeView`, `Depth`, `BottomDashboardMock`, and `SwapUI`.         |
| `apps/web/app/components/Markets.tsx`        | Market table, category filter, Backpack coin icons, open interest, sparkline data.                           |
| `apps/web/app/components/MarketBar.tsx`      | Header for selected market, ticker display, trade stream subscription for latest price.                      |
| `apps/web/app/components/TradeView.tsx`      | Candle chart container, interval controls, historical kline fetch, live trade updates.                       |
| `apps/web/app/components/SwapUI.tsx`         | Buy/sell order form, limit/market tab UI, `createOrder` call.                                                |
| `apps/web/app/components/depth/Depth.tsx`    | Initial depth fetch, depth/trade/ticker subscriptions, book update application.                              |
| `apps/web/app/components/depth/AskTable.tsx` | Ask side rendering with cumulative total shading.                                                            |
| `apps/web/app/components/depth/BidTable.tsx` | Bid side rendering with cumulative total shading.                                                            |
| `apps/web/app/utils/httpClient.ts`           | REST client helpers for tickers, depth, trades, klines, open interest, marketDataKlines, and order creation. |
| `apps/web/app/utils/SignalingManager.ts`     | Singleton WebSocket manager, reconnect logic, subscription reference counts, callback registry.              |
| `apps/web/app/utils/ChartManager.ts`         | `lightweight-charts` wrapper for candlesticks, volume, live trade updates, and interval bucket changes.      |
| `apps/web/app/utils/types.ts`                | Frontend market-data interfaces.                                                                             |
| `apps/web/lib/auth.ts`                       | Better Auth React client with email OTP plugin.                                                              |
| `apps/web/lib/util.ts`                       | `getBackendUrl()`, derived from `NEXT_PUBLIC_BACKEND_URL` or `NEXT_PUBLIC_EXCHANGE_API_URL`.                 |
| `apps/web/components/*`                      | Auth pages, navbar, user menu, providers, social auth, OTP dialog, theme toggle.                             |
| `apps/web/next.config.js`                    | Next config; transpiles `@repo/ui`, emits standalone output.                                                 |

Frontend data flow:

- `httpClient.ts` uses `NEXT_PUBLIC_EXCHANGE_API_URL` or falls back to `http://localhost:3000/api/v1`.
- `SignalingManager.ts` uses `NEXT_PUBLIC_EXCHANGE_WS_URL` or falls back to `ws://localhost:3002`.
- `TradeView` fetches `/api/v1/klines` and subscribes to `trade@${market}`; `ChartManager.updatePrice` mutates the current candle as trades arrive.
- `Depth` fetches `/api/v1/depth`, subscribes to `depth@${market}`, `trade@${market}`, and `ticker@${market}`, then merges incremental price-level updates through `applyUpdates`.
- `SwapUI` calls `createOrder`, which posts to `/api/v1/order`.

Environment variables:

- `NEXT_PUBLIC_BACKEND_URL`
- `SERVER_BACKEND_URL`
- `NEXT_PUBLIC_EXCHANGE_API_URL`
- `NEXT_PUBLIC_EXCHANGE_WS_URL`

Start and Docker:

- Local dev: `cd apps/web && pnpm dev` on port `3000`.
- Build: `cd apps/web && pnpm build`.
- Start built output: `cd apps/web && pnpm start`.
- Dockerfile: `docker/web/Dockerfile` prunes for `web`, accepts build args `NEXT_PUBLIC_EXCHANGE_API_URL` and `NEXT_PUBLIC_EXCHANGE_WS_URL`, builds Next standalone output, creates a non-root `nextjs` user, and starts `node apps/web/server.js`.
- Deploy compose maps `"4000:3000"` and builds with env-configured `NEXT_PUBLIC_EXCHANGE_API_URL` and `NEXT_PUBLIC_EXCHANGE_WS_URL` values, defaulting to the `shikhar.site` subdomains in the sample config.

Current implementation notes:

- The UI has `type: "limit" | "market"` state in `SwapUI`, but `placeOrder()` always sends the same payload shape. Market mode disables the price input, so it can submit an empty `price`, but the engine still converts `price` with `Number(price)` and does not have market-order semantics.
- `getTrades(market)` calls `/api/v1/trades?symbol=${market}`, but the backend route destructures `market` and returns `{}` today.
- `getBackendUrl()` prefers `NEXT_PUBLIC_BACKEND_URL` and otherwise derives the backend origin from `NEXT_PUBLIC_EXCHANGE_API_URL`.
- `apps/web/README.md` is default Next.js boilerplate.
- `apps/web/public/*.svg`, `favicon.ico`, and `app/fonts/*.woff` are static boilerplate/assets.

### apps/integration-test — Integration Smoke Tests

`apps/integration-test` is a Vitest-based smoke test app for backend health/error endpoints. It uses Docker Compose to start a Postgres test database, runs Prisma migration/generation, starts the backend, waits for readiness, then runs tests.

Why it is separate:

- Integration tests have their own dependencies and scripts.
- The app can be run from CI without mixing test scaffolding into service apps.

Responsibility boundary:

- Owns test orchestration and HTTP assertions.
- Does not test engine matching, Redis, WebSocket, Timescale, or frontend behavior yet.

Key files:

| File                                                       | Purpose                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/integration-test/src/index.test.ts`                  | Vitest tests for `/health` and `/error`.                                     |
| `apps/integration-test/src/lib/utils.ts`                   | Axios wrapper that converts failed responses into resolved `error.response`. |
| `apps/integration-test/src/scripts/run-integration.sh`     | Local integration script using app `.env` files.                             |
| `apps/integration-test/src/scripts/run-integration-ci.sh`  | CI integration script with inline `PORT=3001` and `DATABASE_URL`.            |
| `apps/integration-test/src/scripts/wait-for-it.sh`         | TCP wait helper script.                                                      |
| `docker/compose-files/docker-compose-integration-test.yml` | Starts only Postgres for integration tests.                                  |

Environment variables:

- `BACKEND_URL`, defaulting to `http://localhost:3001`.
- The scripts also use `PORT` and `DATABASE_URL`.

Start:

- Local: `cd apps/integration-test && pnpm test`.
- CI: `cd apps/integration-test && pnpm test:ci`.

## 5. Every Package — Detailed Breakdown

### packages/common

`@repo/common` owns cross-service constants, Redis message types, WebSocket message types, auth validation schemas, and orderbook primitives.

Exports from `package.json`:

| Export                        | File                    | Purpose                                                                                                                   |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@repo/common/zodTypes`       | `src/zodTypes.ts`       | Auth form schemas and inferred types.                                                                                     |
| `@repo/common/engineMessages` | `src/engineMessages.ts` | `MessageToEngine`, `MessageFromEngine`.                                                                                   |
| `@repo/common/dbMessages`     | `src/dbMessages.ts`     | `DbMessage`.                                                                                                              |
| `@repo/common/wsMessages`     | `src/wsMessages.ts`     | `IncomingMessage`, `WsMessage`, `DepthUpdateMessage`, `TradeAddedMessage`, `TickerUpdateMessage`.                         |
| `@repo/common/consts`         | `src/consts.ts`         | Shared string constants like `CREATE_ORDER`, `CANCEL_ORDER`, `GET_DEPTH`, `TRADE_ADDED`, `ORDER_UPDATE`, `BASE_CURRENCY`. |
| `@repo/common/orderbook`      | `src/orderbook.ts`      | `Order` and `Fill` interfaces.                                                                                            |

Key constants:

```ts
CREATE_ORDER = "CREATE_ORDER";
CANCEL_ORDER = "CANCEL_ORDER";
ON_RAMP = "ON_RAMP";
GET_OPEN_ORDERS = "GET_OPEN_ORDERS";
GET_DEPTH = "GET_DEPTH";
TRADE_ADDED = "TRADE_ADDED";
ORDER_UPDATE = "ORDER_UPDATE";
BASE_CURRENCY = "USDC";
```

Apps depending on it:

- `backend`: engine command constants/types, auth validation schemas through frontend usage, shared types.
- `engine`: message constants, `MessageToEngine`, `Order`, `Fill`, DB/WS message types.
- `websocket`: `IncomingMessage`, `SUBSCRIBE`, `UNSUBSCRIBE`, `WsMessage`.
- `db-processor`: `DbMessage`.
- `web`: `zodTypes` for auth forms through `@repo/common/zodTypes`.

Why it is shared:

- Message contracts must match across API, engine, DB worker, and WebSocket relay.
- Duplicating event names like `CREATE_ORDER` or stream shapes would make service boundaries brittle.

### packages/database

`@repo/database` owns Prisma configuration, schema, migrations, market seed data, and the exported Prisma client.

Export:

| Export                  | File           | Purpose                                                                        |
| ----------------------- | -------------- | ------------------------------------------------------------------------------ |
| `@repo/database/client` | `src/index.ts` | Creates `PrismaClient` with `PrismaPg` adapter and `process.env.DATABASE_URL`. |

Prisma models:

- `User`
- `Session`
- `Account`
- `Verification`
- `Market`
- `UserBalance`
- `OnrampTransaction`
- `Order`

Enums:

- `MarketCategory`: `SPOT`, `FUTURES`
- `OnrampStatus`: `PENDING`, `COMPLETED`, `FAILED`
- `OrderSide`: `BUY`, `SELL`
- `OrderType`: `LIMIT`, `MARKET`
- `OrderStatus`: `OPEN`, `PARTIALLY_FILLED`, `FILLED`, `CANCELLED`

Key files:

| File                                                  | Purpose                                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/database/prisma/schema.prisma`              | Canonical Prisma schema.                                                                                   |
| `packages/database/prisma/migrations/*/migration.sql` | Database migrations for auth, verification uniqueness, markets, balances, onramp transactions, and orders. |
| `packages/database/src/index.ts`                      | Prisma client export.                                                                                      |
| `packages/database/src/seed.ts`                       | Seeds 30 active markets: 15 base assets, each with spot and perpetual `USDC` symbols.                      |
| `packages/database/prisma.config.ts`                  | Prisma config and migration seed hook.                                                                     |

Apps depending on it:

- `backend`: Better Auth Prisma adapter, market filtering, market data enrichment, startup DB connectivity check.
- `engine`: active market load on startup.
- `db-processor`: `seedTimescale.ts` reads active markets before initializing Timescale.

Why it is shared:

- The API and engine need the same canonical market list.
- Auth tables and market metadata need one schema source.
- Prisma client generation belongs at package level rather than inside one app.

### packages/email

`@repo/email` owns email transport selection and React email templates for auth OTP flows.

Exports:

| Export                   | File                       | Purpose                                      |
| ------------------------ | -------------------------- | -------------------------------------------- |
| `@repo/email/email`      | `src/index.ts`             | `initEmail`, `sendEmail`, `EmailConfig`.     |
| `@repo/email/exchange/*` | `src/emailTemplates/*.tsx` | React email templates such as `OtpTemplate`. |

Key files:

| File                                                | Purpose                                                      |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `packages/email/src/index.ts`                       | Initializes Resend or Nodemailer and dispatches `sendEmail`. |
| `packages/email/src/sendViaResend.ts`               | Sends via Resend.                                            |
| `packages/email/src/sendViaNodemailer.ts`           | Renders React email to HTML and sends through SMTP.          |
| `packages/email/src/resend/types.ts`                | `ResendEmailOptions`, `NodemailerInput`.                     |
| `packages/email/src/emailTemplates/OtpTemplate.tsx` | OTP email template.                                          |

Apps depending on it:

- `backend`: initializes email delivery and sends verification/reset OTP through Better Auth plugin.

Why it is shared:

- Auth email logic is infrastructure-like and should not be mixed into route handlers.
- The package can support more transactional templates without growing the backend app.

Current implementation note: `OtpTemplate` copy says `Codeforces`, not `Exchange`, and the email subject in `backend/src/lib/auth.ts` is `"otp vefirication"`.

### packages/ui

`@repo/ui` owns shared React UI primitives, Tailwind globals, toast export, and shadcn-style component configuration.

Exports:

| Export                    | File                     | Purpose                                                   |
| ------------------------- | ------------------------ | --------------------------------------------------------- |
| `@repo/ui/globals.css`    | `src/styles/globals.css` | Tailwind v4 globals, design tokens, auth theme variables. |
| `@repo/ui/postcss.config` | `postcss.config.mjs`     | Shared Tailwind PostCSS config.                           |
| `@repo/ui/lib/*`          | `src/lib/*.ts`           | `cn`, `toast`.                                            |
| `@repo/ui/components/*`   | `src/components/*.tsx`   | UI primitives.                                            |
| `@repo/ui/hooks/*`        | `src/hooks/*.ts`         | Hook export path exists; currently only `.gitkeep`.       |

Components:

- `Button`
- `Input`
- `Label`
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`
- `DropdownMenu` family
- `OtpInput`
- `Toaster`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`

Apps depending on it:

- `web`: all app UI/auth primitives, `toast`, `cn`, global CSS.

Why it is shared:

- The frontend app and future React packages can share consistent UI primitives.
- It keeps design tokens and shadcn-style components versioned with the monorepo.

### packages/eslint-config

`@repo/eslint-config` owns shared ESLint flat config.

Exports:

| Export                               | File                | Purpose                                                                                                    |
| ------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@repo/eslint-config/base`           | `base.js`           | JS recommended, TypeScript recommended, Prettier, Turbo env-var rule, only-warn plugin, ignores `dist/**`. |
| `@repo/eslint-config/next-js`        | `next.js`           | Base config plus Next, React, React Hooks, browser/serviceworker globals, `.next` ignores.                 |
| `@repo/eslint-config/react-internal` | `react-internal.js` | Base config plus React and React Hooks for internal React packages.                                        |

Apps/packages depending on it:

- `web`: imports `nextJsConfig`.
- `ui`: imports `react-internal`.

Why it is shared:

- It centralizes lint policy for Next and React library packages.
- It avoids copy/pasting flat config across apps.

### packages/typescript-config

`@repo/typescript-config` owns shared TypeScript base configs.

Files:

| File                 | Purpose                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `base.json`          | Strict ES2022 NodeNext-oriented base with declarations, `noUncheckedIndexedAccess`, `isolatedModules`, DOM libs, and `skipLibCheck`. |
| `nextjs.json`        | Extends base for Next: `module` ESNext, Bundler resolution, `allowJs`, `jsx: preserve`, `noEmit`, Next plugin.                       |
| `react-library.json` | Extends base and sets `jsx: react-jsx`.                                                                                              |

Apps/packages depending on it:

- All TypeScript apps and packages extend one of these configs.

Why it is shared:

- It keeps compiler behavior consistent across services.
- It lets apps override module mode or JSX behavior only where necessary.

## 6. Order Lifecycle — Full End-to-End Workflow

### LIMIT BUY order in the current code

```mermaid
sequenceDiagram
  participant U as Browser / SwapUI
  participant A as Backend / orderRouter
  participant R as Redis
  participant E as Engine
  participant OB as Orderbook
  participant D as DB Processor
  participant T as TimescaleDB
  participant W as WebSocket Server
  participant C as Subscribed Clients

  U->>A: POST /api/v1/order { market, price, quantity, side:"buy", userId }
  A->>R: SUBSCRIBE clientId
  A->>R: LPUSH messages { clientId, message: CREATE_ORDER }
  E->>R: RPOP messages
  E->>E: Engine.process(CREATE_ORDER)
  E->>E: checkAndLockFunds(...)
  E->>OB: Orderbook.addOrder(order)
  OB->>OB: matchBid(order)
  OB-->>E: { executedQty, fills }
  E->>E: updateBalance(...)
  E->>R: LPUSH db_processor TRADE_ADDED per fill
  E->>R: LPUSH db_processor ORDER_UPDATE
  E->>R: PUBLISH depth@market { e:"depth", a, b }
  E->>R: PUBLISH trade@market { e:"trade", t, m, p, q, s }
  E->>R: PUBLISH clientId ORDER_PLACED
  R-->>A: clientId reply
  A-->>U: HTTP JSON { orderId, executedQty, fills }
  D->>R: RPOP db_processor
  D->>T: INSERT INTO trades(...)
  W->>R: SUBSCRIBE depth@market/trade@market
  R-->>W: stream message
  W-->>C: WebSocket JSON
```

Step by step:

1. `apps/web/app/components/SwapUI.tsx` gathers `market`, `price`, `quantity`, `side`, and `session.user.id`.
2. `createOrder` in `apps/web/app/utils/httpClient.ts` posts to `${BASE_URL}/order`, where `BASE_URL` is `NEXT_PUBLIC_EXCHANGE_API_URL` or `http://localhost:3000/api/v1`.
3. `orderRouter.post("/")` in `apps/backend/src/router/orderRouter.ts` destructures `{ market, price, quantity, side, userId }`.
4. The route calls `RedisManager.getInstance().sendAndAwait({ type: CREATE_ORDER, data: ... })`.
5. `RedisManager.sendAndAwait` creates a `clientId` with `randomUUID()`, subscribes to that Redis channel, and pushes this JSON to the `messages` list:

   ```json
   {
     "clientId": "<uuid>",
     "message": {
       "type": "CREATE_ORDER",
       "data": {
         "market": "SOL_USDC",
         "price": "100.00",
         "quantity": "1.000",
         "side": "buy",
         "userId": "<user-id>"
       }
     }
   }
   ```

6. `apps/engine/src/index.ts` continuously calls `redisClient.rPop("messages")`. If no message exists, it sleeps for 100 ms.
7. The engine parses the JSON and calls `engine.process(JSON.parse(response))`.
8. `Engine.process` sees `CREATE_ORDER` and calls `Engine.createOrder`.
9. `Engine.createOrder` finds the `Orderbook` whose `ticker()` equals `market`.
10. The engine calls `checkAndLockFunds(baseAsset, quoteAsset, side, userId, price, quantity)`.
11. For a buy order, `checkAndLockFunds` requires `Number(quantity) * Number(price)` of the quote asset, typically `USDC`. It subtracts that amount from `available` and adds it to `locked`.
12. The engine creates an `Order`:

    ```ts
    {
      price: Number(price),
      quantity: Number(quantity),
      orderId: Math.random().toString(36)...,
      filled: 0,
      side: "buy",
      userId
    }
    ```

13. The engine calls `orderbook.addOrder(order)`.
14. Because the side is `"buy"`, `Orderbook.addOrder` calls `matchBid(order)`.
15. `matchBid` loops over `this.asks` in array order and matches every ask where `ask.price <= order.price` while `executedQty < order.quantity`.
16. For each matched ask, it computes:

    ```ts
    const filledQty = Math.min(order.quantity - executedQty, ask.quantity);
    ```

17. It increments `executedQty`, increments `ask.filled`, and appends a `Fill`:

    ```ts
    {
      price: ask.price.toString(),
      qty: filledQty,
      tradeId: this.lastTradeId++,
      otherUserId: ask.userId,
      markerOrderId: ask.orderId
    }
    ```

18. After looping, `matchBid` removes fully filled asks with:

    ```ts
    this.asks = this.asks.filter((a) => a.filled < a.quantity);
    ```

19. `Orderbook.addOrder` sets `order.filled = executedQty`. If `executedQty !== order.quantity`, it pushes the remaining order into `this.bids`.
20. `Engine.updateBalance` moves assets between the taker and maker users according to fill side.
21. `Engine.createDbTrades` pushes one `TRADE_ADDED` message to `db_processor` for each fill.
22. `Engine.updateDbOrders` pushes one `ORDER_UPDATE` for the taker order and one `ORDER_UPDATE` for each maker order touched by a fill.
23. `Engine.publisWsDepthUpdates` publishes a `depth@${market}` message showing changed asks and the new/changed bid level.
24. `Engine.publishWsTrades` publishes one `trade@${market}` message per fill.
25. `RedisManager.sendToApi(clientId, { type: "ORDER_PLACED", payload: ... })` publishes the synchronous response back to the backend.
26. The backend unsubscribes from `clientId` and responds to the HTTP request with:

    ```ts
    {
      orderId: string,
      executedQty: number,
      fills: { price: string; qty: number; tradeId: number }[]
    }
    ```

27. `apps/db-processor/src/index.ts` consumes `db_processor`. For `TRADE_ADDED`, it inserts into Timescale `trades`.
28. `apps/websocket/src/subscriptionManager.ts` receives Redis pub/sub events for subscribed streams and calls `User.emit`.
29. `SignalingManager` in the frontend receives messages and dispatches callbacks by `message.data.e`.
30. `Depth` applies `depth` updates with `applyUpdates`; `TradeView` uses `ChartManager.updatePrice` for `trade` messages; `MarketBar` updates latest price from `trade` messages.

Result variants:

- Full fill: `executedQty === order.quantity`; the taker order does not rest on the book.
- Partial fill: `executedQty > 0` and `< order.quantity`; the remaining quantity rests on `bids` with `filled` set to the executed amount.
- No fill: `executedQty === 0`; the full order rests on `bids`.
- Error: if no orderbook exists or funds are insufficient, the engine currently sends a fallback `ORDER_CANCELLED` response with empty order details.

### What differs for a MARKET ORDER

In the current code, there is no true market-order execution path.

Implemented today:

- Prisma has an `OrderType` enum with `LIMIT` and `MARKET`.
- `apps/web/app/components/SwapUI.tsx` has UI state `type: "limit" | "market"`.
- When `type === "market"`, the price field is disabled.

Not implemented today:

- `MessageToEngine` has no `type` field for order type inside `CREATE_ORDER.data`.
- `orderRouter.post("/")` does not read an order type.
- `Engine.createOrder` requires `price` and converts it with `Number(price)`.
- `Orderbook.matchBid` and `Orderbook.matchAsk` compare against the submitted limit price.
- The engine does not implement sweep-until-quantity behavior, price protection, quote-size market buys, or no-resting behavior for market orders.

If the UI submits a market order with an empty price, the current engine receives `price: ""`, converts it to `0`, and treats it like a limit order at price `0`. For a buy, that will generally fail to match asks and may rest as a bid at `0` if fund locking allows it. For a sell, it may match any bid with `bid.price >= 0`.

The intended market-order behavior would be:

- Buy market: consume asks from best ask upward until quantity is filled or asks are exhausted; never rest remainder.
- Sell market: consume bids from best bid downward until quantity is filled or bids are exhausted; never rest remainder.
- Emit the same persistence and stream events as limit fills.

That behavior is not in this repository yet.

## 7. The Orderbook & Matching Engine — Deep Dive

### Orderbook data structures

`apps/engine/src/trade/orderbook.ts` stores orders in plain arrays:

```ts
export class Orderbook {
  bids: Order[];
  asks: Order[];
  market: string;
  baseAsset: string;
  quoteAsset: string;
  lastTradeId: number;
  currentPrice: number;
}
```

Shared `Order` type from `packages/common/src/orderbook.ts`:

```ts
export interface Order {
  price: number;
  quantity: number;
  orderId: string;
  filled: number;
  side: "buy" | "sell";
  userId: string;
}
```

Shared `Fill` type:

```ts
export interface Fill {
  price: string;
  qty: number;
  tradeId: number;
  otherUserId: string;
  markerOrderId: string;
}
```

There is no sorted map, heap, tree, skip list, or price-level queue. `bids` and `asks` are arrays, and matching loops over the arrays in their current insertion order.

### Price-time priority

The current code enforces price eligibility but does not fully enforce professional price-time priority:

- `matchBid` only matches asks where `ask.price <= order.price`.
- `matchAsk` only matches bids where `bid.price >= order.price`.
- Within the eligible side, orders are visited in array order.
- New resting orders are appended with `this.bids.push(order)` or `this.asks.push(order)`.
- The arrays are not sorted by price before matching.

That means time priority is preserved only among orders that happen to be in array order, but best-price priority is not guaranteed if a worse price was inserted before a better price.

The frontend sorts depth rows for display in `Depth.applyUpdates`, but that does not affect engine matching order.

### Partial fills

Partial fills happen inside `matchBid` and `matchAsk`:

```ts
const filledQty = Math.min(order.quantity - executedQty, ask.quantity);
executedQty += filledQty;
ask.filled += filledQty;
```

For sell-side matching:

```ts
const amountRemaining = Math.min(order.quantity - executedQty, bid.quantity);
executedQty += amountRemaining;
bid.filled += amountRemaining;
```

Current implementation note: both functions compare the incoming order's remaining size against `ask.quantity` or `bid.quantity`, not `ask.quantity - ask.filled` or `bid.quantity - bid.filled`. Because partially filled resting orders remain in the array with `filled > 0`, a later match can over-count available quantity. A robust implementation should use the resting order's remaining quantity.

### Resting remainder

After matching:

- A buy order rests on `bids` if `executedQty !== order.quantity`.
- A sell order rests on `asks` if `executedQty !== order.quantity`.
- The order stores total original `quantity` and cumulative `filled`.
- `getOpenOrders(userId)` returns all ask and bid orders for the user without subtracting filled quantity.

### Depth calculation

`Orderbook.getDepth()` aggregates by price:

```ts
const bidsObj: { [key: string]: number } = {};
const asksObj: { [key: string]: number } = {};

for (const order of this.bids) {
  bidsObj[order.price] = (bidsObj[order.price] ?? 0) + order.quantity;
}
for (const order of this.asks) {
  asksObj[order.price] = (asksObj[order.price] ?? 0) + order.quantity;
}
```

Current implementation note: depth sums `order.quantity`, not `order.quantity - order.filled`, so partially filled resting orders can display too much remaining size.

### Cancellation

`Engine.process(CANCEL_ORDER)`:

1. Finds the orderbook by market.
2. Finds the order in `asks` or `bids`.
3. Calls `cancelBid(order)` or `cancelAsk(order)`.
4. Unlocks remaining funds:
   - Buy: `(order.quantity - order.filled) * order.price` quote asset.
   - Sell: `order.quantity - order.filled` base asset.
5. Publishes a price-level depth update through `sendUpdatedDepthAt`.
6. Replies to API with `ORDER_CANCELLED`.

### Events emitted

Engine -> API reply types from `MessageFromEngine`:

```ts
type MessageFromEngine =
  | {
      type: "DEPTH";
      payload: {
        market: string;
        bids: [string, string][];
        asks: [string, string][];
      };
    }
  | {
      type: "ORDER_PLACED";
      payload: {
        orderId: string;
        executedQty: number;
        fills: { price: string; qty: number; tradeId: number }[];
      };
    }
  | {
      type: "ORDER_CANCELLED";
      payload: { orderId: string; executedQty: number; remainingQty: number };
    }
  | {
      type: "OPEN_ORDERS";
      payload: {
        orderId: string;
        executedQty: number;
        price: string;
        quantity: string;
        side: "buy" | "sell";
        userId: string;
      }[];
    };
```

Engine -> DB queue type from `DbMessage`:

```ts
{
  type: "TRADE_ADDED";
  data: {
    id: string;
    isBuyerMaker: boolean;
    price: string;
    quantity: string;
    quoteQuantity: string;
    timestamp: number;
    market: string;
  }
}
```

Engine also pushes:

```ts
{
  type: "ORDER_UPDATE";
  data: {
    orderId: string;
    executedQty: number;
    market?: string;
    price?: string;
    quantity?: string;
    side?: "buy" | "sell";
  };
}
```

Current implementation note: `ORDER_UPDATE` is pushed but not consumed by `apps/db-processor/src/index.ts`.

Engine -> WebSocket trade stream:

```ts
{
  stream: `trade@${market}`,
  data: {
    e: "trade",
    t: fill.tradeId,
    m: fill.otherUserId === userId,
    p: fill.price,
    q: fill.qty.toString(),
    s: market
  }
}
```

Engine -> WebSocket depth stream:

```ts
{
  stream: `depth@${market}`,
  data: {
    a: [/* changed asks */],
    b: [/* changed bids */],
    e: "depth"
  }
}
```

### Multiple markets

`Engine.init()` creates one `Orderbook` per active Prisma `Market`:

```ts
const markets = await prisma.market.findMany({
  where: { isActive: true },
  select: { symbol: true },
});

this.orderbooks = markets.map((m) => new Orderbook(m.symbol, [], [], 0, 0));
```

When processing commands, the engine routes by market symbol:

```ts
const orderbook = this.orderbooks.find((o) => o.ticker() === market);
```

This is concurrency-safe only in the sense that one Node.js process handles one command at a time from the Redis polling loop. There is no sharding, lock manager, or multi-engine coordination.

## 8. Redis Usage — Detailed

Redis is used for two patterns:

1. List-backed queues for service-to-service work.
2. Pub/sub channels for request replies and live market fanout.

### Queue names

| Name           | Type       | Producer                            | Consumer                    | Purpose                                              |
| -------------- | ---------- | ----------------------------------- | --------------------------- | ---------------------------------------------------- |
| `messages`     | Redis list | Backend `RedisManager.sendAndAwait` | Engine `src/index.ts`       | API -> Engine commands with `{ clientId, message }`. |
| `db_processor` | Redis list | Engine `RedisManager.pushMessage`   | DB Processor `src/index.ts` | Engine -> persistence worker messages.               |

The code uses `lPush` to enqueue and `rPop` to dequeue, giving FIFO behavior for list usage.

### Pub/sub channels

| Channel            | Publisher      | Subscriber                        | Purpose                                                                     |
| ------------------ | -------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `<clientId UUID>`  | Engine         | Backend                           | One-shot HTTP response to the exact API request that enqueued a command.    |
| `depth@${market}`  | Engine         | WebSocket server                  | Incremental orderbook/depth updates.                                        |
| `trade@${market}`  | Engine         | WebSocket server                  | Trade prints from fills.                                                    |
| `ticker@${market}` | None currently | WebSocket server if frontend asks | Frontend subscription exists, but no backend/engine publisher exists today. |

### `messages` data format

```ts
{
  clientId: string;
  message: MessageToEngine;
}
```

`MessageToEngine` variants:

```ts
{
  type: "CREATE_ORDER";
  data: {
    market: string;
    price: string;
    quantity: string;
    side: "buy" | "sell";
    userId: string;
  }
}
{
  type: "CANCEL_ORDER";
  data: {
    orderId: string;
    market: string;
  }
}
{
  type: "ON_RAMP";
  data: {
    amount: string;
    userId: string;
    txnId: string;
  }
}
{
  type: "GET_DEPTH";
  data: {
    market: string;
  }
}
{
  type: "GET_OPEN_ORDERS";
  data: {
    userId: string;
    market: string;
  }
}
```

### `db_processor` data format

`TRADE_ADDED`:

```json
{
  "type": "TRADE_ADDED",
  "data": {
    "id": "12",
    "isBuyerMaker": false,
    "price": "100.00",
    "quantity": "0.5",
    "quoteQuantity": "50",
    "timestamp": 1760000000000,
    "market": "SOL_USDC"
  }
}
```

`ORDER_UPDATE`:

```json
{
  "type": "ORDER_UPDATE",
  "data": {
    "orderId": "abc",
    "executedQty": 0.5,
    "market": "SOL_USDC",
    "price": "100.00",
    "quantity": "1.000",
    "side": "buy"
  }
}
```

### WebSocket pub/sub data format

Depth:

```json
{
  "stream": "depth@SOL_USDC",
  "data": {
    "a": [["101.00", "2"]],
    "b": [["100.00", "1"]],
    "e": "depth"
  }
}
```

Trade:

```json
{
  "stream": "trade@SOL_USDC",
  "data": {
    "e": "trade",
    "t": 12,
    "m": false,
    "p": "100.00",
    "q": "0.5",
    "s": "SOL_USDC"
  }
}
```

Ticker type exists in `packages/common/src/wsMessages.ts`:

```ts
export type TickerUpdateMessage = {
  stream: string;
  data: {
    c?: string;
    h?: string;
    l?: string;
    v?: string;
    V?: string;
    s?: string;
    id: number;
    e: "ticker";
  };
};
```

No service currently publishes it.

### Why Redis here

Redis fits this project because:

- It is simple to run locally through Docker.
- It supports both list queues and pub/sub with one dependency.
- It is low-latency enough for a learning/project exchange architecture.
- The command queue has a single engine consumer, so Kafka partitioning and consumer-group semantics are not necessary yet.
- RabbitMQ would provide stronger queue semantics, acknowledgements, and routing, but would add operational complexity not used by this code.
- Kafka would be stronger for durable event logs, replay, market-data streams, and analytics fanout, but this project currently uses volatile in-memory engine state and simple queue/pubsub flows.

Tradeoff: Redis pub/sub is ephemeral. If the WebSocket server or DB processor is offline, pub/sub market updates can be missed, and list queue items do not have acknowledgement/retry semantics in this implementation.

## 9. WebSocket Protocol

### Client connection lifecycle

1. Browser creates a singleton `SignalingManager`.
2. `SignalingManager` opens `new WebSocket(BASE_URL)`, where `BASE_URL` is `NEXT_PUBLIC_EXCHANGE_WS_URL` or `ws://localhost:3002`.
3. `apps/websocket/src/index.ts` accepts the connection on port `3002`.
4. `UserManager.addUser(ws)` assigns a UUID and creates a `User`.
5. The browser sends subscription messages.
6. `User.addListeners` parses incoming JSON and calls `SubscriptionManager.subscribe` or `SubscriptionManager.unSubscribe`.
7. `SubscriptionManager` subscribes to Redis channels and relays messages.
8. On close, `UserManager.registerOnClose` deletes the user and calls `SubscriptionManager.userLeft(id)`.
9. On browser `onclose`, `SignalingManager` reconnects after 1000 ms and resends tracked subscriptions.

### Subscribe message

From `packages/common/src/wsMessages.ts`:

```ts
export const SUBSCRIBE = "SUBSCRIBE";

export type SubscribeMessage = {
  method: typeof SUBSCRIBE;
  params: string[];
};
```

Example:

```json
{
  "method": "SUBSCRIBE",
  "params": ["depth@SOL_USDC", "trade@SOL_USDC"],
  "id": 1
}
```

The `id` field is added by the frontend `SignalingManager.sendMessage`; the backend type does not require it and ignores it.

### Unsubscribe message

```ts
export const UNSUBSCRIBE = "UNSUBSCRIBE";

export type UnsubscribeMessage = {
  method: typeof UNSUBSCRIBE;
  params: string[];
};
```

Example:

```json
{
  "method": "UNSUBSCRIBE",
  "params": ["depth@SOL_USDC"],
  "id": 2
}
```

Current implementation note: multi-stream unsubscribe has a bug because `User.addListeners` loops over params but passes `parsedMessage.params[0]` to `SubscriptionManager.unSubscribe`.

### Channels a client can subscribe to

The WebSocket server accepts any string channel and subscribes to Redis with that exact string. The frontend currently uses:

- `depth@${market}` from `Depth`
- `trade@${market}` from `Depth`, `TradeView`, and `MarketBar`
- `ticker@${market}` from `Depth`

Only these are currently published by the engine:

- `depth@${market}`
- `trade@${market}`

### Server-to-client message formats

`WsMessage` union from `packages/common/src/wsMessages.ts`:

```ts
export type WsMessage =
  | TickerUpdateMessage
  | DepthUpdateMessage
  | TradeAddedMessage;
```

Depth update:

```ts
export type DepthUpdateMessage = {
  stream: string;
  data: {
    b?: [string, string][];
    a?: [string, string][];
    e: "depth";
  };
};
```

Trade update:

```ts
export type TradeAddedMessage = {
  stream: string;
  data: {
    e: "trade";
    t: number;
    m: boolean;
    p: string;
    q: string;
    s: string;
  };
};
```

Ticker update type:

```ts
export type TickerUpdateMessage = {
  stream: string;
  data: {
    c?: string;
    h?: string;
    l?: string;
    v?: string;
    V?: string;
    s?: string;
    id: number;
    e: "ticker";
  };
};
```

Frontend callback mapping in `SignalingManager.onmessage`:

- `data.e === "ticker"` maps to partial `Ticker` fields: `lastPrice`, `high`, `low`, `volume`, `quoteVolume`, `symbol`.
- `data.e === "depth"` maps to `{ bids: message.data.b, asks: message.data.a }`.
- `data.e === "trade"` maps to `{ price, quantity, tradeId, isBuyerMaker, symbol }`.

## 10. Database & Persistence

This project uses two databases:

1. Postgres through Prisma for relational application data.
2. TimescaleDB through `pg` for trade time-series data and klines.

### Postgres / Prisma

Used by:

- `backend` for Better Auth, users, sessions, market metadata, and market filtering.
- `engine` for loading active markets on startup.
- `db-processor` setup script for listing active markets during Timescale initialization.

Prisma models:

| Model               | Purpose                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `User`              | Better Auth user plus relations to balances, onramp transactions, and orders.                                              |
| `Session`           | Better Auth sessions.                                                                                                      |
| `Account`           | Better Auth account/provider credentials.                                                                                  |
| `Verification`      | Better Auth verification/OTP records; `identifier` is unique.                                                              |
| `Market`            | Exchange markets, including `symbol`, `baseCurrency`, `quoteCurrency`, `category`, `minOrderSize`, `tickSize`, `isActive`. |
| `UserBalance`       | Relational balance table; currently not used by engine balance mutation.                                                   |
| `OnrampTransaction` | Onramp transaction model; engine has `ON_RAMP` balance mutation but no API route in current code.                          |
| `Order`             | Relational order model; currently not written by `db-processor` despite engine `ORDER_UPDATE` messages.                    |

Seeded markets from `packages/database/src/seed.ts`:

- Bases: `BTC`, `ETH`, `SOL`, `XRP`, `BNB`, `DOGE`, `ADA`, `AVAX`, `LINK`, `SUI`, `TON`, `DOT`, `LTC`, `NEAR`, `PEPE`
- Symbols: each base gets `${base}_USDC` and `${base}_USDC_PERP`
- Total: 30 markets
- `category`: `SPOT` or `FUTURES`
- `minOrderSize`: `0.001`
- `tickSize`: `0.01`
- `isActive`: `true`

### TimescaleDB

Used by:

- `db-processor` for writes.
- `backend` for historical candle reads.

Schema initialized by `apps/db-processor/src/seedTimescale.ts`:

```sql
CREATE TABLE IF NOT EXISTS trades (
  time           TIMESTAMPTZ      NOT NULL,
  market         VARCHAR(50)      NOT NULL,
  price          DOUBLE PRECISION NOT NULL,
  quantity       DOUBLE PRECISION NOT NULL,
  quote_quantity DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_trades_market_time
ON trades (market, time DESC);
```

Materialized views:

- `klines_1m`
- `klines_1h`
- `klines_1w`

Each view groups by `time_bucket`, `market`, and computes:

- `first(price, time) AS open`
- `max(price) AS high`
- `min(price) AS low`
- `last(price, time) AS close`
- `sum(quantity) AS volume`
- `sum(quote_quantity) AS quote_volume`
- `count(*) AS trades`

Current implementation note: `backend/src/router/klineRouter.ts` does not query the materialized views. It queries `trades` directly using `time_bucket($1::interval, time)`.

### DB Processor handling of `TRADE_ADDED`

When the DB processor receives:

```ts
{
  type: "TRADE_ADDED",
  data: { price, quantity, quoteQuantity, timestamp, market, ... }
}
```

It writes:

```sql
INSERT INTO trades (time, market, price, quantity, quote_quantity)
VALUES ($1, $2, $3, $4, $5)
```

with:

- `time`: `new Date(timestamp)`
- `market`: market symbol
- `price`: fill price
- `quantity`: fill quantity
- `quote_quantity`: `fill.qty * Number(fill.price)`

### Historical candle fetching

The frontend calls:

```ts
getKlines(market, interval, startTime, endTime);
```

which sends:

```text
GET /api/v1/klines?symbol=${market}&interval=${interval}&startTime=${startTime}&endTime=${endTime}
```

Supported backend intervals:

- `1m`
- `5m`
- `15m`
- `1h`
- `4h`
- `1d`
- `1D`
- `1w`
- `1W`

`TradeView` converts returned rows into `Candle` objects and passes them to `ChartManager`.

## 11. Docker & Deployment

### Dockerfiles

All service Dockerfiles use Turborepo pruning to reduce build context for a specific app.

| Dockerfile                       | What it does                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker/backend/Dockerfile`      | Uses Node `24.13.1`; prunes `backend`; installs deps; runs Prisma generate; builds `backend`; deploys production deps; runs as non-root `expressjs`; exposes `3001`; starts `node dist/index.js`. |
| `docker/engine/Dockerfile`       | Prunes `engine`; installs deps; runs Prisma generate; builds `engine`; deploys production deps; starts `node dist/index.js`.                                                                      |
| `docker/db-processor/Dockerfile` | Prunes `db-processor`; installs deps; builds; deploys production deps; runs as non-root `db-processor`; starts `node dist/index.js`.                                                              |
| `docker/websocket/Dockerfile`    | Prunes `websocket`; installs deps; builds; deploys production deps; exposes `3002`; starts `node dist/index.js`.                                                                                  |
| `docker/market-maker/Dockerfile` | Prunes `market-maker`; installs deps; builds; deploys production deps; starts `node dist/index.js`.                                                                                               |
| `docker/web/Dockerfile`          | Prunes `web`; accepts public API/WS build args; builds Next standalone output; runs as non-root `nextjs`; starts `node apps/web/server.js`.                                                       |

### Compose files

`docker/compose-files/docker-compose-auxilary-services.yml` starts local supporting infrastructure:

| Service       | Image                               | Ports                    | Purpose                     |
| ------------- | ----------------------------------- | ------------------------ | --------------------------- |
| `database`    | `postgres`                          | `5432:5432`              | Main Postgres database.     |
| `redis`       | `redis`                             | `6379:6379`              | Queue and pub/sub.          |
| `mailhog`     | `mailhog/mailhog`                   | `1025:1025`, `8025:8025` | Local SMTP and email UI.    |
| `timescaledb` | `timescale/timescaledb:latest-pg12` | `5433:5432`              | Trade time-series database. |

`docker/compose-files/docker-compose-integration-test.yml` starts only Postgres for integration tests.

`docker/compose-files/docker-compose-deploy.yml` starts:

- `database`
- `redis`
- `timescaledb`
- `backend`
- `engine`
- `db-processor`
- `websocket`
- `market-maker`
- `web`

Deployment ports:

| Service       | Compose port mapping |
| ------------- | -------------------- |
| `database`    | `5432:5432`          |
| `redis`       | `6379:6379`          |
| `timescaledb` | `5433:5432`          |
| `backend`     | `4001:4001`          |
| `websocket`   | `4002:3002`          |
| `web`         | `4000:3000`          |

Dockerfile exposed ports:

- Backend Dockerfile exposes `3001`.
- WebSocket Dockerfile exposes `3002`.
- Web Dockerfile does not explicitly expose a port, but Next standalone defaults to `3000` unless `PORT` is set.

Current implementation note: backend deploy mapping `4001:4001` differs from the backend Dockerfile's `EXPOSE 3001`. This works only if `.env.backend` sets `PORT=4001`; otherwise the service listens on one port while compose publishes another.

### Local full-stack startup

Typical local sequence:

```sh
pnpm install

docker compose \
  -f docker/compose-files/docker-compose-auxilary-services.yml \
  up -d

cd packages/database
pnpm dlx prisma generate
pnpm dlx prisma migrate dev
pnpm seed

cd ../../apps/db-processor
pnpm seed

cd ../..
pnpm dev:backend
```

Then, in another shell for the frontend:

```sh
cd apps/web
pnpm dev
```

Open:

- Web app: `http://localhost:3000`
- Backend health: `http://localhost:3001/health`
- WebSocket: `ws://localhost:3002`
- MailHog UI: `http://localhost:8025`

## 12. Environment Variables — Full Reference Table

| Variable                       | Used By                                                                                             | What It Does                                                                                                            | Example                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `PORT`                         | `apps/backend`; integration scripts                                                                 | Port for Express `app.listen`.                                                                                          | `3001`                                                   |
| `REDIS_URL`                    | `apps/backend`, `apps/engine`, `apps/websocket`, `apps/db-processor`                                | Redis connection URL for queues and pub/sub.                                                                            | `redis://localhost:6379`                                 |
| `DATABASE_URL`                 | `packages/database`, `apps/backend`, `apps/engine`, `apps/db-processor/src/seedTimescale.ts`, CI/CD | Postgres URL for Prisma.                                                                                                | `postgresql://postgres:password@localhost:5432/postgres` |
| `DIRECT_URL`                   | `packages/database/prisma.config.ts`; Prisma CLI on CI/CD and deploy hosts                          | Direct Postgres URL for Prisma migrations when runtime uses a pooled connection. Falls back to `DATABASE_URL` if unset. | `postgresql://postgres:password@localhost:5432/postgres` |
| `TIMESCALE_USER`               | `apps/backend`, `apps/db-processor`                                                                 | TimescaleDB user for `pg.Client`.                                                                                       | `exchange`                                               |
| `TIMESCALE_HOST`               | `apps/backend`, `apps/db-processor`                                                                 | TimescaleDB host.                                                                                                       | `localhost`                                              |
| `TIMESCALE_DATABASE`           | `apps/backend`, `apps/db-processor`                                                                 | TimescaleDB database name.                                                                                              | `exchange`                                               |
| `TIMESCALE_PASSWORD`           | `apps/backend`, `apps/db-processor`                                                                 | TimescaleDB password.                                                                                                   | `password`                                               |
| `TIMESCALE_PORT`               | `apps/backend`, `apps/db-processor`                                                                 | TimescaleDB port; defaults to `5433` in code.                                                                           | `5433`                                                   |
| `FRONTEND_URL_DEPLOYED`        | `apps/backend`                                                                                      | Allowed CORS/trusted origin for deployed frontend.                                                                      | `https://exchange.shikhar.site`                          |
| `BETTER_AUTH_SECRET`           | Better Auth runtime through `apps/backend`                                                          | Secret used by Better Auth.                                                                                             | `replace-with-secret`                                    |
| `BETTER_AUTH_URL`              | Better Auth runtime through `apps/backend`                                                          | Public backend auth URL.                                                                                                | `http://localhost:3001`                                  |
| `GITHUB_CLIENT_ID`             | `apps/backend/src/lib/auth.ts`                                                                      | GitHub OAuth client ID.                                                                                                 | `Iv1.xxxxx`                                              |
| `GITHUB_CLIENT_SECRET`         | `apps/backend/src/lib/auth.ts`                                                                      | GitHub OAuth client secret.                                                                                             | `github-secret`                                          |
| `GOOGLE_CLIENT_ID`             | `apps/backend/src/lib/auth.ts`                                                                      | Google OAuth client ID.                                                                                                 | `google-client-id.apps.googleusercontent.com`            |
| `GOOGLE_CLIENT_SECRET`         | `apps/backend/src/lib/auth.ts`                                                                      | Google OAuth client secret.                                                                                             | `google-secret`                                          |
| `RESEND_API_KEY`               | `apps/backend`, `packages/email`                                                                    | Enables Resend email transport.                                                                                         | `re_xxxxx`                                               |
| `EMAIL_FROM`                   | `apps/backend`, `packages/email`                                                                    | Verified sender used for OTP and email notifications.                                                                   | `Shikhar <noreply@example.com>`                          |
| `SMTP_HOST`                    | `apps/backend`, `packages/email`                                                                    | Enables SMTP email transport when Resend is not set.                                                                    | `localhost`                                              |
| `SMTP_PORT`                    | `apps/backend`, `packages/email`                                                                    | SMTP port.                                                                                                              | `1025`                                                   |
| `SMTP_USER`                    | `apps/backend`, `packages/email`                                                                    | SMTP username.                                                                                                          | `user`                                                   |
| `SMTP_PASSWORD`                | `apps/backend`, `packages/email`                                                                    | SMTP password.                                                                                                          | `password`                                               |
| `SNAPSHOT_DIR`                 | `apps/engine/src/trade/engine.ts`                                                                   | Directory where `snapshot.json` is read/written. Defaults to `.`.                                                       | `/app/data`                                              |
| `WITH_SNAPSHOT`                | `apps/engine/src/trade/engine.ts`                                                                   | If set, engine attempts to restore from `SNAPSHOT_DIR/snapshot.json`.                                                   | `true`                                                   |
| `BASE_URL`                     | `apps/market-maker`                                                                                 | Backend base URL for market-maker REST calls.                                                                           | `http://localhost:3001`                                  |
| `MARKET_MAKER_USER_ID`         | `apps/market-maker`                                                                                 | User ID used by the bot; defaults to `"5"`.                                                                             | `5`                                                      |
| `NEXT_PUBLIC_BACKEND_URL`      | `apps/web/.env.example`; intended frontend auth/API config                                          | Public backend URL; current `getBackendUrl()` does not read it.                                                         | `http://localhost:3001`                                  |
| `SERVER_BACKEND_URL`           | `apps/web/.env.example`                                                                             | Intended server-side backend URL. Current code does not read it.                                                        | `http://backend:3001`                                    |
| `NEXT_PUBLIC_EXCHANGE_API_URL` | `apps/web/app/utils/httpClient.ts`, `docker/web/Dockerfile`                                         | Public REST API base including `/api/v1`.                                                                               | `http://localhost:3001/api/v1`                           |
| `NEXT_PUBLIC_EXCHANGE_WS_URL`  | `apps/web/app/utils/SignalingManager.ts`, `docker/web/Dockerfile`                                   | Public WebSocket URL.                                                                                                   | `ws://localhost:3002`                                    |
| `BACKEND_URL`                  | `apps/integration-test/src/index.test.ts`                                                           | Backend URL for Vitest tests.                                                                                           | `http://localhost:3001`                                  |

Additional CD-only values are stored as GitHub secrets, including `SSH_HOST`, `SSH_USERNAME`, `SSH_KEY`, `SSH_PASSPHRASE`, `GHCR_PAT`, and `GITHUB_TOKEN`.

## 13. Key TypeScript Types & Schemas

### Engine command and response types

`packages/common/src/engineMessages.ts` defines `MessageToEngine` and `MessageFromEngine`.

`MessageToEngine` is the command surface accepted by `Engine.process`:

- `CREATE_ORDER`
- `CANCEL_ORDER`
- `ON_RAMP`
- `GET_DEPTH`
- `GET_OPEN_ORDERS`

`MessageFromEngine` is the response surface published back to API request `clientId` channels:

- `DEPTH`
- `ORDER_PLACED`
- `ORDER_CANCELLED`
- `OPEN_ORDERS`

Used by:

- Backend `RedisManager.sendAndAwait`.
- Engine `Engine.process` and `RedisManager.sendToApi`.

### DB message types

`packages/common/src/dbMessages.ts` defines `DbMessage`:

- `TRADE_ADDED`
- `ORDER_UPDATE`

Used by:

- Engine `RedisManager.pushMessage`.
- DB processor `src/index.ts`.

Current implementation note: only `TRADE_ADDED` is acted on by the DB processor.

### WebSocket message types

`packages/common/src/wsMessages.ts` defines:

- `SUBSCRIBE`
- `UNSUBSCRIBE`
- `SubscribeMessage`
- `UnsubscribeMessage`
- `IncomingMessage`
- `TickerUpdateMessage`
- `DepthUpdateMessage`
- `TradeAddedMessage`
- `WsMessage`

Used by:

- WebSocket `User.addListeners`.
- WebSocket `User.emit`.
- Engine `RedisManager.publishMessage`.
- Frontend `SignalingManager` expects the same `data.e` values.

### Orderbook types

`packages/common/src/orderbook.ts` defines:

- `Order`
- `Fill`

Used by:

- `apps/engine/src/trade/orderbook.ts`
- `apps/engine/src/trade/engine.ts`

### Auth schemas

`packages/common/src/zodTypes.ts` defines:

- `signupSchema`
- `signupType`
- `signinSchema`
- `signinType`
- `emailSchema`
- `passwordSchema`

Used by:

- `apps/web/app/(auth)/signin/page.tsx`
- `apps/web/app/(auth)/signup/page.tsx`
- `apps/web/app/(auth)/forgot-password/page.tsx`

### Frontend market-data types

`apps/web/app/utils/types.ts` defines frontend-only interfaces:

- `KLine`
- `Trade`
- `Depth`
- `Ticker`
- `OpenInterest`
- `SparklinePoint`
- `MarketDataKlines`
- `MarketDataKlinesResponse`

Used by:

- `httpClient.ts`
- `Markets.tsx`
- `MarketBar.tsx`
- `Depth.tsx`
- `TradeView.tsx`

### Chart types

`apps/web/app/utils/ChartManager.ts` defines:

- `Candle`
- `ChartTheme`
- `ChartManager`

Used by:

- `TradeView.tsx`

### Prisma schema types

Generated Prisma types come from `packages/database/prisma/schema.prisma` through the generator:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
```

The generated directory is ignored by `packages/database/.gitignore`.

## 14. Developer Guide

### Install and bootstrap

Prerequisites:

- Node `>=18` per root `package.json`; CI/CD uses Node 24.
- pnpm `9.0.0`.
- Docker for local Postgres, Redis, MailHog, and TimescaleDB.

Install:

```sh
pnpm install
```

Start auxiliary services:

```sh
docker compose \
  -f docker/compose-files/docker-compose-auxilary-services.yml \
  up -d
```

Prepare Postgres:

```sh
cd packages/database
pnpm dlx prisma generate
pnpm dlx prisma migrate dev
pnpm seed
```

Prepare Timescale:

```sh
cd apps/db-processor
pnpm seed
```

Run backend-side services:

```sh
pnpm dev:backend
```

Run the frontend:

```sh
cd apps/web
pnpm dev
```

### Run individual services

```sh
cd apps/backend && pnpm dev
cd apps/engine && pnpm dev
cd apps/websocket && pnpm dev
cd apps/db-processor && pnpm dev
cd apps/market-maker && pnpm dev
cd apps/web && pnpm dev
```

### Build

```sh
pnpm build
```

Per app:

```sh
pnpm --filter backend build
pnpm --filter engine build
pnpm --filter websocket build
pnpm --filter db-processor build
pnpm --filter market-maker build
pnpm --filter web build
```

### Type check and lint

```sh
pnpm check-types
pnpm lint
```

Current package coverage note:

- `web` and `ui` define lint/type-check scripts.
- Backend-style apps mostly define `build`, `dev`, and `start`.

### Run tests

Integration tests:

```sh
cd apps/integration-test
pnpm test
```

CI version:

```sh
cd apps/integration-test
pnpm test:ci
```

The current tests cover only:

- `GET /health`
- `GET /error`

They do not yet cover matching, Redis, WebSocket fanout, Timescale writes, auth, or frontend behavior.

### Add a new market/trading pair

Current market source of truth is `packages/database/src/seed.ts`.

To add a new base asset:

1. Add the base symbol to `TOP_BASES`.
2. Optionally add a display name to `NAMES`.
3. Run the seed:

   ```sh
   cd packages/database
   pnpm seed
   ```

4. Restart the engine so `Engine.init()` reloads active markets into `Orderbook[]`.
5. If Timescale has not been initialized for the environment, run:

   ```sh
   cd apps/db-processor
   pnpm seed
   ```

6. The market maker will discover the new market on its next startup through `/api/v1/tickers`.

Important detail: `seed.ts` deletes markets not in the generated keep list:

```ts
await prisma.market.deleteMany({
  where: { symbol: { notIn: keep } },
});
```

Do not manually insert markets into Postgres and then run the seed unless they are also represented in `TOP_BASES`.

### What not to touch casually

- `apps/engine/src/trade/orderbook.ts`: changes can alter matching semantics, fill quantities, depth output, and balance behavior.
- `apps/engine/src/trade/engine.ts`: owns fund locking, balance updates, event emission, snapshots, and command handling.
- Redis channel/list names in `packages/common/src/consts.ts`, `apps/backend/src/redisManager.ts`, and `apps/engine/src/redisManager.ts`: changing these breaks service communication unless all producers/consumers are updated together.
- `packages/common/src/engineMessages.ts`, `dbMessages.ts`, and `wsMessages.ts`: these are service contracts.
- `packages/database/prisma/schema.prisma`: migrations and generated Prisma client need to stay in sync.

### Known gotchas and non-obvious design decisions

- The matching engine is in-memory. `snapshot.json` can restore engine state only when `WITH_SNAPSHOT` is set and the file exists.
- `snapshot.json` is ignored at the root by `.gitignore`.
- Test users `"1"`, `"2"`, and `"5"` receive large default balances in the engine. `setBaseBalances` funds `USDC`, `SOL`, `BTC`, `ETH`, `BNB`, `XRP`, `SUI`, and `DOGE`; `ensureBalance` gives any currency a large balance for these test users.
- The engine balance map is separate from Prisma `UserBalance`. Relational balances are modeled but not used by engine balance mutation today.
- `Orderbook` arrays are not sorted, so best-price matching is not guaranteed.
- Partial-fill depth and later matching can overstate remaining quantity because several paths use `quantity` instead of `quantity - filled`.
- `ORDER_UPDATE` messages are pushed but not persisted.
- `tradesRouter` is a stub and returns `{}`.
- The frontend subscribes to `ticker@${market}`, but there is no publisher.
- Market-order UI exists, but true market-order matching does not.
- `apps/web/lib/util.ts` hard-codes the deployed backend URL.
- `docker-compose-deploy.yml` maps backend `4001:4001`, while the backend Dockerfile exposes `3001`; align `PORT` with the mapping.
- `apps/web/.env.example` sets `NEXT_PUBLIC_EXCHANGE_WS_URL=ws://localhost:3001`, but the WebSocket server listens on `3002` locally.
- `.husky/pre-commit` uses `git add -u`, so newly created files still need to be added manually.
- `pnpm-lock.yaml` is generated dependency lock state and should not be edited by hand.
- `apps/backend/tsconfig.tsbuildinfo` is tracked even though `*.tsbuildinfo` is ignored; it is TypeScript incremental metadata.
