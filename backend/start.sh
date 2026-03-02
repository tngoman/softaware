#!/bin/bash
cd /var/opt/backend
source .env
exec node dist/index.js
