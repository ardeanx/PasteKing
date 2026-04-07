# PasteKing

A fast, feature-rich paste-sharing platform for developers. Share code snippets, text notes, CLI logs, and Markdown documents with syntax highlighting, end-to-end encryption, workspace collaboration, and more.

## Architecture

Monorepo powered by pnpm workspaces + Turborepo.

```
apps/
  api/          → Express 5 REST API (controller → service → repository)
  web/          → Next.js 16 frontend (App Router, SSR)
  worker/       → BullMQ background job processor
  cli/          → Command-line interface (Commander 14)

packages/
  config/       → Shared tsconfig, eslint, prettier, env loader
  crypto/       → Password hashing (scrypt), SHA-256, ID generation, AES-256-GCM E2E encryption
  db/           → Prisma 7 schema, client, migrations, seed
  sdk/          → Typed API client for frontend, CLI & scripts
  storage/      → Hybrid storage: DB (≤64 KB) + MinIO/S3 (>64 KB)
  types/        → Shared domain enums and DTO types
  validation/   → Zod 4 schemas for paste, auth, moderation, workspaces, secret scanning
```

## Tech Stack

| Layer              | Technology                                                                |
| ------------------ | ------------------------------------------------------------------------- |
| **Frontend**       | Next.js 16, React 19, Tailwind CSS 4, Plate.js (rich editor)              |
| **Backend**        | Express 5, Pino, Zod 4, Stripe 22                                         |
| **Worker**         | BullMQ 5, ioredis                                                         |
| **Database**       | PostgreSQL 16 via Prisma 7                                                |
| **Cache / Queues** | Redis 7                                                                   |
| **Object Storage** | MinIO (local) / S3-compatible (production)                                |
| **Auth**           | Email + password, GitHub OAuth, Google OAuth, session cookies, API tokens |
| **Encryption**     | AES-256-GCM client-side via Web Crypto API                                |
| **Language**       | TypeScript 6                                                              |
| **Tooling**        | pnpm 9, Turborepo, Vitest 4, Prettier                                     |

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 9
- **Docker** & Docker Compose

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> pasteking
cd pasteking
pnpm install

# 2. Start infrastructure (PostgreSQL, Redis, MinIO)
docker compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set SESSION_SECRET to a random ≥32-char string

# 4. Set up database
pnpm db:generate
pnpm db:migrate

# 5. Seed sample data (optional — creates demo users, pastes, workspaces)
pnpm db:seed

# 6. Start the full stack
pnpm dev
```

Services start at:

| Service    | URL                   |
| ---------- | --------------------- |
| **Web**    | http://localhost:3000 |
| **API**    | http://localhost:4000 |
| **MinIO**  | http://localhost:9001 |
| **Worker** | (background process)  |

### Demo Accounts (after seeding)

| Email               | Password  | Role       |
| ------------------- | --------- | ---------- |
| admin@pasteking.dev | admin123  | ADMIN      |
| demo@pasteking.dev  | demo1234  | USER       |
| alice@example.com   | alice1234 | USER       |
| bob@example.com     | bobsecure | USER       |
| carol@example.com   | carol5678 | RESTRICTED |

## Available Commands

| Command            | Description                        |
| ------------------ | ---------------------------------- |
| `pnpm dev`         | Start all apps in dev mode         |
| `pnpm build`       | Build all apps and packages        |
| `pnpm lint`        | Lint all packages                  |
| `pnpm typecheck`   | Type-check all packages            |
| `pnpm test`        | Run all tests (Vitest)             |
| `pnpm format`      | Format code with Prettier          |
| `pnpm db:generate` | Generate Prisma client             |
| `pnpm db:migrate`  | Run database migrations            |
| `pnpm db:seed`     | Seed database with sample data     |
| `pnpm db:studio`   | Open Prisma Studio                 |
| `pnpm clean`       | Remove dist/, node_modules/, .next |

## API Endpoints

### Public

| Method | Path                                      | Description                                                                                           |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/health`                                 | Health check                                                                                          |
| GET    | `/v1/health`                              | API v1 health check                                                                                   |
| POST   | `/v1/auth/register`                       | Register (email + username + password)                                                                |
| POST   | `/v1/auth/login`                          | Login (returns session cookie)                                                                        |
| GET    | `/v1/auth/oauth/:provider`                | Start OAuth flow (github, google)                                                                     |
| GET    | `/v1/auth/oauth/:provider/callback`       | OAuth callback (exchanges code for session)                                                           |
| POST   | `/v1/pastes`                              | Create a paste (anonymous or authenticated)                                                           |
| POST   | `/v1/pastes/raw`                          | Create paste from raw text body                                                                       |
|        |                                           | Query params: `?mode=`, `?visibility=`, `?expiresIn=`, `?burnAfterRead=true`, `?title=`, `?language=` |
| GET    | `/v1/pastes/search`                       | Full-text search public pastes (`?q=`, `?limit=`, `?offset=`)                                         |
| GET    | `/v1/pastes/:id`                          | Get paste with content (records view for analytics)                                                   |
| GET    | `/v1/pastes/:id/raw`                      | Get raw paste content                                                                                 |
| PATCH  | `/v1/pastes/:id`                          | Update paste (anonymous or owner)                                                                     |
| DELETE | `/v1/pastes/:id`                          | Delete paste (owner or via `x-delete-token`)                                                          |
| GET    | `/v1/pastes/:id/revisions`                | Revision history                                                                                      |
| GET    | `/v1/pastes/:id/revisions/:from/diff/:to` | Diff between two revisions                                                                            |
| POST   | `/v1/pastes/:id/fork`                     | Fork a paste (copies content into a new paste)                                                        |

