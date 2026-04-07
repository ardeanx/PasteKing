import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash, randomBytes, scrypt } from 'node:crypto';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL']!,
});
const prisma = new PrismaClient({ adapter });

// ─── Crypto helpers (inlined to avoid build dependency) ──────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

function generateId(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length]!)
    .join('');
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err);
      resolve(`${salt}:${derived.toString('hex')}`);
    });
  });
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ─── Seed data ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

  // ══════════════════════════════════════════════════════════════════════════
  // ── Users ──────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const adminPassword = await hashPassword('admin123');
  const demoPassword = await hashPassword('demo1234');
  const alicePassword = await hashPassword('alice1234');
  const bobPassword = await hashPassword('bobsecure');
  const carolPassword = await hashPassword('carol5678');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pasteking.dev' },
    update: {},
    create: {
      email: 'admin@pasteking.dev',
      username: 'admin',
      passwordHash: adminPassword,
      platformRole: 'ADMIN',
    },
  });
  console.log(`  ✓ User: ${admin.username} (${admin.email}) [ADMIN]`);

  const demo = await prisma.user.upsert({
    where: { email: 'demo@pasteking.dev' },
    update: {},
    create: {
      email: 'demo@pasteking.dev',
      username: 'demo',
      passwordHash: demoPassword,
    },
  });
  console.log(`  ✓ User: ${demo.username} (${demo.email})`);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      username: 'alice',
      passwordHash: alicePassword,
      avatarUrl: 'https://api.dicebear.com/9.x/thumbs/svg?seed=alice',
    },
  });
  console.log(`  ✓ User: ${alice.username} (${alice.email})`);

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      username: 'bob',
      passwordHash: bobPassword,
      avatarUrl: 'https://api.dicebear.com/9.x/thumbs/svg?seed=bob',
    },
  });
  console.log(`  ✓ User: ${bob.username} (${bob.email})`);

  const carol = await prisma.user.upsert({
    where: { email: 'carol@example.com' },
    update: {},
    create: {
      email: 'carol@example.com',
      username: 'carol',
      passwordHash: carolPassword,
      avatarUrl: 'https://api.dicebear.com/9.x/thumbs/svg?seed=carol',
      status: 'RESTRICTED',
    },
  });
  console.log(`  ✓ User: ${carol.username} (${carol.email}) [RESTRICTED]`);

  // ══════════════════════════════════════════════════════════════════════════
  // ── API Tokens ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const tokenValue = `pk_${generateId(32)}`;
  const tokenPrefix = tokenValue.slice(0, 11);
  const tokenHash = sha256(tokenValue);

  const existingToken = await prisma.apiToken.findFirst({
    where: { userId: admin.id, name: 'Seed Token' },
  });

  if (!existingToken) {
    await prisma.apiToken.create({
      data: {
        userId: admin.id,
        name: 'Seed Token',
        prefix: tokenPrefix,
        tokenHash,
        scopes: [],
      },
    });
    console.log(`  ✓ API Token: ${tokenValue} (admin, full access)`);
  } else {
    console.log(`  ✓ API Token: already exists (admin, Seed Token)`);
  }

  const aliceTokenValue = `pk_${generateId(32)}`;
  const existingAliceToken = await prisma.apiToken.findFirst({
    where: { userId: alice.id, name: 'Alice Dev Token' },
  });
  if (!existingAliceToken) {
    await prisma.apiToken.create({
      data: {
        userId: alice.id,
        name: 'Alice Dev Token',
        prefix: aliceTokenValue.slice(0, 11),
        tokenHash: sha256(aliceTokenValue),
        scopes: ['paste:create', 'paste:read'],
      },
    });
    console.log(`  ✓ API Token: ${aliceTokenValue} (alice, limited)`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Workspaces ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const workspace1 = await prisma.workspace.upsert({
    where: { slug: 'acme-engineering' },
    update: {},
    create: {
      name: 'Acme Engineering',
      slug: 'acme-engineering',
      ownerId: alice.id,
    },
  });
  console.log(`  ✓ Workspace: ${workspace1.name} (owner: alice)`);

  const workspace2 = await prisma.workspace.upsert({
    where: { slug: 'open-source-team' },
    update: {},
    create: {
      name: 'Open Source Team',
      slug: 'open-source-team',
      ownerId: admin.id,
    },
  });
  console.log(`  ✓ Workspace: ${workspace2.name} (owner: admin)`);

  // ── Workspace members ──────────────────────────────────────────────────

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace1.id, userId: alice.id } },
    update: {},
    create: { workspaceId: workspace1.id, userId: alice.id, role: 'OWNER' },
  });
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace1.id, userId: bob.id } },
    update: {},
    create: { workspaceId: workspace1.id, userId: bob.id, role: 'ADMIN' },
  });
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace1.id, userId: demo.id } },
    update: {},
    create: { workspaceId: workspace1.id, userId: demo.id, role: 'MEMBER' },
  });
  console.log(`  ✓ Members: alice(OWNER), bob(ADMIN), demo(MEMBER) → Acme Engineering`);

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace2.id, userId: admin.id } },
    update: {},
    create: { workspaceId: workspace2.id, userId: admin.id, role: 'OWNER' },
  });
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace2.id, userId: alice.id } },
    update: {},
    create: { workspaceId: workspace2.id, userId: alice.id, role: 'MEMBER' },
  });
  console.log(`  ✓ Members: admin(OWNER), alice(MEMBER) → Open Source Team`);

  // ══════════════════════════════════════════════════════════════════════════
  // ── Pastes — Rich Variety ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // Helper to create a paste and log it
  async function seedPaste(data: Parameters<typeof prisma.paste.create>[0]['data'], label: string) {
    const paste = await prisma.paste.create({ data });
    console.log(`  ✓ Paste: "${paste.title ?? 'Untitled'}" (${label})`);
    return paste;
  }

  // ── 1. Public CODE pastes (various languages) ─────────────────────────

  const p1 = await seedPaste(
    {
      title: 'Hello World in TypeScript',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'typescript',
      content: `interface Greeting {
  name: string;
  emoji?: string;
}

function greet({ name, emoji = '👋' }: Greeting): string {
  return \`\${emoji} Hello, \${name}! Welcome to PasteKing.\`;
}

const users = ['Alice', 'Bob', 'Carol'];
users.forEach((u) => console.log(greet({ name: u })));`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: admin.id,
      createdAt: daysAgo(14),
    },
    'public, typescript, admin',
  );

  await seedPaste(
    {
      title: 'React Hook: useLocalStorage',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'typescript',
      content: `import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    },
    [key, storedValue],
  );

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        setStoredValue(JSON.parse(e.newValue) as T);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue] as const;
}`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      createdAt: daysAgo(10),
    },
    'public, typescript/react, alice',
  );

  await seedPaste(
    {
      title: 'Python FastAPI Example',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'python',
      content: `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(title="Snippet API", version="1.0.0")

class Snippet(BaseModel):
    title: str
    language: str
    content: str
    created_at: datetime = datetime.now()

db: dict[str, Snippet] = {}

@app.post("/snippets", status_code=201)
async def create_snippet(snippet: Snippet):
    snippet_id = f"snip_{len(db)+1:04d}"
    db[snippet_id] = snippet
    return {"id": snippet_id, **snippet.model_dump()}

@app.get("/snippets/{snippet_id}")
async def get_snippet(snippet_id: str):
    if snippet_id not in db:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return db[snippet_id]

@app.get("/snippets")
async def list_snippets(language: str | None = None):
    results = list(db.values())
    if language:
        results = [s for s in results if s.language == language]
    return {"count": len(results), "snippets": results}`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: bob.id,
      createdAt: daysAgo(8),
    },
    'public, python, bob',
  );

  await seedPaste(
    {
      title: 'Rust Error Handling Pattern',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'rust',
      content: `use std::fmt;
use std::io;

#[derive(Debug)]
enum AppError {
    Io(io::Error),
    Parse(std::num::ParseIntError),
    Custom(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Io(e) => write!(f, "IO error: {}", e),
            AppError::Parse(e) => write!(f, "Parse error: {}", e),
            AppError::Custom(msg) => write!(f, "{}", msg),
        }
    }
}

impl From<io::Error> for AppError {
    fn from(e: io::Error) -> Self {
        AppError::Io(e)
    }
}

impl From<std::num::ParseIntError> for AppError {
    fn from(e: std::num::ParseIntError) -> Self {
        AppError::Parse(e)
    }
}

fn read_and_parse(path: &str) -> Result<i32, AppError> {
    let contents = std::fs::read_to_string(path)?;
    let number: i32 = contents.trim().parse()?;
    if number < 0 {
        return Err(AppError::Custom("Number must be positive".into()));
    }
    Ok(number)
}

fn main() {
    match read_and_parse("number.txt") {
        Ok(n) => println!("Got: {}", n),
        Err(e) => eprintln!("Error: {}", e),
    }
}`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      createdAt: daysAgo(6),
    },
    'public, rust, alice',
  );

  await seedPaste(
    {
      title: 'Go HTTP Server',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'go',
      content: `package main

import (
\t"encoding/json"
\t"log"
\t"net/http"
\t"time"
)

type HealthResponse struct {
\tStatus  string \`json:"status"\`
\tUptime  string \`json:"uptime"\`
\tVersion string \`json:"version"\`
}

var startTime = time.Now()

func healthHandler(w http.ResponseWriter, r *http.Request) {
\tw.Header().Set("Content-Type", "application/json")
\tjson.NewEncoder(w).Encode(HealthResponse{
\t\tStatus:  "healthy",
\t\tUptime:  time.Since(startTime).String(),
\t\tVersion: "1.2.0",
\t})
}

func loggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
\treturn func(w http.ResponseWriter, r *http.Request) {
\t\tstart := time.Now()
\t\tnext(w, r)
\t\tlog.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
\t}
}

func main() {
\thttp.HandleFunc("/health", loggingMiddleware(healthHandler))
\tlog.Println("Server starting on :8080")
\tlog.Fatal(http.ListenAndServe(":8080", nil))
}`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: demo.id,
      createdAt: daysAgo(5),
    },
    'public, go, demo',
  );

  await seedPaste(
    {
      title: 'SQL Migration: Users + Posts',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'sql',
      content: `-- Migration: Create users and posts tables
-- Version: 2026-04-01

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50) UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  published   BOOLEAN DEFAULT FALSE,
  view_count  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_published ON posts(published) WHERE published = TRUE;
CREATE INDEX idx_users_email ON users(email);

-- Seed initial admin user
INSERT INTO users (username, email) VALUES ('admin', 'admin@example.com')
ON CONFLICT (username) DO NOTHING;

COMMIT;`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: bob.id,
      createdAt: daysAgo(12),
    },
    'public, sql, bob',
  );

  await seedPaste(
    {
      title: 'Dockerfile Multi-Stage Build',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'dockerfile',
      content: `# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup
RUN adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s CMD wget -q --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: admin.id,
      createdAt: daysAgo(3),
    },
    'public, dockerfile, admin',
  );

  await seedPaste(
    {
      title: 'CSS Grid Dashboard Layout',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'css',
      content: `:root {
  --sidebar-width: 260px;
  --header-height: 64px;
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-border: #334155;
  --color-accent: #3b82f6;
}

.dashboard {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: var(--header-height) 1fr;
  grid-template-areas:
    "sidebar header"
    "sidebar main";
  min-height: 100vh;
  background: var(--color-bg);
}

.dashboard__header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.dashboard__sidebar {
  grid-area: sidebar;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 16px;
  overflow-y: auto;
}

.dashboard__main {
  grid-area: main;
  padding: 24px;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .dashboard {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "main";
  }
  .dashboard__sidebar {
    display: none;
  }
}`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      createdAt: daysAgo(2),
    },
    'public, css, alice',
  );

  await seedPaste(
    {
      title: 'Bash Deployment Script',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'bash',
      content: `#!/usr/bin/env bash
set -euo pipefail

APP_NAME="pasteking"
DEPLOY_DIR="/opt/\${APP_NAME}"
BACKUP_DIR="/opt/backups/\${APP_NAME}"
BRANCH="\${1:-main}"
MAX_BACKUPS=5

RED='\\033[0;31m'; GREEN='\\033[0;32m'; YELLOW='\\033[1;33m'; NC='\\033[0m'
log()  { echo -e "\${GREEN}[DEPLOY]\${NC} $*"; }
warn() { echo -e "\${YELLOW}[WARN]\${NC} $*"; }
err()  { echo -e "\${RED}[ERROR]\${NC} $*" >&2; }

command -v node >/dev/null || { err "Node.js not found"; exit 1; }
command -v pnpm >/dev/null || { err "pnpm not found"; exit 1; }

log "Deploying branch: \${BRANCH}"

if [ -d "\${DEPLOY_DIR}" ]; then
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  mkdir -p "\${BACKUP_DIR}"
  log "Creating backup: \${BACKUP_DIR}/\${TIMESTAMP}"
  cp -r "\${DEPLOY_DIR}" "\${BACKUP_DIR}/\${TIMESTAMP}"
  cd "\${BACKUP_DIR}"
  ls -dt */ | tail -n +\$((MAX_BACKUPS + 1)) | xargs rm -rf --
fi

cd "\${DEPLOY_DIR}"
git fetch origin && git checkout "\${BRANCH}" && git pull origin "\${BRANCH}"
pnpm install --frozen-lockfile && pnpm build

log "Restarting services..."
sudo systemctl restart "\${APP_NAME}-api"
sudo systemctl restart "\${APP_NAME}-worker"
log "✅ Deployment complete!"`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: admin.id,
      createdAt: daysAgo(1),
    },
    'public, bash, admin',
  );

  await seedPaste(
    {
      title: null, // Untitled paste
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'javascript',
      content: `// Quick snippet: debounce function
const debounce = (fn, ms = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
};

const handleSearch = debounce((query) => {
  console.log('Searching:', query);
  fetch(\`/api/search?q=\${encodeURIComponent(query)}\`);
}, 400);`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: null, // Anonymous / guest
      createdAt: daysAgo(4),
    },
    'public, javascript, anonymous, untitled',
  );

  // ── 2. TEXT pastes ────────────────────────────────────────────────────

  await seedPaste(
    {
      title: 'Meeting Notes: Sprint Retrospective',
      mode: 'TEXT',
      visibility: 'UNLISTED',
      content: `Sprint 42 Retrospective — April 3, 2026

Team: Platform Engineering (6 members)

What went well:
  • Shipped Prisma 7 migration ahead of schedule
  • Zero downtime during database migration
  • New search indexing is 3x faster
  • Code review turnaround improved to < 4 hours

What could improve:
  • Flaky E2E tests blocked 3 deployments this sprint
  • Documentation for the new storage adapter is incomplete
  • Need better alerting for background job failures

Action items:
  [alice]  Fix flaky paste-creation E2E tests by April 8
  [bob]    Write storage adapter migration guide
  [admin]  Set up PagerDuty alerting for worker queue
  [demo]   Update API docs for v2 endpoints

Next sprint focus:
  - Workspace billing integration
  - CLI tool public beta
  - Performance benchmarking for large pastes (>1MB)`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      createdAt: daysAgo(4),
    },
    'unlisted, text, alice',
  );

  await seedPaste(
    {
      title: 'Recipe: Garlic Butter Pasta',
      mode: 'TEXT',
      visibility: 'PUBLIC',
      content: `🍝 Garlic Butter Pasta (15 minutes, serves 2)

Ingredients:
  200g spaghetti
  4 cloves garlic, thinly sliced
  3 tbsp unsalted butter
  2 tbsp olive oil
  1/4 tsp red pepper flakes
  1/3 cup freshly grated Parmesan
  Fresh parsley, chopped
  Salt & black pepper to taste
  Reserved pasta water (1/2 cup)

Steps:
  1. Cook spaghetti in salted boiling water until al dente.
     Reserve 1/2 cup pasta water before draining.
  2. In a large pan, heat olive oil over medium heat.
     Add sliced garlic and cook until golden (about 90 seconds).
  3. Add butter and red pepper flakes. Swirl until butter melts.
  4. Add drained pasta directly to the pan.
     Toss with 2-3 tablespoons of pasta water.
  5. Remove from heat. Add Parmesan and toss vigorously.
  6. Season with salt and pepper. Top with fresh parsley.

Notes:
  - Use good quality Parmesan (not the pre-grated stuff)
  - The pasta water starch is key to the sauce emulsifying`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: null, // Anonymous
      createdAt: daysAgo(7),
    },
    'public, text, anonymous',
  );

  await seedPaste(
    {
      title: 'Private Journal Entry',
      mode: 'TEXT',
      visibility: 'PRIVATE',
      content: `April 5, 2026

Today I finally got the workspace billing integration working.
It took three attempts to get the Stripe webhook handling right.
The key insight was that workspace billing needs a separate
customer ID from personal billing.

Feeling good about the progress. The team is moving fast.

TODO tomorrow:
  - Write tests for the billing webhook edge cases
  - Review Carol's PR for the CLI auth flow
  - Schedule 1-on-1 with Bob about his promotion`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: demo.id,
      createdAt: daysAgo(2),
    },
    'private, text, demo',
  );

  // ── 3. MARKDOWN pastes ────────────────────────────────────────────────

  await seedPaste(
    {
      title: 'PasteKing API Quick Reference',
      mode: 'MARKDOWN',
      visibility: 'PUBLIC',
      content: `# PasteKing API Quick Reference

## Authentication

All authenticated endpoints require a session cookie or API token:

\`\`\`bash
curl -H "Authorization: Bearer pk_xxxxx" https://api.pasteking.dev/v1/pastes
\`\`\`

## Endpoints

### Create a paste

\`\`\`bash
curl -X POST https://api.pasteking.dev/v1/pastes \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My Snippet",
    "content": "console.log(\\"hello\\")",
    "mode": "CODE",
    "language": "javascript",
    "visibility": "PUBLIC"
  }'
\`\`\`

### Create via raw endpoint

\`\`\`bash
echo "some log output" | curl -X POST https://api.pasteking.dev/v1/pastes/raw \\
  -H "Content-Type: text/plain" \\
  --data-binary @-
\`\`\`

### Get a paste

\`\`\`bash
curl https://api.pasteking.dev/v1/pastes/<id>
\`\`\`

### Delete a paste

\`\`\`bash
# As owner (with session)
curl -X DELETE https://api.pasteking.dev/v1/pastes/<id>

# With delete token
curl -X DELETE https://api.pasteking.dev/v1/pastes/<id> \\
  -H "X-Delete-Token: <token>"
\`\`\`

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /pastes | 30/min |
| GET /pastes | 120/min |
| DELETE /pastes | 10/min |`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: admin.id,
      createdAt: daysAgo(13),
    },
    'public, markdown, admin',
  );

  await seedPaste(
    {
      title: 'Project Setup Guide',
      mode: 'MARKDOWN',
      visibility: 'PUBLIC',
      content: `# Getting Started with PasteKing

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 9
- **PostgreSQL** >= 16
- **Redis** >= 7

## Quick Start

\`\`\`bash
git clone https://github.com/pasteking/pasteking.git
cd pasteking
pnpm install
cp .env.example .env
cd packages/db
npx prisma migrate dev
npx prisma db seed
cd ../..
pnpm dev
\`\`\`

## Project Structure

\`\`\`
├── apps/
│   ├── api/        # Express REST API (port 4000)
│   ├── web/        # Next.js frontend (port 3000)
│   ├── cli/        # Command-line tool
│   └── worker/     # Background job processor
├── packages/
│   ├── config/     # Shared configuration
│   ├── crypto/     # Hashing & encryption utilities
│   ├── db/         # Prisma schema & client
│   ├── sdk/        # TypeScript API client
│   ├── storage/    # Object storage abstraction
│   ├── types/      # Shared type definitions
│   └── validation/ # Zod schemas
└── turbo.json      # Turborepo config
\`\`\`

## Available Scripts

| Command | Description |
|---------|-------------|
| \`pnpm dev\` | Start all services in dev mode |
| \`pnpm build\` | Build all packages |
| \`pnpm test\` | Run all tests |
| \`pnpm lint\` | Lint all packages |`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      createdAt: daysAgo(11),
    },
    'public, markdown, alice',
  );

  await seedPaste(
    {
      title: 'Changelog v2.0.0',
      mode: 'MARKDOWN',
      visibility: 'UNLISTED',
      content: `# Changelog — v2.0.0 (April 2026)

## 🚀 New Features

- **Workspaces**: Create teams and collaborate
- **Fork & Edit**: Fork any public paste
- **Revision History**: Full version history with diff view
- **Syntax Highlighting**: 80+ languages
- **Encrypted Pastes**: Client-side AES-256-GCM
- **Burn After Read**: Self-destructing pastes
- **CLI Tool**: \`pasteking paste < file.txt\`

## 🔧 Improvements

- Redesigned dashboard with analytics
- Admin moderation panel with bulk actions
- API rate limiting per endpoint
- OAuth login via GitHub and Google

## 🐛 Bug Fixes

- Fixed paste expiration timezone edge cases
- Fixed workspace invite emails in production
- Fixed content overflow on mobile
- Fixed delete token validation

## ⚠️ Breaking Changes

- API v1 now requires \`Content-Type: application/json\`
- Removed \`GET /pastes/recent\`
- Minimum password length: 8 characters`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: admin.id,
      createdAt: daysAgo(9),
    },
    'unlisted, markdown, admin',
  );

  // ── 4. LOG pastes ─────────────────────────────────────────────────────

  await seedPaste(
    {
      title: 'Server Error Log — Production Incident',
      mode: 'LOG',
      visibility: 'UNLISTED',
      burnAfterRead: true,
      content: `[2026-04-06T10:23:41.123Z] ERROR api: Connection refused to database host=db-primary port=5432
[2026-04-06T10:23:41.124Z] WARN  api: Retrying database connection in 5s (attempt 1/3)
[2026-04-06T10:23:46.130Z] ERROR api: Connection refused to database host=db-primary port=5432
[2026-04-06T10:23:46.131Z] WARN  api: Retrying database connection in 5s (attempt 2/3)
[2026-04-06T10:23:51.002Z] INFO  api: Database connection restored host=db-primary latency=12ms
[2026-04-06T10:23:51.005Z] INFO  api: Processing backlog: 23 pending requests
[2026-04-06T10:23:51.200Z] INFO  api: Backlog cleared successfully processed=23 failed=0
[2026-04-06T10:23:51.201Z] WARN  api: Connection pool was exhausted during outage max=20 waiting=23
[2026-04-06T10:24:00.000Z] INFO  health: Health check passed uptime=4832s memory=142MB`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: admin.id,
      createdAt: daysAgo(1),
    },
    'unlisted, log, burn-after-read, admin',
  );

  await seedPaste(
    {
      title: 'CI/CD Pipeline Output',
      mode: 'LOG',
      visibility: 'PUBLIC',
      content: `$ pnpm install --frozen-lockfile
Lockfile is up to date, resolution step is skipped
Already up to date — Done in 1.2s

$ pnpm build
@pasteking/config:build:     > tsc --project tsconfig.build.json
@pasteking/types:build:      > tsc --project tsconfig.json
@pasteking/crypto:build:     > tsc --project tsconfig.json
@pasteking/db:build:         > tsc --project tsconfig.json
@pasteking/storage:build:    > tsc --project tsconfig.json
@pasteking/validation:build: > tsc --project tsconfig.json
@pasteking/sdk:build:        > tsc --project tsconfig.json
@pasteking/cli:build:        > tsc --project tsconfig.json
@pasteking/worker:build:     > tsc --project tsconfig.json
@pasteking/api:build:        > tsc --project tsconfig.json
@pasteking/web:build:        > next build
@pasteking/web:build:        ✓ Compiled successfully in 4.3s
Tasks:    11 successful, 11 total — Time: 12.1s

$ pnpm test
 ✓ packages/validation (12 tests) 45ms
 ✓ packages/crypto (8 tests) 120ms
 ✓ apps/api/auth (18 tests) 340ms
 ✓ apps/api/pastes (24 tests) 280ms
 ✓ apps/cli (6 tests) 90ms
 Tests: 68 passed, 68 total — Time: 2.4s

✅ All checks passed. Ready to deploy.`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: bob.id,
      createdAt: daysAgo(1),
    },
    'public, log, bob',
  );

  await seedPaste(
    {
      title: 'Nginx Access Log Sample',
      mode: 'LOG',
      visibility: 'PUBLIC',
      content: `192.168.1.100 - - [06/Apr/2026:14:22:01 +0000] "GET /v1/pastes/cm12abc3d4 HTTP/1.1" 200 1432 "-" "Mozilla/5.0"
192.168.1.101 - - [06/Apr/2026:14:22:02 +0000] "POST /v1/pastes HTTP/1.1" 201 856 "-" "PasteKing-CLI/1.0.0"
192.168.1.102 - alice [06/Apr/2026:14:22:03 +0000] "GET /v1/pastes?author=me HTTP/1.1" 200 4521 "-" "Mozilla/5.0"
192.168.1.100 - - [06/Apr/2026:14:22:04 +0000] "DELETE /v1/pastes/cm12abc3d4 HTTP/1.1" 204 0 "-" "Mozilla/5.0"
192.168.1.103 - - [06/Apr/2026:14:22:05 +0000] "GET /v1/pastes/nonexistent HTTP/1.1" 404 132 "-" "curl/8.5.0"
192.168.1.104 - - [06/Apr/2026:14:22:06 +0000] "POST /v1/pastes HTTP/1.1" 429 98 "-" "bot/1.0"
192.168.1.105 - bob [06/Apr/2026:14:22:07 +0000] "PUT /v1/pastes/cm45def6g7 HTTP/1.1" 200 1100 "-" "Mozilla/5.0"
10.0.0.1 - - [06/Apr/2026:14:22:08 +0000] "GET /health HTTP/1.1" 200 42 "-" "kube-probe/1.28"`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: null, // anonymous
      createdAt: daysAgo(3),
    },
    'public, log, anonymous',
  );

  // ── 5. Special status pastes ──────────────────────────────────────────

  await seedPaste(
    {
      title: 'Temporary Config (Expired)',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'yaml',
      status: 'EXPIRED',
      content: null,
      contentRef: null,
      deleteTokenHash: sha256(generateId(32)),
      authorId: bob.id,
      expiresAt: daysAgo(1),
      createdAt: daysAgo(8),
    },
    'public, yaml, EXPIRED, bob',
  );

  await seedPaste(
    {
      title: 'One-Time Secret',
      mode: 'TEXT',
      visibility: 'UNLISTED',
      status: 'BURNED',
      burnAfterRead: true,
      content: null,
      deleteTokenHash: sha256(generateId(32)),
      authorId: carol.id,
      createdAt: daysAgo(5),
    },
    'unlisted, text, BURNED, carol',
  );

  await seedPaste(
    {
      title: 'Suspicious Paste',
      mode: 'TEXT',
      visibility: 'PUBLIC',
      moderationStatus: 'PENDING_REVIEW',
      content: `This paste has been flagged for review by the automated system.
It contains patterns that match known spam heuristics.
A moderator will review it shortly.`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: carol.id,
      createdAt: daysAgo(2),
    },
    'public, text, PENDING_REVIEW, carol',
  );

  await seedPaste(
    {
      title: 'Hidden by Moderator',
      mode: 'TEXT',
      visibility: 'PUBLIC',
      moderationStatus: 'HIDDEN',
      content: `This paste was hidden by a moderator because it contained promotional spam.`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: null,
      createdAt: daysAgo(6),
    },
    'public, text, HIDDEN, anonymous',
  );

  await seedPaste(
    {
      title: 'Expires in 7 Days',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'json',
      content: `{
  "name": "temporary-config",
  "version": "1.0.0",
  "settings": {
    "debug": true,
    "logLevel": "verbose",
    "featureFlags": {
      "newDashboard": true,
      "betaSearch": true,
      "workspaceBilling": false
    }
  },
  "note": "This config expires in 7 days. Copy what you need!"
}`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      expiresAt: daysFromNow(7),
      createdAt: daysAgo(0),
    },
    'public, json, expires-in-7d, alice',
  );

  await seedPaste(
    {
      title: 'Expires in 30 Days',
      mode: 'TEXT',
      visibility: 'UNLISTED',
      content: `Shared credentials for staging environment.
This paste will auto-expire in 30 days.

Host: staging.internal.example.com
Port: 5432
Database: pasteking_staging
Username: deploy`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: demo.id,
      expiresAt: daysFromNow(30),
      createdAt: daysAgo(1),
    },
    'unlisted, text, expires-in-30d, demo',
  );

  // ── 6. Workspace pastes ───────────────────────────────────────────────

  const wsPaste1 = await seedPaste(
    {
      title: 'Team API Standards',
      mode: 'MARKDOWN',
      visibility: 'PRIVATE',
      content: `# Acme Engineering — API Standards

## Naming Conventions

- Use \`camelCase\` for JSON fields
- Use \`kebab-case\` for URL paths
- Use \`SCREAMING_SNAKE_CASE\` for constants

## Response Shape

\`\`\`json
{
  "success": boolean,
  "data": object | array | null,
  "error": { "code": "UPPER_SNAKE", "message": "..." }
}
\`\`\`

## Error Codes

| Code | HTTP | When |
|------|------|------|
| NOT_FOUND | 404 | Resource missing |
| FORBIDDEN | 403 | No permission |
| VALIDATION_ERROR | 400 | Bad input |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unexpected error |`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      workspaceId: workspace1.id,
      createdAt: daysAgo(7),
    },
    'private, markdown, workspace:acme, alice',
  );

  await seedPaste(
    {
      title: 'Workspace Env Template',
      mode: 'CODE',
      visibility: 'PRIVATE',
      language: 'bash',
      content: `# Acme Engineering — Environment Variables Template
NODE_ENV=development
API_PORT=4000
WEB_PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/acme_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-in-production
SESSION_SECRET=also-change-me
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=us-east-1`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: bob.id,
      workspaceId: workspace1.id,
      createdAt: daysAgo(6),
    },
    'private, bash, workspace:acme, bob',
  );

  await seedPaste(
    {
      title: 'OSS Contribution Guide',
      mode: 'MARKDOWN',
      visibility: 'PUBLIC',
      content: `# Contributing to PasteKing

Thanks for considering contributing! 🎉

## How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (\`git checkout -b feat/amazing-feature\`)
3. **Commit** your changes (\`git commit -m 'feat: add amazing feature'\`)
4. **Push** to the branch (\`git push origin feat/amazing-feature\`)
5. **Open** a Pull Request

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- \`feat:\` — New feature
- \`fix:\` — Bug fix
- \`docs:\` — Documentation
- \`refactor:\` — Code refactoring
- \`test:\` — Adding tests
- \`chore:\` — Maintenance`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: admin.id,
      workspaceId: workspace2.id,
      createdAt: daysAgo(10),
    },
    'public, markdown, workspace:oss-team, admin',
  );

  // ── 7. Encrypted paste ────────────────────────────────────────────────

  await seedPaste(
    {
      title: 'Encrypted Secrets',
      mode: 'TEXT',
      visibility: 'UNLISTED',
      encrypted: true,
      encryptionIv: randomBytes(12).toString('hex'),
      encryptionVersion: 1,
      content: 'U2FsdGVkX1+FAKE_ENCRYPTED_CONTENT_FOR_DEMO_PURPOSES_ONLY',
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      createdAt: daysAgo(3),
    },
    'unlisted, text, encrypted, alice',
  );

  // ── 8. Fork chain ────────────────────────────────────────────────────

  const original = await seedPaste(
    {
      title: 'Original: Fibonacci Implementations',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'python',
      content: `# Three ways to compute Fibonacci numbers

def fib_recursive(n: int) -> int:
    if n <= 1:
        return n
    return fib_recursive(n - 1) + fib_recursive(n - 2)

def fib_memo(n: int, memo: dict = {}) -> int:
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo)
    return memo[n]

def fib_iterative(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

import time
for func in [fib_recursive, fib_memo, fib_iterative]:
    start = time.perf_counter()
    result = func(30)
    elapsed = time.perf_counter() - start
    print(f"{func.__name__:20s} fib(30) = {result:>10d}  ({elapsed:.6f}s)")`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: bob.id,
      createdAt: daysAgo(9),
    },
    'public, python, original, bob',
  );

  await seedPaste(
    {
      title: 'Fork: Fibonacci with Generator',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'python',
      forkedFromId: original.id,
      content: `# Forked from: Fibonacci Implementations
# Added: Generator-based approach

def fib_generator(n: int) -> int:
    def _gen():
        a, b = 0, 1
        while True:
            yield a
            a, b = b, a + b
    gen = _gen()
    for _ in range(n + 1):
        result = next(gen)
    return result

def fib_sequence(count: int) -> list[int]:
    def _gen():
        a, b = 0, 1
        while True:
            yield a
            a, b = b, a + b
    gen = _gen()
    return [next(gen) for _ in range(count)]

print(fib_sequence(15))
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      createdAt: daysAgo(8),
    },
    'public, python, fork, alice',
  );

  // ── 9. Paste with revisions ───────────────────────────────────────────

  const revisedPaste = await seedPaste(
    {
      title: 'Environment Config (v3)',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'typescript',
      currentRevision: 3,
      content: `// v3 — Added Redis cluster support and connection pooling
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  REDIS_URL: z.string().url(),
  REDIS_CLUSTER: z.coerce.boolean().default(false),
  REDIS_CLUSTER_NODES: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  SESSION_TTL: z.coerce.number().default(86400),
});

export type Env = z.infer<typeof envSchema>;`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      createdAt: daysAgo(10),
    },
    'public, typescript, 3 revisions, alice',
  );

  await prisma.pasteRevision.createMany({
    data: [
      {
        pasteId: revisedPaste.id,
        revisionNumber: 1,
        content: `// v1 — Basic env config\nimport { z } from 'zod';\n\nexport const envSchema = z.object({\n  NODE_ENV: z.enum(['development', 'production']),\n  PORT: z.coerce.number().default(3000),\n  DATABASE_URL: z.string().url(),\n  JWT_SECRET: z.string().min(32),\n});`,
        createdAt: daysAgo(10),
      },
      {
        pasteId: revisedPaste.id,
        revisionNumber: 2,
        content: `// v2 — Added Redis and session TTL\nimport { z } from 'zod';\n\nexport const envSchema = z.object({\n  NODE_ENV: z.enum(['development', 'staging', 'production']),\n  PORT: z.coerce.number().default(3000),\n  DATABASE_URL: z.string().url(),\n  REDIS_URL: z.string().url(),\n  JWT_SECRET: z.string().min(32),\n  SESSION_TTL: z.coerce.number().default(86400),\n});`,
        createdAt: daysAgo(7),
      },
      {
        pasteId: revisedPaste.id,
        revisionNumber: 3,
        content: revisedPaste.content,
        createdAt: daysAgo(3),
      },
    ],
  });
  console.log(`  ✓ Revisions: 3 revisions for "${revisedPaste.title}"`);

  // ── 10. More anonymous / guest pastes ─────────────────────────────────

  await seedPaste(
    {
      title: null,
      mode: 'TEXT',
      visibility: 'PUBLIC',
      content: `just testing this paste service. looks nice!

todo:
- try code mode
- try the API
- check if CLI works on linux`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: null,
      createdAt: daysAgo(1),
    },
    'public, text, anonymous, untitled',
  );

  await seedPaste(
    {
      title: null,
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minimal Landing Page</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .hero { text-align: center; max-width: 600px; padding: 2rem; }
    h1 {
      font-size: 3rem;
      background: linear-gradient(to right, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
    }
    p { font-size: 1.2rem; color: #94a3b8; line-height: 1.6; }
    .btn {
      display: inline-block; margin-top: 2rem; padding: 0.75rem 2rem;
      background: #3b82f6; color: white; border-radius: 8px;
      text-decoration: none; font-weight: 600; transition: background 0.2s;
    }
    .btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="hero">
    <h1>Ship Fast</h1>
    <p>A minimal landing page template.</p>
    <a href="#" class="btn">Get Started</a>
  </div>
</body>
</html>`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: null,
      createdAt: daysAgo(2),
    },
    'public, html, anonymous, untitled',
  );

  await seedPaste(
    {
      title: 'Docker Compose — Dev Stack',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'yaml',
      content: `version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: pasteking
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: pasteking_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 100mb --maxmemory-policy allkeys-lru

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"

volumes:
  pgdata:`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: demo.id,
      createdAt: daysAgo(5),
    },
    'public, yaml, demo',
  );

  await seedPaste(
    {
      title: 'C# LINQ Examples',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'csharp',
      content: `using System;
using System.Linq;
using System.Collections.Generic;

var people = new List<(string Name, int Age, string City)>
{
    ("Alice", 30, "Seattle"),
    ("Bob", 25, "Portland"),
    ("Carol", 35, "Seattle"),
    ("Dave", 28, "Portland"),
    ("Eve", 32, "Denver"),
};

var seattleResidents = people
    .Where(p => p.City == "Seattle")
    .OrderBy(p => p.Name)
    .Select(p => $"{p.Name} (age {p.Age})")
    .ToList();
Console.WriteLine("Seattle: " + string.Join(", ", seattleResidents));

var byCity = people
    .GroupBy(p => p.City)
    .Select(g => new { City = g.Key, Count = g.Count(), AvgAge = g.Average(p => p.Age) });

foreach (var group in byCity)
    Console.WriteLine($"{group.City}: {group.Count} people, avg age {group.AvgAge:F1}");`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: bob.id,
      createdAt: daysAgo(4),
    },
    'public, csharp, bob',
  );

  await seedPaste(
    {
      title: 'Terraform AWS S3 Bucket',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'hcl',
      content: `resource "aws_s3_bucket" "paste_storage" {
  bucket = "pasteking-\${var.environment}-storage"
  tags = {
    Name        = "PasteKing Storage"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_versioning" "paste_storage" {
  bucket = aws_s3_bucket.paste_storage.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "paste_storage" {
  bucket = aws_s3_bucket.paste_storage.id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    noncurrent_version_expiration { noncurrent_days = 30 }
  }
  rule {
    id     = "transition-to-glacier"
    status = "Enabled"
    transition { days = 90; storage_class = "GLACIER" }
  }
}

variable "environment" {
  type    = string
  default = "dev"
}

output "bucket_arn" {
  value = aws_s3_bucket.paste_storage.arn
}`,
      deleteTokenHash: sha256(generateId(32)),
      authorId: alice.id,
      createdAt: daysAgo(3),
    },
    'public, hcl/terraform, alice',
  );

  // ── 11. Paste views (analytics) ───────────────────────────────────────

  const viewData = [];
  for (let i = 0; i < 47; i++) {
    viewData.push({
      pasteId: p1.id,
      ipHash: sha256(`192.168.1.${(i % 30) + 1}`),
      createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
    });
  }
  await prisma.pasteView.createMany({ data: viewData });
  console.log(`  ✓ Views: 47 records for "${p1.title}"`);

  const viewBatch2 = [];
  for (let i = 0; i < 23; i++) {
    viewBatch2.push({
      pasteId: original.id,
      ipHash: sha256(`10.0.0.${(i % 20) + 1}`),
      createdAt: new Date(Date.now() - Math.random() * 9 * 24 * 60 * 60 * 1000),
    });
  }
  await prisma.pasteView.createMany({ data: viewBatch2 });
  console.log(`  ✓ Views: 23 records for "${original.title}"`);

  const viewBatch3 = [];
  for (let i = 0; i < 12; i++) {
    viewBatch3.push({
      pasteId: wsPaste1.id,
      ipHash: sha256(`172.16.0.${(i % 10) + 1}`),
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    });
  }
  await prisma.pasteView.createMany({ data: viewBatch3 });
  console.log(`  ✓ Views: 12 records for "${wsPaste1.title}"`);

  // ── 12. Reports ───────────────────────────────────────────────────────

  const carolPastes = await prisma.paste.findMany({
    where: { authorId: carol.id, moderationStatus: 'PENDING_REVIEW' },
    take: 1,
  });
  if (carolPastes[0]) {
    const existingReport = await prisma.report.findUnique({
      where: { pasteId_reporterId: { pasteId: carolPastes[0].id, reporterId: alice.id } },
    });
    if (!existingReport) {
      await prisma.report.create({
        data: {
          pasteId: carolPastes[0].id,
          reporterId: alice.id,
          reason: 'SPAM',
          description: 'This looks like automated spam content being posted repeatedly.',
          status: 'OPEN',
        },
      });
      console.log(`  ✓ Report: alice reported carol's paste as SPAM`);
    }
  }

  // ── 13. Abuse flags ───────────────────────────────────────────────────

  if (carolPastes[0]) {
    await prisma.abuseFlag.create({
      data: {
        type: 'SPAM_HEURISTIC',
        severity: 'medium',
        pasteId: carolPastes[0].id,
        userId: carol.id,
        metadata: {
          reason: 'Content matches known spam patterns',
          confidence: 0.87,
          matchedPatterns: ['repeated-links', 'keyword-stuffing'],
        },
      },
    });
    console.log(`  ✓ AbuseFlag: SPAM_HEURISTIC on carol's paste`);
  }

  await prisma.abuseFlag.create({
    data: {
      type: 'EXCESSIVE_PASTE_RATE',
      severity: 'low',
      userId: carol.id,
      metadata: {
        pastesInLastHour: 15,
        threshold: 10,
        window: '1 hour',
      },
    },
  });
  console.log(`  ✓ AbuseFlag: EXCESSIVE_PASTE_RATE on carol`);

  // ══════════════════════════════════════════════════════════════════════════
  // ── Summary ────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n✅ Seeding complete!\n');
  console.log('📋 Login credentials:');
  console.log('  admin@pasteking.dev   / admin123   [ADMIN]');
  console.log('  demo@pasteking.dev    / demo1234');
  console.log('  alice@example.com     / alice1234');
  console.log('  bob@example.com       / bobsecure');
  console.log('  carol@example.com     / carol5678  [RESTRICTED]');
  console.log('');
  console.log('📦 Workspaces:');
  console.log('  Acme Engineering   (owner: alice, members: bob, demo)');
  console.log('  Open Source Team   (owner: admin, members: alice)');
  console.log('');
  console.log('📊 Data seeded:');
  console.log('  5 users, 2 workspaces, 2 API tokens');
  console.log('  25+ pastes (CODE/TEXT/LOG/MARKDOWN, all visibilities)');
  console.log(
    '  Languages: typescript, python, rust, go, sql, dockerfile, css, bash, javascript, html, yaml, csharp, hcl, json',
  );
  console.log('  Special: expired, burned, encrypted, forked, multi-revision');
  console.log('  Moderation: pending review, hidden, abuse flags, reports');
  console.log('  Analytics: 80+ paste view records');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
