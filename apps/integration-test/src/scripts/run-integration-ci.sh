#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

PORT=3001

function stop_services() {
  echo "🔴 - Stopping backend..."
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  echo "🔴 - Taking down auxiliary services..."
  docker compose -f "$PROJECT_ROOT/docker/compose-files/docker-compose-integration-test.yml" down
}

trap stop_services EXIT INT TERM

DATABASE_URL="${CI_DATABASE_URL:-postgresql://postgres:password@localhost:5432/postgres}"
TIMESCALE_URL_PASSWORD="${TIMESCALE_PASSWORD:-password}"

echo "Starting auxilary services"
docker compose -f "$PROJECT_ROOT/docker/compose-files/docker-compose-integration-test.yml" up -d --wait

echo '🟡 - Waiting for database to be ready...'
$PROJECT_ROOT/apps/integration-test/src/scripts/wait-for-it.sh localhost:5432 --timeout=60 -- echo "database has started"

echo "Applying migration"
cd $PROJECT_ROOT/packages/database && DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DATABASE_URL" pnpm dlx prisma migrate dev --name init --schema "$PROJECT_ROOT/packages/database/prisma/schema.prisma"

echo "Generate Client"
cd $PROJECT_ROOT/packages/database && pnpm dlx prisma generate --schema "$PROJECT_ROOT/packages/database/prisma/schema.prisma"

cat > "$PROJECT_ROOT/apps/backend/.env" <<EOF
PORT=$PORT
DATABASE_URL=$DATABASE_URL
DIRECT_URL=$DATABASE_URL
REDIS_URL=redis://localhost:6379
TIMESCALE_USER=exchange
TIMESCALE_HOST=localhost
TIMESCALE_DATABASE=exchange
TIMESCALE_PASSWORD=$TIMESCALE_URL_PASSWORD
TIMESCALE_PORT=5433
FRONTEND_URL_DEPLOYED=http://localhost:3000
BETTER_AUTH_SECRET=test-secret
BETTER_AUTH_URL=http://localhost:$PORT
EOF

cat > "$PROJECT_ROOT/apps/db-processor/.env" <<EOF
DATABASE_URL=$DATABASE_URL
DIRECT_URL=$DATABASE_URL
REDIS_URL=redis://localhost:6379
TIMESCALE_USER=exchange
TIMESCALE_HOST=localhost
TIMESCALE_DATABASE=exchange
TIMESCALE_PASSWORD=$TIMESCALE_URL_PASSWORD
TIMESCALE_PORT=5433
EOF

echo "Initializing TimescaleDB"
cd $PROJECT_ROOT/apps/db-processor && pnpm run seed

echo '🟡 - Starting backend server...'
cd $PROJECT_ROOT/apps/backend && PORT=$PORT pnpm run dev:ci &
BACKEND_PID=$!

echo "backend pid $BACKEND_PID"

echo '🟡 - Waiting for backend to be ready...'
$PROJECT_ROOT/apps/integration-test/src/scripts/wait-for-it.sh localhost:3001 --timeout=60 -- echo "backend has started"

echo "Run integration test"
cd $PROJECT_ROOT/apps/integration-test && vitest --run