### Authenticated (session cookie or Bearer token)

| Method | Path                       | Description                                                                     |
| ------ | -------------------------- | ------------------------------------------------------------------------------- |
| POST   | `/v1/auth/logout`          | Logout (clears session)                                                         |
| GET    | `/v1/auth/me`              | Get current user                                                                |
| POST   | `/v1/auth/tokens`          | Create API token (with optional scopes)                                         |
| GET    | `/v1/auth/tokens`          | List API tokens                                                                 |
| DELETE | `/v1/auth/tokens/:id`      | Revoke API token                                                                |
| GET    | `/v1/pastes/mine`          | List authenticated user's pastes                                                |
| GET    | `/v1/pastes/search/mine`   | Search user's own pastes (`?q=`, `?limit=`, `?offset=`, `?language=`, `?mode=`) |
| GET    | `/v1/pastes/analytics/me`  | User analytics (total pastes/views/forks)                                       |
| GET    | `/v1/pastes/:id/analytics` | Paste analytics (owner only)                                                    |
| POST   | `/v1/reports`              | Report a paste                                                                  |

### WebSocket

| Path                 | Description                                      |
| -------------------- | ------------------------------------------------ |
| `/v1/ws?pasteId=...` | Real-time collaboration (edit, cursor, presence) |

### Admin (requires ADMIN platform role)

| Method | Path                              | Description                                                                                      |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | `/v1/admin/pastes/search`         | Search/filter all pastes (`?q=`, `?status=`, `?moderationStatus=`, `?visibility=`, `?authorId=`) |
| GET    | `/v1/admin/reports`               | List reports                                                                                     |
| GET    | `/v1/admin/reports/:id`           | Get report details                                                                               |
| PATCH  | `/v1/admin/reports/:id/status`    | Update report status                                                                             |
| GET    | `/v1/admin/pastes/:id/moderation` | Get paste moderation info                                                                        |
| POST   | `/v1/admin/pastes/:id/actions`    | Take moderation action                                                                           |
| GET    | `/v1/admin/users`                 | List users                                                                                       |
| GET    | `/v1/admin/users/:id`             | Get user details                                                                                 |
| PATCH  | `/v1/admin/users/:id/status`      | Update user status                                                                               |
| GET    | `/v1/admin/flags`                 | List abuse flags                                                                                 |
| GET    | `/v1/admin/audit-logs`            | List audit logs                                                                                  |

### API Token Scopes

| Scope              | Description       |
| ------------------ | ----------------- |
| `paste:create`     | Create new pastes |
| `paste:read:own`   | Read own pastes   |
| `paste:delete:own` | Delete own pastes |

