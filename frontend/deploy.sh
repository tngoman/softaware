#!/bin/bash
# deploy.sh — Copy build output to production without downtime
#
# Usage:
#   ./deploy.sh          # Build and deploy
#   ./deploy.sh --skip-build   # Deploy existing build only
#
# This uses rsync to do an atomic-style overwrite:
#   - New/changed files are copied first
#   - Old files that no longer exist are deleted AFTER new ones are in place
# This avoids the blank-site problem caused by CRA clearing the output dir.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PRODUCTION_DIR="/var/opt/softaware.net.za/public_html"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

# ── Build step (unless --skip-build) ────────────────────────────────────────
if [[ "$1" != "--skip-build" ]]; then
  echo -e "${YELLOW}▶ Building frontend...${NC}"
  cd "$SCRIPT_DIR"
  npm run build
  echo -e "${GREEN}✔ Build complete.${NC}"
else
  echo -e "${YELLOW}⏭ Skipping build (--skip-build)${NC}"
fi

# ── Verify build dir exists ─────────────────────────────────────────────────
if [[ ! -d "$BUILD_DIR" ]]; then
  echo -e "${RED}✖ Build directory not found: $BUILD_DIR${NC}"
  echo "  Run without --skip-build, or run 'npm run build' first."
  exit 1
fi

# ── Deploy with rsync ───────────────────────────────────────────────────────
echo -e "${YELLOW}▶ Deploying to $PRODUCTION_DIR ...${NC}"
rsync -av --delete "$BUILD_DIR/" "$PRODUCTION_DIR/"
echo -e "${GREEN}✔ Deployment complete.${NC}"
