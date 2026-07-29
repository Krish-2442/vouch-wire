# VouchWire Backend

**VouchWire** is an audit-ready contract-to-cash workspace. This backend serves the API layer built with Node.js, Express.js, and MongoDB.

## Current Scope — Chunk 1

- Express application with Helmet, CORS, rate limiting, and structured Pino logging
- MongoDB connection with replica-set topology validation
- System health endpoints (`/live` and `/ready`)
- Zod-based environment validation
- Global error handling with structured JSON envelopes
- Docker Compose stack with single-node MongoDB replica set

## Architecture

```
server/src/
├── domains/        Domain modules (system, future domains)
│   └── <domain>/
│       ├── controllers/
│       ├── services/
│       ├── models/          (future data-bearing domains)
│       ├── repositories/    (future data-bearing domains)
│       ├── validators/      (future data-bearing domains)
│       └── routes.js
└── shared/         Cross-cutting infrastructure
    ├── config/
    ├── database/
    ├── errors/
    ├── middlewares/
    └── utils/
```

### Boundary Rules

- Controllers handle HTTP only (`req`, `res`, status codes, service calls).
- Services contain business and operational logic.
- Mongoose connection lives only in `src/shared/database/`.
- Never call Mongoose directly from a controller.
- No global `controllers/`, `services/`, `models/`, or `repositories/` folders.

## Prerequisites

- **Node.js** >= 22.x
- **Docker** and **Docker Compose** v2
- **npm** >= 10.x

## Getting Started

### Docker (recommended)

All commands run from the `server/` directory.

```bash
# Start the full stack (MongoDB + replica set init + API)
docker compose up -d --build

# Check service status
docker compose ps

# View API logs
docker compose logs -f api

# Stop (preserves data)
docker compose down
```

> **⚠️ Warning:** Running `docker compose down -v` deletes the MongoDB data volume. All local data will be lost.

### Native Development

```bash
# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start MongoDB replica set via Docker (if not already running)
docker compose up -d mongodb mongo-rs-init

# Start the API in watch mode
npm run dev
```

The native URI (`mongodb://localhost:27017/vouchwire?replicaSet=rs0&directConnection=true`) is for local development only.

## Environment Variables

| Variable              | Description                            | Default                 |
| --------------------- | -------------------------------------- | ----------------------- |
| `NODE_ENV`            | `development`, `production`, or `test` | `development`           |
| `PORT`                | HTTP server port                       | `4000`                  |
| `MONGODB_URI`         | MongoDB connection string              | —                       |
| `MONGODB_REPLICA_SET` | Expected replica set name              | `rs0`                   |
| `LOG_LEVEL`           | Pino log level                         | `info`                  |
| `CORS_ORIGINS`        | Comma-separated allowed origins        | `http://localhost:5173` |
| `TRUST_PROXY`         | Number of trusted proxies              | `0`                     |
| `API_BODY_LIMIT`      | Max JSON body size                     | `256kb`                 |

## Health Endpoints

```bash
# Liveness — always 200, no DB check
curl http://localhost:4000/api/v1/system/health/live

# Readiness — 200 when MongoDB is connected and writable
curl http://localhost:4000/api/v1/system/health/ready
```

## Development Commands

```bash
# Lint
npm run lint

# Format code
npm run format

# Verify formatting
npm run format:check

# Run tests
npm test
```

## Notes

- The local single-node `rs0` replica set supports local transaction development only. It is **not** production high availability.
- `node_modules/` is excluded from Git and Docker builds.