Empty scopes = full access (backwards compatible).

## Authentication

PasteKing supports two auth methods:

1. **Session cookies** — for the web app. Register or login → `pasteking_session` HttpOnly cookie is set. Session expires after 72 hours (configurable via `SESSION_MAX_AGE_HOURS`).

2. **Bearer tokens** — for API/CLI usage. Create an API token from the web dashboard or via `POST /v1/auth/tokens`. Use `Authorization: Bearer pk_...` header.

## Storage

Content is stored using a hybrid strategy:

- **≤ 64 KB** (default `STORAGE_THRESHOLD`): stored inline in PostgreSQL
- **> 64 KB**: stored in MinIO/S3 object storage, with a `contentRef` pointer in the DB

This keeps the database fast for small pastes while supporting arbitrarily large content via object storage.

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable                | Default                  | Description                                  |
| ----------------------- | ------------------------ | -------------------------------------------- |
| `DATABASE_URL`          | —                        | PostgreSQL connection string                 |
| `REDIS_URL`             | `redis://localhost:6379` | Redis for BullMQ queues & caching            |
| `SESSION_SECRET`        | (dev default)            | Secret for session validation (min 32 chars) |
| `SESSION_MAX_AGE_HOURS` | `72`                     | Session cookie lifetime in hours             |
| `S3_ENDPOINT`           | `http://localhost:9000`  | MinIO/S3 endpoint                            |
| `S3_ACCESS_KEY`         | `pasteking`              | S3 access key                                |
| `S3_SECRET_KEY`         | `pasteking123`           | S3 secret key                                |
| `S3_BUCKET`             | `pasteking`              | S3 bucket name                               |
| `S3_REGION`             | `us-east-1`              | S3 region                                    |
| `STORAGE_THRESHOLD`     | `65536`                  | Byte threshold for object storage (64 KB)    |
| `API_PORT`              | `4000`                   | API server port                              |
| `API_URL`               | `http://localhost:4000`  | API base URL                                 |
| `NEXT_PUBLIC_API_URL`   | `http://localhost:4000`  | API URL exposed to the frontend              |
| `WORKER_CONCURRENCY`    | `5`                      | BullMQ worker concurrency                    |

### Optional — OAuth

| Variable               | Description                    |
| ---------------------- | ------------------------------ |
| `GITHUB_CLIENT_ID`     | GitHub OAuth app client ID     |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID         |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret     |

### Optional — Stripe Billing

| Variable                | Description                   |
| ----------------------- | ----------------------------- |
| `STRIPE_SECRET_KEY`     | Stripe API secret key         |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID`   | Stripe Price ID for Pro plan  |
| `STRIPE_TEAM_PRICE_ID`  | Stripe Price ID for Team plan |

## Features

### Core

- **Paste modes**: Code (80+ languages with syntax highlighting), Text, Log, Markdown
- **Visibility**: Public, Unlisted, Private
- **Expiration**: Auto-expire pastes after a configurable duration
- **Burn after read**: Self-destructing pastes on first view
- **Revision history**: Full version history with line-by-line diff viewer
- **Forking**: Fork any public paste to create your own copy
- **Full-text search**: PostgreSQL `tsvector` search with highlighted snippets across public, personal, and workspace scopes

### Security & Encryption

- **End-to-end encryption**: AES-256-GCM via Web Crypto API — encryption key stays in the URL fragment and never reaches the server
- **Secret scanning**: Regex-based detection of AWS keys, GitHub tokens, private keys, JWTs, Stripe keys, and more. Warnings shown before publish
- **Session auth**: scrypt password hashing, HttpOnly session cookies, CSRF protection
- **API tokens**: Scoped Bearer tokens (`paste:create`, `paste:read:own`, `paste:delete:own`)
- **OAuth**: GitHub and Google login

### Collaboration

- **Workspaces**: Multi-user teams with OWNER / ADMIN / MEMBER / VIEWER roles
- **Workspace pastes**: Assign pastes to workspaces with RBAC access control
- **Real-time editing**: WebSocket-based live collaboration with cursor sharing and presence
- **Workspace audit logs**: Track all membership changes, paste actions, and settings updates

### Platform & Moderation

- **Admin dashboard**: Reports, user management, abuse flags, moderation audit logs at `/admin`
- **Reporting**: Users can report pastes (SPAM, MALWARE, CREDENTIAL_EXPOSURE, etc.)
- **Moderation actions**: Hide, disable, or permanently delete reported content
- **User status**: ACTIVE / RESTRICTED / SUSPENDED with enforced access controls
- **Abuse detection**: Automated flags for secret scans, rate spikes, and repeated reports

### Billing

- **Stripe integration**: Checkout Sessions, Customer Portal, webhook processing
- **Plan tiers**: Free / Pro / Team with usage-based quotas (paste size, storage, tokens, workspaces, members)
- **Subscription lifecycle**: FREE / TRIALING / ACTIVE / PAST_DUE / CANCELED states
- **Admin reconciliation**: Sync subscription state from Stripe on demand

### Analytics

- **View tracking**: Per-paste view counts (unique by IP hash) with 24h / 7d / 30d breakdowns
- **User analytics**: Total pastes, views, and forks
- **Workspace analytics**: Per-workspace usage and storage stats

## CLI Usage

```bash
# Set API token (from Dashboard → API Tokens)
pasteking auth set-token pk_abc123...

