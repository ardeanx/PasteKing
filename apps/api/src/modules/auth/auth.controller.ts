import type { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema, createApiTokenSchema } from '@pasteking/validation';
import { AuthService } from './auth.service';
import { QuotaService } from '../billing/quota';

const service = new AuthService();
const quotaService = new QuotaService();

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = registerSchema.parse(req.body);
    const result = await service.register(input.email, input.username, input.password);
    res.setHeader('Set-Cookie', service.getSessionCookie(result.sessionId));
    res.status(201).json({ success: true, data: result.user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await service.login(input.email, input.password);
    res.setHeader('Set-Cookie', service.getSessionCookie(result.sessionId));
    res.json({ success: true, data: result.user });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.sessionId) {
      await service.logout(req.sessionId);
    }
    res.setHeader('Set-Cookie', service.getClearSessionCookie());
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await service.getMe(req.user!.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function createApiToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = createApiTokenSchema.parse(req.body);
    await quotaService.enforceApiTokenLimit(req.user!.id);
    const result = await service.createApiToken(req.user!.id, input.name, input.scopes);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listApiTokens(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tokens = await service.listApiTokens(req.user!.id);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
}

export async function revokeApiToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tokenId = req.params['id'] as string;
    await service.revokeApiToken(req.user!.id, tokenId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ─── Profile ────────────────────────────────────────────────────────────

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await service.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { username, email, avatarUrl } = req.body ?? {};
    const profile = await service.updateProfile(req.user!.id, { username, email, avatarUrl });
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      res
        .status(400)
        .json({ success: false, message: 'New password must be at least 8 characters' });
      return;
    }
    await service.changePassword(req.user!.id, currentPassword ?? '', newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}
