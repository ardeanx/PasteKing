import type { Request, Response, NextFunction } from 'express';
import { generateId } from '@pasteking/crypto';
import { OAuthService } from './oauth.service';

const oauthService = new OAuthService();

const WEB_URL = process.env['CORS_ORIGIN'] || 'http://localhost:3000';

export async function oauthRedirect(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const provider = req.params['provider'] as string;
    const state = generateId(32);

    // Store state in a short-lived cookie for CSRF protection
    const stateCookie = `pk_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`;
    res.setHeader('Set-Cookie', stateCookie);

    let url: string;
    if (provider === 'github') {
      url = oauthService.getGitHubAuthUrl(state);
    } else if (provider === 'google') {
      url = oauthService.getGoogleAuthUrl(state);
    } else {
      res
        .status(400)
        .json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Unsupported OAuth provider' },
        });
      return;
    }

    res.redirect(url);
  } catch (err) {
    next(err);
  }
}

export async function oauthCallback(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const provider = req.params['provider'] as string;
    const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
    const state = typeof req.query['state'] === 'string' ? req.query['state'] : '';

    if (!code) {
      res.redirect(`${WEB_URL}/login?error=oauth_failed`);
      return;
    }

    // Verify CSRF state
    const cookieState = parseCookie(req.headers.cookie ?? '', 'pk_oauth_state');
    if (!cookieState || cookieState !== state) {
      res.redirect(`${WEB_URL}/login?error=oauth_state_mismatch`);
      return;
    }

    let result;
    if (provider === 'github') {
      const info = await oauthService.exchangeGitHubCode(code);
      result = await oauthService.loginOrRegister(info);
    } else if (provider === 'google') {
      const info = await oauthService.exchangeGoogleCode(code);
      result = await oauthService.loginOrRegister(info);
    } else {
      res.redirect(`${WEB_URL}/login?error=unsupported_provider`);
      return;
    }

    // Set session cookie and redirect to web app
    const sessionCookie = oauthService.getSessionCookie(result.sessionId);
    const clearStateCookie = 'pk_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
    res.setHeader('Set-Cookie', [sessionCookie, clearStateCookie]);
    res.redirect(`${WEB_URL}/dashboard`);
  } catch (err) {
    res.redirect(`${WEB_URL}/login?error=oauth_failed`);
  }
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}