# Create a paste from inline text
pasteking paste create "Hello world"

# Create from file
pasteking paste file ./script.sh --mode CODE --language bash

# Pipe from stdin
cat error.log | pasteking paste stdin --mode LOG --title "crash log"

# Get paste metadata + content
pasteking paste get abc123

# Get share URL
pasteking paste url abc123

# Delete paste
pasteking paste delete abc123 --token <delete-token>

# JSON output for scripting
pasteking paste create "data" --json
```

Config is stored at:

- **Linux/macOS**: `~/.config/pasteking/config.json`
- **Windows**: `%APPDATA%/pasteking/config.json`

## Secret Scanning

Non-encrypted pastes are scanned for common secret patterns before publishing:

| Pattern         | Example                            |
| --------------- | ---------------------------------- |
| AWS Access Key  | `AKIAIOSFODNN7EXAMPLE`             |
| GitHub Token    | `ghp_...`, `github_pat_...`        |
| Private Key     | `-----BEGIN RSA PRIVATE KEY-----`  |
| JWT             | `eyJhbG...`                        |
| Slack Token     | `xoxb-...`                         |
| Stripe Key      | `sk_live_...`, `sk_test_...`       |
| Bearer Token    | `Bearer eyJ...`                    |
| Env Secrets     | `API_KEY=...`, `SECRET_KEY=...`    |
| Generic Secrets | `password: "..."`, `secret: "..."` |

Scanning is best-effort (regex heuristics). False positives are possible. Encrypted pastes bypass scanning since the server never sees plaintext.

## Plan Entitlements

| Limit             | Free    | Pro       | Team      |
| ----------------- | ------- | --------- | --------- |
| Max paste size    | 512 KB  | 5 MB      | 10 MB     |
| Max raw upload    | 1 MB    | 10 MB     | 25 MB     |
| API tokens        | 5       | 25        | 50        |
| Active pastes     | 500     | 5,000     | 25,000    |
| Personal storage  | 100 MB  | 5 GB      | 25 GB     |
| Workspaces owned  | 2       | 10        | 50        |
| Workspace members | 5       | 25        | 100       |
| Workspace storage | 100 MB  | 5 GB      | 25 GB     |
| Max expiration    | 30 days | Unlimited | Unlimited |

### Stripe Setup (Development)

1. Create a [Stripe test account](https://dashboard.stripe.com/test/developers)
2. Create Products and Prices for Pro and Team plans
3. Set `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_TEAM_PRICE_ID` in `.env`
4. For webhooks: `stripe listen --forward-to localhost:4000/v1/billing/webhook` and set `STRIPE_WEBHOOK_SECRET`

## OAuth Setup

OAuth is **optional** — email/password auth works without any OAuth configuration.

### GitHub

1. Go to **Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set **Authorization callback URL** to `http://localhost:4000/v1/auth/oauth/github/callback`
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`

### Google

1. Go to **Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID**
2. Add `http://localhost:4000/v1/auth/oauth/google/callback` as an authorized redirect URI
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

