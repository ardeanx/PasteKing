import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../app';

// Mock Prisma — in-memory store for paste & revision models
vi.mock('@pasteking/db', () => {
  const store = new Map<string, Record<string, unknown>>();
  const revisionStore = new Map<string, Record<string, unknown>[]>();

  return {
    prisma: {
      paste: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const now = new Date();
          const revisions = data.revisions as { create: Record<string, unknown> } | undefined;
          const paste = {
            id,
            title: data.title ?? null,
            mode: data.mode ?? 'TEXT',
            visibility: data.visibility ?? 'PUBLIC',
            status: 'ACTIVE',
            language: data.language ?? null,
            encrypted: data.encrypted ?? false,
            encryptionIv: data.encryptionIv ?? null,
            encryptionVersion: data.encryptionVersion ?? null,
            burnAfterRead: data.burnAfterRead ?? false,
            expiresAt: data.expiresAt ?? null,
            currentRevision: data.currentRevision ?? 1,
            content: data.content ?? null,
            contentRef: data.contentRef ?? null,
            deleteTokenHash: data.deleteTokenHash ?? null,
            authorId: data.authorId ?? null,
            createdAt: now,
            updatedAt: now,
          };
          store.set(id, paste);
          if (revisions?.create) {
            const rev = {
              id: `rev_${Date.now()}`,
              pasteId: id,
              ...revisions.create,
              createdAt: now,
            };
            revisionStore.set(id, [rev]);
          }
          return paste;
        }),
        findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.id) return store.get(where.id as string) ?? null;
          if (where.deleteTokenHash) {
            for (const p of store.values()) {
              if (p.deleteTokenHash === where.deleteTokenHash) return p;
            }
          }
          return null;
        }),
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          const results: Record<string, unknown>[] = [];
          for (const p of store.values()) {
            if (where.authorId && p.authorId === where.authorId && p.status !== 'DELETED') {
              results.push(p);
            }
          }
          return results.sort(
            (a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
          );
        }),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = store.get(where.id);
            if (!existing) throw new Error('Not found');
            const revisions = data.revisions as { create: Record<string, unknown> } | undefined;
            const updated = { ...existing, ...data, updatedAt: new Date() };
            delete (updated as Record<string, unknown>).revisions;
            store.set(where.id, updated);
            if (revisions?.create) {
              const revs = revisionStore.get(where.id) ?? [];
              const rev = {
                id: `rev_${Date.now()}_${revs.length + 1}`,
                pasteId: where.id,
                ...revisions.create,
                createdAt: new Date(),
              };
              revs.push(rev);
              revisionStore.set(where.id, revs);
            }
            return updated;
          },
        ),
      },
      pasteRevision: {
        findMany: vi.fn(async ({ where }: { where: { pasteId: string } }) => {
          const revs = revisionStore.get(where.pasteId) ?? [];
          return revs.sort((a, b) => (b.revisionNumber as number) - (a.revisionNumber as number));
        }),
      },
      apiToken: {
        findUnique: vi.fn(async () => null),
      },
      session: {
        findUnique: vi.fn(async () => null),
      },
      pasteView: {
        create: vi.fn(async () => ({})),
        count: vi.fn(async () => 0),
      },
      $queryRaw: vi.fn(async () => []),
      $queryRawUnsafe: vi.fn(async () => []),
      _store: store,
      _revisionStore: revisionStore,
    },
  };
});

// Mock queue enqueuing (no Redis in test)
vi.mock('../../queues', () => ({
  enqueueExpiration: vi.fn(async () => {}),
}));

// Mock storage — store content in-memory (no MinIO in tests)
vi.mock('../../storage', () => {
  const memStore = new Map<string, string>();
  return {
    getStorage: () => ({
      async store(_key: string, content: string) {
        // Always store inline (below threshold) for test simplicity
        return { backend: 'db' as const, dbContent: content, contentRef: undefined };
      },
      async retrieve(dbContent: string | null, contentRef: string | null | undefined) {
        if (dbContent) return dbContent;
        if (contentRef && memStore.has(contentRef)) return memStore.get(contentRef)!;
        return '';
      },
      async remove(_ref: string | null | undefined) {},
    }),
  };
});

