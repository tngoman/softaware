# SoftAware Backend

Node.js/Express backend with MySQL database and AI-powered code editing.

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run migrations
npx prisma db push

# Start development server
npm run dev
```
## Project Structure

```
backend/
├── src/              # TypeScript source code
├── dist/             # Compiled JavaScript
├── docs/             # Project documentation
├── tests/            # Test files
├── scripts/          # Utility scripts
├── python-utils/     # Python helper scripts
├── logs/             # Application logs (gitignored)
├── node_modules/     # Dependencies
└── README.md         # This file
```

## Documentation

- [docs/](docs/) - Project-specific documentation
- [Quick Start Guide](docs/QUICK_START.md)
- [Credits API Testing](docs/CREDITS_API_TESTING.md)
- [Ollama Setup](docs/OLLAMA_SETUP.md)

Complete API documentation: `/var/opt/documentation/integration/`

## Production

```bash
# Build the project
npm run build

# Start with PM2 (recommended)
pm2 start dist/index.js --name softaware-backend

# Restart after changes
pm2 restart softaware-backend

# View logs
pm2 logs softaware-backend

# Check status
pm2 status
```

## Environment Variables

See `.env.example` for required variables.

```env
DATABASE_URL="mysql://user:password@localhost:3306/softaware"
JWT_SECRET="your-secret"
JWT_EXPIRES_IN="7d"
PORT=8787
GLM_API_KEY="your-glm-key"
```

## API Endpoints

- `GET /healthz` - Health check
- `POST /auth/login` - Authentication
- `POST /api-keys` - API key management
- `POST /code-agent/execute` - AI code editing
- See [API Reference](../../documentation/backend/api/README.md) for complete list

## Technology Stack

- Node.js v18+
- Express.js
- TypeScript
- Prisma ORM
- MySQL
- JWT authentication