## Deployment

PasteKing consists of four services that need to run together:

| Service    | Runtime | Description                     | Default Port |
| ---------- | ------- | ------------------------------- | ------------ |
| **API**    | Node.js | Express REST API + WebSocket    | 4000         |
| **Web**    | Node.js | Next.js SSR frontend            | 3000         |
| **Worker** | Node.js | BullMQ background job processor | —            |
| **CLI**    | Node.js | Command-line tool (no server)   | —            |

All services also require:

| Dependency         | Purpose                   | Required |
| ------------------ | ------------------------- | -------- |
| **PostgreSQL 16+** | Primary database          | Yes      |
| **Redis 7+**       | Job queues, rate limiting | Yes      |
| **S3 / MinIO**     | Object storage (>64 KB)   | Yes      |

---

### Production Environment Variables

At minimum, set these for **every** deployment method:

```bash
NODE_ENV=production

# Generate a real secret: openssl rand -base64 48
SESSION_SECRET=<random-string-at-least-32-chars>

# Database — use a managed PostgreSQL or your own server
DATABASE_URL=postgresql://user:password@host:5432/pasteking

# Redis — use a managed Redis or your own server
REDIS_URL=redis://:password@host:6379

# Object storage — S3, R2, DigitalOcean Spaces, or self-hosted MinIO
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=<your-access-key>
S3_SECRET_KEY=<your-secret-key>
S3_BUCKET=pasteking
S3_REGION=us-east-1

# URLs — set to your actual domain
API_PORT=4000
API_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Worker
WORKER_CONCURRENCY=5
STORAGE_THRESHOLD=65536
```

Optional variables (OAuth, Stripe) are documented in the [Environment Variables](#environment-variables) section above.

### Build for Production

```bash
pnpm install --frozen-lockfile
pnpm build
```

Build outputs:

| App      | Output              | Start command                           |
| -------- | ------------------- | --------------------------------------- |
| `api`    | `apps/api/dist/`    | `node apps/api/dist/index.js`           |
| `web`    | `apps/web/.next/`   | `cd apps/web && npx next start -p 3000` |
| `worker` | `apps/worker/dist/` | `node apps/worker/dist/index.js`        |
| `cli`    | `apps/cli/dist/`    | `node apps/cli/dist/index.js`           |

### Database Setup (all methods)

Before starting the services for the first time, run migrations:

```bash
# Generate Prisma client
pnpm db:generate

# Apply all migrations to the production database
cd packages/db && DATABASE_URL=<your-production-url> npx prisma migrate deploy
```

> **Note**: Use `prisma migrate deploy` (not `migrate dev`) in production. It applies pending migrations without generating new ones.

---

### Option 1 — Docker Compose (Recommended for VPS)

This is the simplest approach. A single `docker-compose.prod.yml` runs all PasteKing services plus infrastructure.

#### 1. Create a production Dockerfile

Create `Dockerfile` in the project root:

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY apps/cli/package.json apps/cli/
COPY packages/config/package.json packages/config/
COPY packages/crypto/package.json packages/crypto/
COPY packages/db/package.json packages/db/
COPY packages/sdk/package.json packages/sdk/
COPY packages/storage/package.json packages/storage/
COPY packages/types/package.json packages/types/
COPY packages/validation/package.json packages/validation/
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm db:generate && pnpm build

# ── API production image ──────────────────────────────────────────────
FROM base AS api
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]

# ── Web production image ──────────────────────────────────────────────
FROM base AS web
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web ./apps/web
ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["npx", "next", "start", "-p", "3000"]

