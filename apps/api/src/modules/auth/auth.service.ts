import { prisma } from '@pasteking/db';
import { sha256, generateId, hashPassword, verifyPassword } from '@pasteking/crypto';
import { AppError } from '../../middleware';
import { env } from '../../env';

export class AuthService {
  // ─── Registration / Login / Session ──────────────────────────────────────

  async register(email: string, username: string, password: string) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new AppError(409, 'CONFLICT', 'Email already in use');
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      throw new AppError(409, 'CONFLICT', 'Username already taken');
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
    });

    const session = await this.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        platformRole: user.platformRole,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      sessionId: session.id,
    };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    const valid = await verifyPassword(password, user.passwordHash ?? '');
    if (!valid) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    const session = await this.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        platformRole: user.platformRole,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      sessionId: session.id,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      platformRole: user.platformRole,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async createSession(userId: string) {
    const expiresAt = new Date(Date.now() + env.SESSION_MAX_AGE_HOURS * 60 * 60 * 1000);
    return prisma.session.create({
      data: { userId, expiresAt },
    });
  }

  // ─── API Tokens ──────────────────────────────────────────────────────────

  async createApiToken(userId: string, name: string, scopes: string[]) {
    const rawToken = `pk_${generateId(40)}`;
    const prefix = rawToken.slice(0, 11);
    const tokenHash = sha256(rawToken);

    const apiToken = await prisma.apiToken.create({
      data: { userId, name, prefix, tokenHash, scopes },
    });

    return {
      id: apiToken.id,
      token: rawToken,
      prefix,
      name: apiToken.name,
      scopes: apiToken.scopes,
      createdAt: apiToken.createdAt.toISOString(),
    };
  }

  async listApiTokens(userId: string) {
    const tokens = await prisma.apiToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        prefix: true,
        name: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return tokens.map((t) => ({
      id: t.id,
      prefix: t.prefix,
      name: t.name,
      scopes: t.scopes,
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async revokeApiToken(userId: string, tokenId: string): Promise<void> {
    const token = await prisma.apiToken.findUnique({ where: { id: tokenId } });
    if (!token || token.userId !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Token not found');
    }
    if (token.revokedAt) {
      throw new AppError(400, 'BAD_REQUEST', 'Token is already revoked');
    }
    await prisma.apiToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
  }

  // ─── Session cookie helper ──────────────────────────────────────────────

  getSessionCookie(sessionId: string): string {
    const maxAge = env.SESSION_MAX_AGE_HOURS * 60 * 60;
    const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
    return `pasteking_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
  }

  getClearSessionCookie(): string {
    return 'pasteking_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
  }

  // ─── Profile ────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        oauthAccounts: { select: { provider: true, providerId: true, createdAt: true } },
      },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      platformRole: user.platformRole,
      status: user.status,
      hasPassword: !!user.passwordHash,
      oauthAccounts: user.oauthAccounts.map((a) => ({
        provider: a.provider,
        providerId: a.providerId,
        connectedAt: a.createdAt.toISOString(),
      })),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(
    userId: string,
    data: { username?: string; email?: string; avatarUrl?: string | null },
  ) {
    if (data.username) {
      const existing = await prisma.user.findUnique({ where: { username: data.username } });
      if (existing && existing.id !== userId) {
        throw new AppError(409, 'CONFLICT', 'Username already taken');
      }
    }
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== userId) {
        throw new AppError(409, 'CONFLICT', 'Email already in use');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      platformRole: user.platformRole,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    if (user.passwordHash) {
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        throw new AppError(401, 'UNAUTHORIZED', 'Current password is incorrect');
      }
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
  }
}
