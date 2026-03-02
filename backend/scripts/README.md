# Scripts

This directory contains utility scripts and helpers.

## Shell Scripts

- **forever-start.sh** - Start the backend using forever (deprecated - use PM2 instead)
- **start.sh** - Simple startup script

## Utilities

- **create-api-key.ts** - Create new API keys for users

## Usage

### Create API Key
```bash
tsx scripts/create-api-key.ts <userId> <name>
```

### Start Backend (Development)
```bash
npm run dev
```

### Start Backend (Production)
```bash
pm2 start dist/index.js --name softaware-backend
# or
npm run start
```