# ── Worker production image ───────────────────────────────────────────
FROM base AS worker
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/worker ./apps/worker
ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]
```

#### 2. Create `docker-compose.prod.yml`

```yaml
services:
  # ── Infrastructure ────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: pasteking
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: pasteking
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U pasteking']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redisdata:/data
    healthcheck:
      test: ['CMD', 'redis-cli', '-a', '${REDIS_PASSWORD}', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY}
    volumes:
      - miniodata:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ['CMD', 'mc', 'ready', 'local']
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Migrations (runs once then exits) ─────────────────────────────────
  migrate:
    build:
      context: .
      target: api
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://pasteking:${DB_PASSWORD}@postgres:5432/pasteking
    command: npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
    restart: 'no'

  # ── Application services ──────────────────────────────────────────────
  api:
    build:
      context: .
      target: api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    ports:
      - '4000:4000'
    environment:
      NODE_ENV: production
      API_PORT: 4000
      API_URL: ${API_URL}
      DATABASE_URL: postgresql://pasteking:${DB_PASSWORD}@postgres:5432/pasteking
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      SESSION_SECRET: ${SESSION_SECRET}
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_BUCKET: pasteking
      S3_REGION: us-east-1

  web:
    build:
      context: .
      target: web
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${API_URL}

  worker:
    build:
      context: .
      target: worker
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://pasteking:${DB_PASSWORD}@postgres:5432/pasteking
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_BUCKET: pasteking
      S3_REGION: us-east-1

volumes:
  pgdata:
  redisdata:
  miniodata:
```

#### 3. Create `.env.production`

```bash
# Infrastructure passwords
DB_PASSWORD=<strong-random-password>
REDIS_PASSWORD=<strong-random-password>

# Session
SESSION_SECRET=<random-string-at-least-32-chars>

# Object storage
S3_ACCESS_KEY=<minio-access-key>
S3_SECRET_KEY=<minio-secret-key>

# Public URL (set to your domain)
API_URL=https://api.yourdomain.com
```

#### 4. Deploy

```bash
# Build and start everything
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Seed database (optional, first time only)
docker compose -f docker-compose.prod.yml exec api npx tsx packages/db/prisma/seed.ts
```

#### 5. Reverse proxy (Nginx / Caddy)

Put Nginx or Caddy in front to handle TLS and route traffic:

**Caddy** (automatic HTTPS):

```
yourdomain.com {
    reverse_proxy localhost:3000
}

api.yourdomain.com {
    reverse_proxy localhost:4000
}
```

**Nginx**:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for live collaboration
    location /v1/ws {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

### Option 2 — VPS Manual Setup (Ubuntu/Debian)

For a traditional VPS (DigitalOcean, Hetzner, Linode, etc.) without Docker.

#### 1. Install system dependencies

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# pnpm
corepack enable && corepack prepare pnpm@9.15.4 --activate

# PostgreSQL 16
sudo apt-get install -y postgresql-16

# Redis 7
sudo apt-get install -y redis-server

# MinIO (or use an external S3 provider)
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
```

#### 2. Configure databases

```bash
# PostgreSQL — create database and user
sudo -u postgres psql -c "CREATE USER pasteking WITH PASSWORD '<db-password>';"
sudo -u postgres psql -c "CREATE DATABASE pasteking OWNER pasteking;"

# Redis — set a password in /etc/redis/redis.conf
sudo sed -i 's/^# requirepass .*/requirepass <redis-password>/' /etc/redis/redis.conf
sudo systemctl restart redis
```

#### 3. Clone, install, build

```bash
git clone <repo-url> /opt/pasteking
cd /opt/pasteking
pnpm install --frozen-lockfile

# Configure environment
cp .env.example .env
# Edit .env with production values (DATABASE_URL, REDIS_URL, SESSION_SECRET, S3_*, etc.)

# Set up database
pnpm db:generate
cd packages/db && npx prisma migrate deploy && cd ../..

# Build all packages
pnpm build
```

#### 4. Create systemd services

**`/etc/systemd/system/pasteking-api.service`**:

```ini
[Unit]
Description=PasteKing API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=pasteking
WorkingDirectory=/opt/pasteking
EnvironmentFile=/opt/pasteking/.env
ExecStart=/usr/bin/node apps/api/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/pasteking-web.service`**:

