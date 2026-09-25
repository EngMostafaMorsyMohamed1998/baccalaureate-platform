#!/usr/bin/env bash
# Idempotent environment bootstrap for the Cloud Agent.
# Ensures PostgreSQL is installed (the app needs a local database) and installs
# Node dependencies. Safe to run repeatedly; skips apt when Postgres is present.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if ! ls /usr/lib/postgresql/*/bin/initdb >/dev/null 2>&1; then
  echo "[install] installing PostgreSQL"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    postgresql postgresql-contrib
else
  echo "[install] PostgreSQL already installed"
fi

echo "[install] installing Node dependencies"
npm ci

echo "[install] done"
