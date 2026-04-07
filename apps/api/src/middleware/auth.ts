import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@pasteking/db';
import { sha256 } from '@pasteking/crypto';
import type { PlatformRole, UserStatus } from '@pasteking/types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
        platformRole: PlatformRole;
        status: UserStatus;
      };
      apiToken?: {
        id: string;
        scopes: string[];
      };
      sessionId?: string;
    }
  }
}

/**
 * Extracts and validates authentication from either:
 * 1. Bearer token in Authorization header — for API/CLI
 * 2. Session cookie (pasteking_session) — for web app
 *
 * Sets req.user, and optionally req.apiToken / req.sessionId.
 * Does NOT reject unauthenticated requests — use requireAuth for that.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // Try Bearer token first (API/CLI usage)
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    if (token) {
      try {
        const tokenHash = sha256(token);
        const apiToken = await prisma.apiToken.findUnique({
          where: { tokenHash },
          include: { user: true },
        });

        if (apiToken && !apiToken.revokedAt && (!apiToken.expiresAt || apiToken.expiresAt >= new Date())) {
          prisma.apiToken.update({
            where: { id: apiToken.id },
            data: { lastUsedAt: new Date() },
          }).catch(() => {});

          req.user = {
            id: apiToken.user.id,
            email: apiToken.user.email,
            username: apiToken.user.username,
            platformRole: apiToken.user.platformRole as PlatformRole,
            status: apiToken.user.status as UserStatus,
          };
          req.apiToken = {
            id: apiToken.id,
            scopes: apiToken.scopes,
          };
        }
      } catch {
        // Auth lookup failure is non-fatal for optional auth
      }
    }
    next();
    return;
  }

  // Try session cookie (web app usage)
  const sessionId = parseCookie(req.headers.cookie ?? '', 'pasteking_session');
  if (sessionId) {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });

      if (session && session.expiresAt > new Date()) {
        req.user = {
          id: session.user.id,
          email: session.user.email,
          username: session.user.username,
          platformRole: session.user.platformRole as PlatformRole,
          status: session.user.status as UserStatus,
        };
        req.sessionId = session.id;
      }
    } catch {
      // Session lookup failure is non-fatal
    }
  }

  next();
}

/**
 * Requires a valid authenticated user. Must be used AFTER optionalAuth.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }
  next();
}

/**
 * Requires platform ADMIN role. Must be used AFTER requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.platformRole !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Platform admin access required' },
    });
    return;
  }
  next();
}

/**
 * Blocks suspended users from all authenticated actions.
 * Must be used AFTER requireAuth.
 *
 * Enforcement policy:
 * - SUSPENDED: cannot use any authenticated feature
 * - RESTRICTED: allowed through here; restrictions enforced per-action
 * - ACTIVE: normal access
 */
export function enforceUserStatus(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.status === 'SUSPENDED') {
    res.status(403).json({
      success: false,
      error: {
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Contact support for assistance.',
      },
    });
    return;
  }
  next();
}

/**
 * Blocks restricted users from creating public/unlisted/workspace content.
 * Intended for paste creation routes.
 *
 * Policy: restricted users can only create PRIVATE personal pastes.
 */
export function enforceCreateRestriction(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.status === 'RESTRICTED') {
    const visibility = req.body?.visibility;
    const workspaceId = req.body?.workspaceId ?? req.query?.['workspaceId'];
    if (visibility && visibility !== 'PRIVATE') {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_RESTRICTED',
          message: 'Your account is restricted. You can only create private personal pastes.',
        },
      });
      return;
    }
    if (workspaceId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_RESTRICTED',
          message: 'Your account is restricted. You cannot create workspace pastes.',
        },
      });
      return;
    }
  }
  next();
}

/**
 * Requires a specific scope when using API token auth.
 * Session-authenticated users pass automatically.
 */
export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    // Session auth has full access
    if (req.sessionId) {
      next();
      return;
    }

    // API token: empty scopes means full access (backwards compat)
    if (req.apiToken && req.apiToken.scopes.length > 0 && !req.apiToken.scopes.includes(scope)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Missing required scope: ${scope}` },
      });
      return;
    }

    next();
  };
}

function parseCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1];
}
