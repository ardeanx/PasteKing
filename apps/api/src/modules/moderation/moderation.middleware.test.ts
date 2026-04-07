import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin, enforceUserStatus, enforceCreateRestriction } from '../../middleware/auth';

function mockReqRes(overrides?: Partial<Request>) {
  const req = {
    user: undefined,
    body: {},
    query: {},
    ...overrides,
  } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('requireAdmin', () => {
  it('passes for ADMIN users', () => {
    const { req, res, next } = mockReqRes({
      user: {
        id: '1',
        email: 'a@b.com',
        username: 'admin',
        platformRole: 'ADMIN',
        status: 'ACTIVE',
      },
    } as Partial<Request>);
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects non-admin users', () => {
    const { req, res, next } = mockReqRes({
      user: { id: '1', email: 'a@b.com', username: 'user', platformRole: 'USER', status: 'ACTIVE' },
    } as Partial<Request>);
    requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects unauthenticated requests', () => {
    const { req, res, next } = mockReqRes();
    requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('enforceUserStatus', () => {
  it('passes for ACTIVE users', () => {
    const { req, res, next } = mockReqRes({
      user: { id: '1', email: 'a@b.com', username: 'u', platformRole: 'USER', status: 'ACTIVE' },
    } as Partial<Request>);
    enforceUserStatus(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes for RESTRICTED users (they have limited access, not blocked)', () => {
    const { req, res, next } = mockReqRes({
      user: {
        id: '1',
        email: 'a@b.com',
        username: 'u',
        platformRole: 'USER',
        status: 'RESTRICTED',
      },
    } as Partial<Request>);
    enforceUserStatus(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks SUSPENDED users', () => {
    const { req, res, next } = mockReqRes({
      user: { id: '1', email: 'a@b.com', username: 'u', platformRole: 'USER', status: 'SUSPENDED' },
    } as Partial<Request>);
    enforceUserStatus(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }),
      }),
    );
  });

  it('passes for unauthenticated requests', () => {
    const { req, res, next } = mockReqRes();
    enforceUserStatus(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('enforceCreateRestriction', () => {
  it('passes for non-restricted users', () => {
    const { req, res, next } = mockReqRes({
      user: { id: '1', email: 'a@b.com', username: 'u', platformRole: 'USER', status: 'ACTIVE' },
      body: { visibility: 'PUBLIC' },
    } as Partial<Request>);
    enforceCreateRestriction(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows restricted users to create PRIVATE pastes', () => {
    const { req, res, next } = mockReqRes({
      user: {
        id: '1',
        email: 'a@b.com',
        username: 'u',
        platformRole: 'USER',
        status: 'RESTRICTED',
      },
      body: { visibility: 'PRIVATE' },
    } as Partial<Request>);
    enforceCreateRestriction(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks restricted users from creating PUBLIC pastes', () => {
    const { req, res, next } = mockReqRes({
      user: {
        id: '1',
        email: 'a@b.com',
        username: 'u',
        platformRole: 'USER',
        status: 'RESTRICTED',
      },
      body: { visibility: 'PUBLIC' },
    } as Partial<Request>);
    enforceCreateRestriction(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'ACCOUNT_RESTRICTED' }),
      }),
    );
  });

  it('blocks restricted users from creating workspace pastes', () => {
    const { req, res, next } = mockReqRes({
      user: {
        id: '1',
        email: 'a@b.com',
        username: 'u',
        platformRole: 'USER',
        status: 'RESTRICTED',
      },
      body: { visibility: 'PRIVATE', workspaceId: 'ws1' },
    } as Partial<Request>);
    enforceCreateRestriction(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'ACCOUNT_RESTRICTED' }),
      }),
    );
  });
});
