#!/usr/bin/env bash
# Per-boot startup for the Cloud Agent environment.
# Brings up a local PostgreSQL instance, ensures the app database exists,
# writes a local .env, applies Prisma migrations, and seeds demo data once.
# Safe to run repeatedly.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -n1)"
PGDATA="${PGDATA:-$HOME/pgdata}"
PGPORT="${PGPORT:-5432}"
DB_NAME="baccalaureate"
DB_USER="postgres"
DB_PASS="postgres"
DB_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${PGPORT}/${DB_NAME}?schema=public"

export PATH="$PGBIN:$PATH"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[start] initializing PostgreSQL cluster at $PGDATA"
  mkdir -p "$PGDATA"
  initdb -D "$PGDATA" -U "$DB_USER" --auth-local=trust --auth-host=trust >/dev/null
  echo "unix_socket_directories = '/tmp'" >> "$PGDATA/postgresql.conf"
  echo "listen_addresses = 'localhost'" >> "$PGDATA/postgresql.conf"
  echo "port = ${PGPORT}" >> "$PGDATA/postgresql.conf"
fi

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "[start] starting PostgreSQL"
  pg_ctl -D "$PGDATA" -l "$PGDATA/server.log" -o "-k /tmp" -w start
else
  echo "[start] PostgreSQL already running"
fi

for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p "$PGPORT" -q; then break; fi
  sleep 1
done

psql -h 127.0.0.1 -p "$PGPORT" -U "$DB_USER" -d postgres -tc \
  "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" >/dev/null

if ! psql -h 127.0.0.1 -p "$PGPORT" -U "$DB_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" | grep -q 1; then
  echo "[start] creating database ${DB_NAME}"
  createdb -h 127.0.0.1 -p "$PGPORT" -U "$DB_USER" "$DB_NAME"
fi

ENV_FILE="$REPO_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "[start] writing $ENV_FILE"
  cat > "$ENV_FILE" <<EOF
# Local Cloud Agent development environment (not for production).
DATABASE_URL="${DB_URL}"
DIRECT_URL="${DB_URL}"
AUTH_SECRET="cloud-agent-local-dev-secret"
TEACHER_PIN="mostafa2026"
DATA_DIR="${REPO_DIR}/data"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
EOF
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

cd "$REPO_DIR"
echo "[start] applying Prisma migrations"
npx prisma migrate deploy

USER_COUNT="$(psql -h 127.0.0.1 -p "$PGPORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
  'SELECT COUNT(*) FROM "User";' 2>/dev/null || echo 0)"
if [ "${USER_COUNT:-0}" = "0" ]; then
  echo "[start] seeding demo data"
  npx prisma db seed
else
  echo "[start] database already seeded (${USER_COUNT} users)"
fi

echo "[start] ready"