```ini
[Unit]
Description=PasteKing Web
After=network.target pasteking-api.service

[Service]
Type=simple
User=pasteking
WorkingDirectory=/opt/pasteking/apps/web
EnvironmentFile=/opt/pasteking/.env
ExecStart=/usr/bin/npx next start -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/pasteking-worker.service`**:

```ini
[Unit]
Description=PasteKing Worker
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=pasteking
WorkingDirectory=/opt/pasteking
EnvironmentFile=/opt/pasteking/.env
ExecStart=/usr/bin/node apps/worker/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

#### 5. Enable and start

```bash
sudo useradd --system --no-create-home pasteking
sudo chown -R pasteking:pasteking /opt/pasteking

sudo systemctl daemon-reload
sudo systemctl enable pasteking-api pasteking-web pasteking-worker
sudo systemctl start pasteking-api pasteking-web pasteking-worker

# Check status
sudo systemctl status pasteking-api
sudo journalctl -u pasteking-api -f
```

Then set up Nginx or Caddy as described above in the [Reverse proxy](#5-reverse-proxy-nginx--caddy) section.

---

### Option 3 — Vercel + External Services

Deploy the Next.js frontend to Vercel and host the API + worker separately.

> **Important**: Vercel only hosts the `web` app. The `api` and `worker` must run on a separate server since they require persistent processes, WebSocket connections, and BullMQ job processing.

#### Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌────────────┐
│   Vercel     │────▶│  VPS / Railway   │────▶│ PostgreSQL │
│  (Next.js)   │     │  (API + Worker)  │     │ Redis      │
└─────────────┘     └─────────────────┘     │ S3 / MinIO │
                                             └────────────┘
```

#### 1. Deploy the API + Worker

Use any of these hosting options for the API and worker:

