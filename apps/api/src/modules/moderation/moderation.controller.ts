import type { Request, Response, NextFunction } from 'express';
import {
  createReportSchema,
  updateReportStatusSchema,
  moderationActionSchema,
  updateUserStatusSchema,
} from '@pasteking/validation';
import { ModerationService } from './moderation.service';

const service = new ModerationService();

// ─── User-Facing: Reports ──────────────────────────────────────────────

export async function createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createReportSchema.parse(req.body);
    const report = await service.createReport(input, req.user!.id);
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Reports ────────────────────────────────────────────────────

export async function listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, reason, limit, offset } = req.query;
    const result = await service.listReports({
      status: typeof status === 'string' ? status : undefined,
      reason: typeof reason === 'string' ? reason : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
      offset: typeof offset === 'string' ? parseInt(offset, 10) : undefined,
    });
    res.json({ success: true, data: result.data, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const report = await service.getReport(id);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function updateReportStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const input = updateReportStatusSchema.parse(req.body);
    const report = await service.updateReportStatus(id, input, req.user!.id);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Paste Moderation ────────────────────────────────────────────

export async function getPasteModeration(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const data = await service.getPasteModeration(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function takeModerationAction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const input = moderationActionSchema.parse(req.body);
    const data = await service.takeModerationAction(id, input, req.user!.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Users ──────────────────────────────────────────────────────

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, platformRole, limit, offset } = req.query;
    const users = await service.listUsers({
      status: typeof status === 'string' ? status : undefined,
      platformRole: typeof platformRole === 'string' ? platformRole : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
      offset: typeof offset === 'string' ? parseInt(offset, 10) : undefined,
    });
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const user = await service.getUser(id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const input = updateUserStatusSchema.parse(req.body);
    const user = await service.updateUserStatus(id, input, req.user!.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Abuse Flags ────────────────────────────────────────────────

export async function listAbuseFlags(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { type, resolved, pasteId, userId, limit, offset } = req.query;
    const flags = await service.listAbuseFlags({
      type: typeof type === 'string' ? type : undefined,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      pasteId: typeof pasteId === 'string' ? pasteId : undefined,
      userId: typeof userId === 'string' ? userId : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
      offset: typeof offset === 'string' ? parseInt(offset, 10) : undefined,
    });
    res.json({ success: true, data: flags });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Audit Logs ─────────────────────────────────────────────────

export async function listAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { entityType, entityId, limit, offset } = req.query;
    const logs = await service.listAuditLogs({
      entityType: typeof entityType === 'string' ? entityType : undefined,
      entityId: typeof entityId === 'string' ? entityId : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
      offset: typeof offset === 'string' ? parseInt(offset, 10) : undefined,
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: List All Pastes ────────────────────────────────────────────

export async function listAllPastes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { status, moderationStatus, limit, offset } = req.query;
    const result = await service.listAllPastes({
      status: typeof status === 'string' ? status : undefined,
      moderationStatus: typeof moderationStatus === 'string' ? moderationStatus : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
      offset: typeof offset === 'string' ? parseInt(offset, 10) : undefined,
    });
    res.json({ success: true, data: result.data, total: result.total });
  } catch (err) {
    next(err);
  }
}

// ─── Public: Site Branding ──────────────────────────────────────────────

export async function getPublicBranding(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const settings = await service.getSiteSettings();
    res.json({
      success: true,
      data: {
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Site Settings ──────────────────────────────────────────────

export async function getSiteSettings(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const settings = await service.getSiteSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

export async function updateSiteSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const settings = await service.updateSiteSettings(req.body ?? {});
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}
