# VouchWire Backend

**VouchWire** is an audit-ready contract-to-cash workspace. This backend serves the API layer built with Node.js, Express.js, and MongoDB.

## Current Scope

- Express 5 application with Helmet, CORS, rate limiting, and structured Pino logging
- MongoDB connection with replica-set topology validation
- System health endpoints (`/live` and `/ready`)
- Zod-based environment and request validation
- Global error handling with structured JSON envelopes
- Docker Compose stack with single-node MongoDB replica set

### Domains

| Domain          | Description                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Identity**    | User registration, JWT authentication (access/refresh tokens), secure refresh token rotation with replay detection             |
| **Workspaces**  | CLIENT and FREELANCER workspaces with OWNER/MEMBER roles, transactional creation, member management                            |
| **Agreements**  | Contract lifecycle: DRAFT → PROPOSED → ACTIVE/REJECTED/CANCELLED, workspace ownership enforcement                              |
| **Milestones**  | Milestone planning on ACTIVE agreements: DRAFT → FUNDED → SUBMITTED → APPROVED, paginated listing, DRAFT-only editing/deletion |
| **Submissions** | Freelancer work submissions for FUNDED milestones, triggering client approval workflows                                        |
| **Finance**     | Simulated wallet top-ups, atomic milestone escrow funding and release, immutable double-entry ledger, idempotent mutations     |

## Architecture

```
apps/api/src/
├── domains/
│   ├── agreements/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── validators/
│   │   └── routes.js
│   ├── finance/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── validators/
│   │   └── routes.js
│   ├── identity/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   └── routes.js
│   ├── milestones/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── validators/
│   │   └── routes.js
│   ├── submissions/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── validators/
│   │   └── routes.js
│   ├── system/
│   │   ├── controllers/
│   │   └── routes.js
│   └── workspaces/
│       ├── controllers/
│       ├── middlewares/
│       ├── models/
│       ├── repositories/
│       ├── services/
│       ├── validators/
│       └── routes.js
└── shared/
    ├── config/
    ├── database/
    ├── errors/
    ├── middlewares/
    └── utils/
```

### Boundary Rules

- Controllers handle HTTP only (`req`, `res`, status codes, service calls).
- Services contain business and operational logic.
- Repositories contain Mongoose persistence queries only.
- Models contain schemas and indexes only.
- Cross-domain communication uses services only (no direct model/repository imports).
- Mongoose connection lives only in `src/shared/database/`.
- No global `controllers/`, `services/`, `models/`, or `repositories/` folders.

## Prerequisites

- **Node.js** >= 22.x
- **Docker** and **Docker Compose** v2
- **npm** >= 10.x

## Getting Started

### Docker (recommended)

All commands run from the repository root.

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
npm ci

# Start MongoDB replica set via Docker (if not already running)
docker compose up -d mongodb mongo-rs-init

# Start the API in watch mode
npm run dev --workspace=@vouchwire/api
```

The native URI (`mongodb://localhost:27017/vouchwire?replicaSet=rs0&directConnection=true`) is for local development only.

## Environment Variables

| Variable                 | Description                            | Default                 |
| ------------------------ | -------------------------------------- | ----------------------- |
| `NODE_ENV`               | `development`, `production`, or `test` | `development`           |
| `PORT`                   | HTTP server port                       | `4000`                  |
| `MONGODB_URI`            | MongoDB connection string              | —                       |
| `MONGODB_REPLICA_SET`    | Expected replica set name              | `rs0`                   |
| `LOG_LEVEL`              | Pino log level                         | `info`                  |
| `CORS_ORIGINS`           | Comma-separated allowed origins        | `http://localhost:5173` |
| `TRUST_PROXY`            | Number of trusted proxies              | `0`                     |
| `API_BODY_LIMIT`         | Max JSON body size                     | `256kb`                 |
| `JWT_ACCESS_SECRET`      | Secret for access tokens               | —                       |
| `JWT_REFRESH_SECRET`     | Secret for refresh tokens              | —                       |
| `JWT_ACCESS_EXPIRES_IN`  | Access token lifespan (e.g. 15m)       | `15m`                   |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan (e.g. 7d)       | `7d`                    |
| `JWT_ISSUER`             | JWT Issuer claim                       | `vouchwire`             |
| `JWT_AUDIENCE`           | JWT Audience claim                     | `vouchwire-client`      |
| `REFRESH_COOKIE_NAME`    | Name of the refresh HttpOnly cookie    | `vw_refresh`            |

