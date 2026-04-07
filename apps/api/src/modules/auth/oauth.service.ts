import { prisma } from '@pasteking/db';
import { generateId } from '@pasteking/crypto';
import { AppError } from '../../middleware';
import { env } from '../../env';
import type { OAuthProvider } from '@pasteking/types';

interface OAuthUserInfo {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  username: string;
  avatarUrl?: string;
}

interface OAuthTokens {
  access_token: string;
  token_type: string;
}

export class OAuthService {
  // ─── GitHub OAuth ────────────────────────────────────────────────────

  getGitHubAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${env.API_URL}/v1/auth/oauth/github/callback`,
      scope: 'user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeGitHubCode(code: string): Promise<OAuthUserInfo> {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokens = (await tokenRes.json()) as OAuthTokens & { error?: string };
    if (tokens.error || !tokens.access_token) {
      throw new AppError(400, 'OAUTH_ERROR', 'Failed to exchange GitHub code');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    });
    const ghUser = (await userRes.json()) as {
      id: number;
      login: string;
      email: string | null;
      avatar_url: string;
    };

    let email = ghUser.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
      });
      const emails = (await emailsRes.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? emails[0]?.email ?? null;
    }

    if (!email) {
      throw new AppError(400, 'OAUTH_ERROR', 'Unable to retrieve email from GitHub');
    }

    return {
      provider: 'github',
      providerId: String(ghUser.id),
      email,
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
    };
  }

  // ─── Google OAuth ────────────────────────────────────────────────────

  getGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${env.API_URL}/v1/auth/oauth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeGoogleCode(code: string): Promise<OAuthUserInfo> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: `${env.API_URL}/v1/auth/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = (await tokenRes.json()) as OAuthTokens & { error?: string };
    if (tokens.error || !tokens.access_token) {
      throw new AppError(400, 'OAUTH_ERROR', 'Failed to exchange Google code');
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = (await userRes.json()) as {
      id: string;
      email: string;
      name: string;
      picture: string;
    };

    if (!gUser.email) {
      throw new AppError(400, 'OAUTH_ERROR', 'Unable to retrieve email from Google');
    }

    return {
      provider: 'google',
      providerId: gUser.id,
      email: gUser.email,
      username:
        gUser.name?.replace(/\s+/g, '_').toLowerCase().slice(0, 30) || `user_${generateId(8)}`,
      avatarUrl: gUser.picture,
    };
  }

  // ─── Common OAuth login/register ────────────────────────────────────

  async loginOrRegister(
    info: OAuthUserInfo,
  ): Promise<{ userId: string; sessionId: string; isNewUser: boolean }> {
    // Check if OAuth account already linked
    const existing = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: info.provider, providerId: info.providerId } },
      include: { user: true },
    });

    if (existing) {
      const session = await this.createSession(existing.userId);
      return { userId: existing.userId, sessionId: session.id, isNewUser: false };
    }

    // Check if email already exists (link account)
    const existingUser = await prisma.user.findUnique({ where: { email: info.email } });
    if (existingUser) {
      await prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: info.provider,
          providerId: info.providerId,
        },
      });
      if (info.avatarUrl && !existingUser.avatarUrl) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { avatarUrl: info.avatarUrl },
        });
      }
      const session = await this.createSession(existingUser.id);
      return { userId: existingUser.id, sessionId: session.id, isNewUser: false };
    }

    // Create new user with unique username
    let username = info.username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      username = `${username}_${generateId(4)}`;
    }

    const user = await prisma.user.create({
      data: {
        email: info.email,
        username,
        avatarUrl: info.avatarUrl,
        oauthAccounts: {
          create: {
            provider: info.provider,
            providerId: info.providerId,
          },
        },
      },
    });

    const session = await this.createSession(user.id);
    return { userId: user.id, sessionId: session.id, isNewUser: true };
  }

  private async createSession(userId: string) {
    const maxAge = (env.SESSION_MAX_AGE_HOURS ?? 72) * 60 * 60 * 1000;
    return prisma.session.create({
      data: { userId, expiresAt: new Date(Date.now() + maxAge) },
    });
  }

  getSessionCookie(sessionId: string): string {
    const maxAge = (env.SESSION_MAX_AGE_HOURS ?? 72) * 60 * 60;
    const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
    return `pasteking_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
  }
}