const app = createApp();

beforeEach(async () => {
  const { prisma } = await import('@pasteking/db');
  (prisma as unknown as { _store: Map<string, unknown> })._store.clear();
  (prisma as unknown as { _revisionStore: Map<string, unknown[]> })._revisionStore.clear();
});

describe('POST /v1/pastes', () => {
  it('creates a paste and returns deleteToken', async () => {
    const res = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'hello world', mode: 'TEXT', visibility: 'PUBLIC' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.deleteToken).toBeDefined();
    expect(res.body.data.content).toBe('hello world');
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.mode).toBe('TEXT');
    expect(res.body.data.visibility).toBe('PUBLIC');
  });

  it('creates a paste with expiresIn and burnAfterRead', async () => {
    const res = await supertest(app).post('/v1/pastes').send({
      content: 'secret',
      mode: 'TEXT',
      visibility: 'UNLISTED',
      burnAfterRead: true,
      expiresIn: 3600,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.burnAfterRead).toBe(true);
    expect(res.body.data.expiresAt).toBeDefined();
    expect(res.body.data.visibility).toBe('UNLISTED');
  });

  it('rejects invalid payload', async () => {
    const res = await supertest(app).post('/v1/pastes').send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /v1/pastes/:id', () => {
  it('retrieves an existing paste', async () => {
    const create = await supertest(app).post('/v1/pastes').send({
      content: 'test content',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'javascript',
    });

    const id = create.body.data.id;
    const res = await supertest(app).get(`/v1/pastes/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('test content');
    expect(res.body.data.language).toBe('javascript');
  });

  it('returns 404 for nonexistent paste', async () => {
    const res = await supertest(app).get('/v1/pastes/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('GET /v1/pastes/:id/raw', () => {
  it('returns raw text content', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'raw content here', mode: 'TEXT', visibility: 'PUBLIC' });

    const id = create.body.data.id;
    const res = await supertest(app).get(`/v1/pastes/${id}/raw`);

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/plain');
    expect(res.text).toBe('raw content here');
  });
});

describe('PATCH /v1/pastes/:id', () => {
  it('updates paste content and creates a revision', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'original', mode: 'TEXT', visibility: 'PUBLIC' });

    const id = create.body.data.id;

    const update = await supertest(app)
      .patch(`/v1/pastes/${id}`)
      .send({ content: 'updated content', title: 'New Title' });

    expect(update.status).toBe(200);
    expect(update.body.data.content).toBe('updated content');
    expect(update.body.data.title).toBe('New Title');
    expect(update.body.data.currentRevision).toBe(2);
  });

  it('rejects update on burn-after-read paste', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'secret', mode: 'TEXT', visibility: 'UNLISTED', burnAfterRead: true });

    const id = create.body.data.id;

    const update = await supertest(app).patch(`/v1/pastes/${id}`).send({ content: 'new content' });

    expect(update.status).toBe(400);
    expect(update.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('DELETE /v1/pastes/:id', () => {
  it('deletes a paste with valid delete token', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'to delete', mode: 'TEXT', visibility: 'PUBLIC' });

    const { id, deleteToken } = create.body.data;

    const del = await supertest(app).delete(`/v1/pastes/${id}`).set('x-delete-token', deleteToken);

    expect(del.status).toBe(204);

    // Verify it's gone
    const get = await supertest(app).get(`/v1/pastes/${id}`);
    expect(get.status).toBe(404);
  });

  it('rejects delete without token or auth', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'protected', mode: 'TEXT', visibility: 'PUBLIC' });

    const res = await supertest(app).delete(`/v1/pastes/${create.body.data.id}`);
    expect(res.status).toBe(403);
  });

  it('rejects delete with wrong token', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'protected', mode: 'TEXT', visibility: 'PUBLIC' });

    const res = await supertest(app)
      .delete(`/v1/pastes/${create.body.data.id}`)
      .set('x-delete-token', 'wrong_token');

    expect(res.status).toBe(403);
  });
});

describe('GET /v1/pastes/:id/revisions', () => {
  it('returns revision history after update', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'v1', mode: 'TEXT', visibility: 'PUBLIC' });

    const id = create.body.data.id;

    await supertest(app).patch(`/v1/pastes/${id}`).send({ content: 'v2' });

    const res = await supertest(app).get(`/v1/pastes/${id}/revisions`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].revisionNumber).toBeDefined();
  });
});

describe('POST /v1/pastes/raw', () => {
  it('creates a paste from raw text', async () => {
    const res = await supertest(app)
      .post('/v1/pastes/raw')
      .set('Content-Type', 'text/plain')
      .send('echo "hello world"');

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.url).toContain('/p/');
    expect(res.body.data.raw_url).toContain('/raw');
  });

  it('accepts query params for mode and visibility', async () => {
    const res = await supertest(app)
      .post('/v1/pastes/raw?mode=CODE&visibility=PUBLIC')
      .set('Content-Type', 'text/plain')
      .send('const x = 1;');

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  it('rejects empty body', async () => {
    const res = await supertest(app)
      .post('/v1/pastes/raw')
      .set('Content-Type', 'text/plain')
      .send('');

    expect(res.status).toBe(400);
  });
});

describe('burn-after-read lifecycle', () => {
  it('marks paste as burned after first read', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'burn me', mode: 'TEXT', visibility: 'UNLISTED', burnAfterRead: true });

    const id = create.body.data.id;

    // First read succeeds
    const read1 = await supertest(app).get(`/v1/pastes/${id}`);
    expect(read1.status).toBe(200);
    expect(read1.body.data.content).toBe('burn me');

    // Second read fails (paste marked BURNED)
    const read2 = await supertest(app).get(`/v1/pastes/${id}`);
    expect(read2.status).toBe(404);
  });

  it('burn-after-read works on raw endpoint too', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'burn raw', mode: 'TEXT', visibility: 'UNLISTED', burnAfterRead: true });

    const id = create.body.data.id;

    const read1 = await supertest(app).get(`/v1/pastes/${id}/raw`);
    expect(read1.status).toBe(200);
    expect(read1.text).toBe('burn raw');

    const read2 = await supertest(app).get(`/v1/pastes/${id}/raw`);
    expect(read2.status).toBe(404);
  });
});

describe('expiration behavior', () => {
  it('paste with expiresIn gets expiresAt in response', async () => {
    const res = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'expires soon', mode: 'TEXT', visibility: 'PUBLIC', expiresIn: 600 });

    expect(res.status).toBe(201);
    expect(res.body.data.expiresAt).toBeDefined();

    const expiresAt = new Date(res.body.data.expiresAt);
    const now = new Date();
    // Should expire roughly 10 minutes from now
    expect(expiresAt.getTime() - now.getTime()).toBeGreaterThan(500_000);
    expect(expiresAt.getTime() - now.getTime()).toBeLessThan(700_000);
  });

  it('paste with past expiresAt returns 404', async () => {
    // Create a paste, then manually set its expiresAt to the past
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'expired', mode: 'TEXT', visibility: 'PUBLIC', expiresIn: 1 });

    const id = create.body.data.id;

    // Manually expire it via the mock store
    const { prisma } = await import('@pasteking/db');
    const paste = (
      prisma as unknown as { _store: Map<string, Record<string, unknown>> }
    )._store.get(id);
    if (paste) {
      paste.expiresAt = new Date(Date.now() - 10000); // 10 seconds ago
    }

    const res = await supertest(app).get(`/v1/pastes/${id}`);
    expect(res.status).toBe(404);
  });
});

describe('visibility', () => {
  it('creates public paste', async () => {
    const res = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'public', mode: 'TEXT', visibility: 'PUBLIC' });

    expect(res.status).toBe(201);
    expect(res.body.data.visibility).toBe('PUBLIC');
  });

  it('creates unlisted paste', async () => {
    const res = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'unlisted', mode: 'TEXT', visibility: 'UNLISTED' });

    expect(res.status).toBe(201);
    expect(res.body.data.visibility).toBe('UNLISTED');
  });

  it('creates private paste', async () => {
    const res = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'private', mode: 'TEXT', visibility: 'PRIVATE' });

    expect(res.status).toBe(201);
    expect(res.body.data.visibility).toBe('PRIVATE');
  });
});

describe('authorId on anonymous pastes', () => {
  it('paste created without auth has null authorId', async () => {
    const res = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'anon', mode: 'TEXT', visibility: 'PUBLIC' });

    expect(res.status).toBe(201);
    expect(res.body.data.authorId).toBeNull();
  });
});

describe('encrypted pastes', () => {
  const encryptedPayload = {
    content: 'base64ciphertextdata==',
    mode: 'TEXT',
    visibility: 'UNLISTED',
    encrypted: true,
    encryptionIv: 'dGVzdGl2MTIzNDU2',
    encryptionVersion: 1,
  };

  it('creates an encrypted paste with metadata', async () => {
    const res = await supertest(app).post('/v1/pastes').send(encryptedPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.encrypted).toBe(true);
    expect(res.body.data.encryptionIv).toBe('dGVzdGl2MTIzNDU2');
    expect(res.body.data.encryptionVersion).toBe(1);
    expect(res.body.data.content).toBe('base64ciphertextdata==');
  });

  it('retrieves an encrypted paste with encryption metadata', async () => {
    const create = await supertest(app).post('/v1/pastes').send(encryptedPayload);

    const id = create.body.data.id;
    const res = await supertest(app).get(`/v1/pastes/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.encrypted).toBe(true);
    expect(res.body.data.encryptionIv).toBe('dGVzdGl2MTIzNDU2');
    expect(res.body.data.encryptionVersion).toBe(1);
  });

  it('rejects raw endpoint for encrypted paste', async () => {
    const create = await supertest(app).post('/v1/pastes').send(encryptedPayload);

    const id = create.body.data.id;
    const res = await supertest(app).get(`/v1/pastes/${id}/raw`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects update on encrypted paste', async () => {
    const create = await supertest(app).post('/v1/pastes').send(encryptedPayload);

    const id = create.body.data.id;
    const res = await supertest(app).patch(`/v1/pastes/${id}`).send({ content: 'new content' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects encrypted paste without required metadata', async () => {
    const res = await supertest(app).post('/v1/pastes').send({
      content: 'ciphertext',
      mode: 'TEXT',
      visibility: 'PUBLIC',
      encrypted: true,
      // missing encryptionIv and encryptionVersion
    });

    expect(res.status).toBe(400);
  });

  it('encrypted burn-after-read works correctly', async () => {
    const create = await supertest(app)
      .post('/v1/pastes')
      .send({ ...encryptedPayload, burnAfterRead: true });

    const id = create.body.data.id;

    const read1 = await supertest(app).get(`/v1/pastes/${id}`);
    expect(read1.status).toBe(200);
    expect(read1.body.data.encrypted).toBe(true);
    expect(read1.body.data.content).toBe('base64ciphertextdata==');

    const read2 = await supertest(app).get(`/v1/pastes/${id}`);
    expect(read2.status).toBe(404);
  });

  it('non-encrypted paste has null encryption metadata', async () => {
    const res = await supertest(app)
      .post('/v1/pastes')
      .send({ content: 'plain', mode: 'TEXT', visibility: 'PUBLIC' });

    expect(res.status).toBe(201);
    expect(res.body.data.encrypted).toBe(false);
    expect(res.body.data.encryptionIv).toBeNull();
    expect(res.body.data.encryptionVersion).toBeNull();
  });
});

// ─── Search Tests ────────────────────────────────────────────────────────────

describe('GET /v1/pastes/search', () => {
  it('returns empty array for empty query', async () => {
    const res = await supertest(app).get('/v1/pastes/search?q=');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns empty array for whitespace-only query', async () => {
    const res = await supertest(app).get('/v1/pastes/search?q=%20%20');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('accepts limit and offset parameters', async () => {
    const res = await supertest(app).get('/v1/pastes/search?q=test&limit=5&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /v1/pastes/search/mine', () => {
  it('requires authentication', async () => {
    const res = await supertest(app).get('/v1/pastes/search/mine?q=test');
    expect(res.status).toBe(401);
  });

  it('returns empty result for empty query', async () => {
    // This test exercises the route registration even without auth
    const res = await supertest(app).get('/v1/pastes/search/mine?q=');
    // Will return 401 since requireAuth middleware fires before query check
    expect(res.status).toBe(401);
  });
});
