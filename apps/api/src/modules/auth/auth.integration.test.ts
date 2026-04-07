import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../app';

// In-memory stores
const userStore = new Map<string, Record<string, unknown>>();
const sessionStore = new Map<string, Record<string, unknown>>();
const tokenStore = new Map<string, Record<string, unknown>>();
let userIdCounter = 0;

vi.mock('@pasteking/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        for (const u of userStore.values()) {
          if (where.id && u.id === where.id) return u;
          if (where.email && u.email === where.email) return u;
          if (where.username && u.username === where.username) return u;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `user_${++userIdCounter}`;
        const user = {
          id,
          email: data.email,
          username: data.username,
          passwordHash: data.passwordHash,
          planId: 'free',
          subscriptionStatus: 'FREE',
          currentPeriodEnd: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        userStore.set(id, user);
        return user;
      }),
    },
    session: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const session = {
          id,
          userId: data.userId,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        };
        sessionStore.set(id, session);
        return session;
      }),
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { id: string };
          include?: Record<string, boolean>;
        }) => {
          const session = sessionStore.get(where.id);
          if (!session) return null;
          if (include?.user) {
            const user = userStore.get(session.userId as string);
            return user ? { ...session, user } : null;
          }
          return session;
        },
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        sessionStore.delete(where.id);
        return {};
      }),
    },
    apiToken: {
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: {
          where: Record<string, unknown>;
          include?: Record<string, boolean>;
        }) => {
          let token: Record<string, unknown> | undefined;
          if (where.id) token = tokenStore.get(where.id as string);
          if (where.tokenHash) {
            for (const t of tokenStore.values()) {
              if (t.tokenHash === where.tokenHash) {
                token = t;
                break;
              }
            }
          }
          if (!token) return null;
          if (include?.user) {
            const user = userStore.get(token.userId as string);
            return user ? { ...token, user } : null;
          }
          return token;
        },
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `token_${Date.now()}`;
        const token = {
          id,
          ...data,
          revokedAt: null,
          lastUsedAt: null,
          expiresAt: null,
          createdAt: new Date(),
        };
        tokenStore.set(id, token);
        return token;
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const results: Record<string, unknown>[] = [];
        for (const t of tokenStore.values()) {
          if (t.userId === where.userId && !t.revokedAt) results.push(t);
        }
        return results.sort(
          (a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
        );
      }),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        let count = 0;
        for (const t of tokenStore.values()) {
          if (t.userId === where.userId && !t.revokedAt) count++;
        }
        return count;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const token = tokenStore.get(where.id);
          if (!token) throw new Error('Not found');
          Object.assign(token, data);
          tokenStore.set(where.id, token);
          return token;
        },
      ),
    },
    paste: {
      create: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      aggregate: vi.fn(async () => ({ _count: 0, _sum: {} })),
    },
    pasteRevision: { findMany: vi.fn(async () => []) },
    workspace: {
      count: vi.fn(async () => 0),
    },
    workspaceMember: {
      count: vi.fn(async () => 0),
    },
    $queryRawUnsafe: vi.fn(async () => [{ total_bytes: BigInt(0) }]),
  },
}));

vi.mock('../../queues', () => ({
  enqueueExpiration: vi.fn(async () => {}),
}));

vi.mock('../../storage', () => ({
  getStorage: () => ({
    async store(_k: string, content: string) {
      return { backend: 'db' as const, dbContent: content, contentRef: undefined };
    },
    async retrieve(db: string | null) {
      return db ?? '';
    },
    async remove() {},
  }),
}));

const app = createApp();

beforeEach(() => {
  userStore.clear();
  sessionStore.clear();
  tokenStore.clear();
  userIdCounter = 0;
});

// Helper: register a user and return the session cookie
function extractCookie(res: supertest.Response): string {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) return raw[0] ?? '';
  return (raw as string) ?? '';
}

async function registerUser(
  email = 'test@example.com',
  username = 'tester',
  password = 'password123',
) {
  const res = await supertest(app).post('/v1/auth/register').send({ email, username, password });
  const cookie = extractCookie(res);
  return { res, cookie };
}

// ─── Registration ────────────────────────────────────────────────────────────

describe('POST /v1/auth/register', () => {
  it('creates a user and sets session cookie', async () => {
    const { res, cookie } = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test@example.com');
    expect(res.body.data.username).toBe('tester');
    expect(cookie).toContain('pasteking_session=');
  });

  it('rejects duplicate email', async () => {
    await registerUser('dup@test.com', 'user1');
    const { res } = await registerUser('dup@test.com', 'user2');
    expect(res.status).toBe(409);
  });

  it('rejects duplicate username', async () => {
    await registerUser('a@test.com', 'sameuser');
    const { res } = await registerUser('b@test.com', 'sameuser');
    expect(res.status).toBe(409);
  });

  it('rejects invalid input', async () => {
    const res = await supertest(app)
      .post('/v1/auth/register')
      .send({ email: 'notanemail', username: 'ab', password: '123' });
    expect(res.status).toBe(400);
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────

describe('POST /v1/auth/login', () => {
  it('logs in with valid credentials', async () => {
    await registerUser();
    const res = await supertest(app)
      .post('/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
    const cookie = extractCookie(res);
    expect(cookie).toContain('pasteking_session=');
  });

  it('rejects wrong password', async () => {
    await registerUser();
    const res = await supertest(app)
      .post('/v1/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await supertest(app)
      .post('/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });
    expect(res.status).toBe(401);
  });
});

// ─── Session / Me ────────────────────────────────────────────────────────────

describe('GET /v1/auth/me', () => {
  it('returns current user when authenticated', async () => {
    const { cookie } = await registerUser();
    const res = await supertest(app).get('/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
  });

  it('returns 401 without session', async () => {
    const res = await supertest(app).get('/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

describe('POST /v1/auth/logout', () => {
  it('logs out and clears session cookie', async () => {
    const { cookie } = await registerUser();
    const res = await supertest(app).post('/v1/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);
    const setCookie = extractCookie(res);
    expect(setCookie).toContain('Max-Age=0');
  });
});

// ─── API Tokens ──────────────────────────────────────────────────────────────

describe('API token CRUD', () => {
  it('creates, lists, and revokes an API token', async () => {
    const { cookie } = await registerUser();

    // Create
    const create = await supertest(app)
      .post('/v1/auth/tokens')
      .set('Cookie', cookie)
      .send({ name: 'CI token', scopes: ['paste:create'] });
    expect(create.status).toBe(201);
    expect(create.body.data.token).toBeDefined();
    expect(create.body.data.name).toBe('CI token');

    // List
    const list = await supertest(app).get('/v1/auth/tokens').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);

    // Revoke
    const tokenId = list.body.data[0].id;
    const revoke = await supertest(app).delete(`/v1/auth/tokens/${tokenId}`).set('Cookie', cookie);
    expect(revoke.status).toBe(204);
  });

  it('rejects token creation without auth', async () => {
    const res = await supertest(app).post('/v1/auth/tokens').send({ name: 'test', scopes: [] });
    expect(res.status).toBe(401);
  });
});