- **Railway** / **Render** / **Fly.io** — container-based PaaS
- **DigitalOcean App Platform** — managed container hosting
- **Any VPS** — use the [Docker](#option-1--docker-compose-recommended-for-vps) or [manual](#option-2--vps-manual-setup-ubuntudebian) method above

Set the environment variables for the API and worker services pointing to your managed database and Redis.

#### 2. Deploy `web` to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# From the project root
vercel --cwd apps/web
```

Or connect the GitHub repo to Vercel with these settings:

| Setting              | Value                                    |
| -------------------- | ---------------------------------------- |
| **Framework**        | Next.js                                  |
| **Root Directory**   | `apps/web`                               |
| **Build Command**    | `cd ../.. && pnpm install && pnpm build` |
| **Output Directory** | `.next`                                  |

Set the environment variable in Vercel's dashboard:

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

#### 3. Configure CORS

Ensure the API allows requests from your Vercel domain. The API already reads `API_URL` for CORS origin. Set `API_URL` on your API server to match the Vercel domain, or update the CORS config to include it.

---

### Option 4 — Railway

Railway can host all services (API, web, worker) plus managed PostgreSQL and Redis.

#### 1. Create a Railway project

```bash
npm i -g @railway/cli
railway login
railway init
```

#### 2. Add infrastructure

In the Railway dashboard, add:

- **PostgreSQL** plugin → copies `DATABASE_URL` automatically
- **Redis** plugin → copies `REDIS_URL` automatically

For object storage, use **Cloudflare R2**, **AWS S3**, or **DigitalOcean Spaces** (Railway doesn't offer S3).

#### 3. Create three services

| Service  | Start Command                    | Root Directory |
| -------- | -------------------------------- | -------------- |
| `api`    | `node apps/api/dist/index.js`    | `/`            |
| `web`    | `cd apps/web && npx next start`  | `/`            |
| `worker` | `node apps/worker/dist/index.js` | `/`            |

Each service uses the same build command:

```bash
pnpm install --frozen-lockfile && pnpm db:generate && pnpm build
```

#### 4. Set shared environment variables

In Railway's shared variables (or per-service):

```bash
NODE_ENV=production
SESSION_SECRET=<random-string>
S3_ENDPOINT=<your-s3-endpoint>
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
S3_BUCKET=pasteking
S3_REGION=us-east-1
API_URL=https://<api-service>.railway.app
NEXT_PUBLIC_API_URL=https://<api-service>.railway.app
```

#### 5. Run migrations

```bash
railway run --service api -- npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

---

### Option 5 — Fly.io

Fly.io is well-suited for this project — it supports multi-process apps, WebSocket connections, and persistent volumes.

#### 1. Install Fly CLI and authenticate

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

#### 2. Create a `fly.toml` for the API

```toml
app = "pasteking-api"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"
  build-target = "api"

[env]
  NODE_ENV = "production"
  API_PORT = "4000"

[http_service]
  internal_port = 4000
  force_https = true

  [[http_service.checks]]
    path = "/health"
    interval = 15000
    timeout = 5000
```

#### 3. Create managed infrastructure

```bash
# PostgreSQL
fly postgres create --name pasteking-db
fly postgres attach pasteking-db --app pasteking-api

# Redis (Upstash)
fly redis create --name pasteking-redis
```

#### 4. Set secrets

```bash
fly secrets set \
  SESSION_SECRET="<random-string>" \
  S3_ENDPOINT="<endpoint>" \
  S3_ACCESS_KEY="<key>" \
  S3_SECRET_KEY="<secret>" \
  S3_BUCKET="pasteking" \
  S3_REGION="us-east-1" \
  --app pasteking-api
```

#### 5. Deploy

```bash
fly deploy --app pasteking-api
```

Repeat with separate `fly.toml` files for `pasteking-web` (target `web`, port `3000`) and `pasteking-worker` (target `worker`, no http_service).

---

### Option 6 — Coolify (Self-Hosted PaaS)

[Coolify](https://coolify.io) is an open-source, self-hosted alternative to Heroku/Vercel. Install it on any VPS and deploy PasteKing with a Git push.

1. Install Coolify on your VPS: `curl -fsSL https://get.coolify.io | bash`
2. Connect your GitHub/GitLab repository
3. Create three services pointing to the same repo, each with a different Docker build target (`api`, `web`, `worker`)
4. Add PostgreSQL and Redis resources from Coolify's one-click services
5. Set the environment variables in each service's settings
6. Deploy — Coolify handles TLS, reverse proxy, and zero-downtime deployments

---

### S3-Compatible Storage Providers

PasteKing works with any S3-compatible object storage. Here are common options:

| Provider                | `S3_ENDPOINT`                                   | Notes                       |
| ----------------------- | ----------------------------------------------- | --------------------------- |
| **AWS S3**              | `https://s3.amazonaws.com`                      | Set `S3_REGION` accordingly |
| **Cloudflare R2**       | `https://<account-id>.r2.cloudflarestorage.com` | No egress fees              |
| **DigitalOcean Spaces** | `https://<region>.digitaloceanspaces.com`       | Included with droplets      |
| **MinIO (self-hosted)** | `http://minio:9000`                             | Used in Docker Compose      |
| **Backblaze B2**        | `https://s3.<region>.backblazeb2.com`           | Cheapest storage            |
| **Wasabi**              | `https://s3.<region>.wasabisys.com`             | No egress fees              |

---

### Health Checks & Monitoring

The API exposes health check endpoints for use with load balancers and monitoring tools:

| Endpoint         | Purpose                                   |
| ---------------- | ----------------------------------------- |
| `GET /health`    | Returns `200 OK` if the server is running |
| `GET /v1/health` | Returns `200 OK` with version info        |

Recommended monitoring setup:

- **Uptime**: Use [UptimeRobot](https://uptimerobot.com), [BetterStack](https://betterstack.com), or similar to ping `/health` every 60 seconds
- **Logs**: The API uses [Pino](https://getpino.io/) structured JSON logging — pipe to your log aggregator (Datadog, Grafana Loki, etc.)
- **Errors**: Set `NODE_ENV=production` to suppress stack traces in API responses

## Contact

For support, feature requests, or contributions, please open an issue or submit a pull request on GitHub. For commercial inquiries or custom deployments, contact me at:

- **Email**: [ardenbimasaputra@gmail.com](mailto:ardenbimasaputra@gmail.com)
- **Website**: [https://pstkng.com](https://pstkng.com)
- **Telegram**: [@ardeanbimasaputra](https://t.me/ardeanbimasaputra)

## License

MIT
