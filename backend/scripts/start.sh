#!/bin/bash
# Load environment variables and start the backend
cd /var/opt/backend
set -a
source .env
set +a
exec node dist/index.js
