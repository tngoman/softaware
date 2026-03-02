#!/bin/bash
source .env 2>/dev/null || true
export $(grep -v '^#' .env | xargs) 2>/dev/null || true
node dist/index.js
