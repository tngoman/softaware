#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Export variables from .env into the process environment
set -a
source ./.env
set +a

exec node dist/index.js
