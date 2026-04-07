import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('GET /health', () => {
  it('returns 200 with health data', async () => {
    const res = await supertest(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.version).toBeDefined();
    expect(res.body.data.timestamp).toBeDefined();
  });
});

describe('GET /v1/health', () => {
  it('returns 200 with health data', async () => {
    const res = await supertest(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });
});

describe('GET /nonexistent', () => {
  it('returns 404', async () => {
    const res = await supertest(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