## Health Endpoints

```bash
# Liveness — always 200, no DB check
curl http://localhost:4000/api/v1/system/health/live

# Readiness — 200 when MongoDB is connected and writable
curl http://localhost:4000/api/v1/system/health/ready
```

## Finance Domain

### Endpoints

| Method | Path                                                          | Description                               |
| ------ | ------------------------------------------------------------- | ----------------------------------------- |
| `GET`  | `/api/v1/finance/wallets/:workspaceId?currency=USD`           | Read wallet balance                       |
| `POST` | `/api/v1/finance/wallets/:workspaceId/top-ups`                | Simulated wallet top-up                   |
| `POST` | `/api/v1/finance/milestones/:milestoneId/fund`                | Fund milestone into escrow                |
| `POST` | `/api/v1/finance/milestones/:milestoneId/approve-and-release` | Approve submitted work and release escrow |
| `POST` | `/api/v1/submissions/milestones/:milestoneId`                 | Freelancer submits work                   |
| `GET`  | `/api/v1/submissions/milestones/:milestoneId`                 | View submission                           |

### Simulated Top-Ups

Top-ups simulate adding funds to a CLIENT workspace wallet without a real payment gateway. The `amountMinor` field represents the smallest currency unit (e.g., cents for USD). An `Idempotency-Key` header is required on every mutation request to prevent duplicate money movement.

### Wallet Balances

Each wallet tracks two balances per currency:

- **`availableAmountMinor`** — funds available for milestone funding
- **`escrowedAmountMinor`** — funds locked in funded milestones

Reading a wallet for an unfunded currency returns a zero-balance representation without persisting a document.

### Milestone Escrow Funding

Funding a milestone atomically:

1. Transitions the milestone from `DRAFT` to `FUNDED`
2. Decreases the client wallet's `availableAmountMinor`
3. Increases the client wallet's `escrowedAmountMinor`
4. Creates two immutable ledger entries (`AVAILABLE_DEBIT` + `ESCROW_CREDIT`) sharing one `operationId`

If the available balance is insufficient, the entire operation rolls back — the milestone stays `DRAFT`, the wallet is unchanged, and no ledger entries are created.

### Escrow Approval and Release

Once a milestone is `SUBMITTED` via the Submissions domain, the client workspace OWNER can approve the work:

1. Transitions the milestone from `SUBMITTED` to `APPROVED`
2. Decreases the client wallet's `escrowedAmountMinor`
3. Increases the freelancer wallet's `availableAmountMinor`
4. Creates two immutable ledger entries (`ESCROW_DEBIT` + `AVAILABLE_CREDIT`) sharing one `operationId`
5. Records the approval timestamp on the work submission.

### Immutable Ledger

Every monetary operation creates append-only ledger entries. Entries are never updated or deleted. A unique compound index on `{ workspaceId, operationType, idempotencyKey, entrySide }` prevents duplicate money movement at the database level.

### Idempotency

Both mutation endpoints (`top-ups` and `fund`) require an `Idempotency-Key` header:

- Same key + same inputs → returns the original result without re-executing
- Same key + different inputs → returns `IDEMPOTENCY_KEY_REUSED` (HTTP 409)

## Development Commands

```bash
# Lint
npm run lint --workspace=@vouchwire/api

# Format code
npm run format --workspace=@vouchwire/api

# Verify formatting
npm run format:check --workspace=@vouchwire/api

# Run tests
npm test --workspace=@vouchwire/api
```

## Notes

- The local single-node `rs0` replica set supports local transaction development only. It is **not** production high availability.
- `node_modules/` is excluded from Git and Docker builds.
- All monetary amounts are stored as positive safe integers in the smallest currency unit.

## Authentication & Testing

- **Token Rotation**: Refresh tokens are securely rotated on each use.
- **Replay Revocation**: A replay attack (using an already rotated token) revokes the entire token family.
- **Cookie Behavior**: The refresh token is set in an `HttpOnly` cookie (`vw_refresh`). It requires `Secure` in production and clears on logout or rotation failure.
- **Test Database Behavior**: Integration tests connect to a dedicated test database (`vouchwire-test`) which cleans up collections between tests.
- **Health Checks**: Health tests run without connecting to the database.
