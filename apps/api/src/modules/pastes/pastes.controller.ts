import type { Request, Response, NextFunction } from 'express';
import { sha256 } from '@pasteking/crypto';
import { PastesService } from './pastes.service';
import { createPasteSchema, updatePasteSchema } from './pastes.schema';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { canPerform } from '../workspaces/permissions';
import { QuotaService } from '../billing/quota';

const service = new PastesService();
const workspacesService = new WorkspacesService();
const quotaService = new QuotaService();

export async function createPaste(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createPasteSchema.parse(req.body);
    const workspaceId =
      typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : undefined;

    // If creating in a workspace, verify membership and permission
    if (workspaceId) {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required for workspace pastes',
          },
        });
        return;
      }
      const role = await workspacesService.getMemberRole(workspaceId, req.user.id);
      if (!role || !canPerform(role, 'paste.create')) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Not authorized to create pastes in this workspace',
          },
        });
        return;
      }
    }

    // Quota enforcement
    const contentBytes = Buffer.byteLength(input.content, 'utf-8');
    if (workspaceId) {
      await quotaService.enforceWorkspacePasteSize(workspaceId, contentBytes);
      await quotaService.enforceWorkspaceStorageLimit(workspaceId, contentBytes);
    } else if (req.user) {
      await quotaService.enforcePersonalPasteSize(req.user.id, contentBytes);
      await quotaService.enforcePersonalPasteCountLimit(req.user.id);
      await quotaService.enforcePersonalStorageLimit(req.user.id, contentBytes);
    }

    const paste = await service.createPaste(input, req.user?.id, workspaceId);

    // Log audit if workspace paste
    if (workspaceId && req.user) {
      await workspacesService.logAction(
        workspaceId,
        req.user.id,
        'paste.created',
        'paste',
        paste.id,
      );
    }

    res.status(201).json({ success: true, data: paste });
  } catch (err) {
    next(err);
  }
}

export async function getPaste(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const ip = req.ip ?? (req.headers['x-forwarded-for'] as string) ?? '';
    const ipHash = ip ? sha256(ip) : undefined;
    const paste = await service.getPaste(id, ipHash);

    // Workspace paste visibility: only workspace members can view
    if (paste.workspaceId && paste.visibility === 'PRIVATE') {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Paste with id '${id}' not found` },
        });
        return;
      }
      const role = await workspacesService.getMemberRole(paste.workspaceId, req.user.id);
      if (!role) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Paste with id '${id}' not found` },
        });
        return;
      }
    }

    res.json({ success: true, data: paste });
  } catch (err) {
    next(err);
  }
}

export async function getPasteRaw(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const content = await service.getPasteRaw(id);
    res.type('text/plain').send(content);
  } catch (err) {
    next(err);
  }
}

export async function updatePaste(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const input = updatePasteSchema.parse(req.body);
    const paste = await service.updatePaste(id, input, req.user?.id);
    res.json({ success: true, data: paste });
  } catch (err) {
    next(err);
  }
}

export async function deletePaste(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const deleteToken = req.headers['x-delete-token'] as string | undefined;

    // Check workspace authorization if applicable
    if (req.user) {
      const pasteInfo = await service.getPasteInfo(id);
      if (pasteInfo?.workspaceId) {
        const role = await workspacesService.getMemberRole(pasteInfo.workspaceId, req.user.id);
        if (
          role &&
          canPerform(role, 'paste.delete', { isPasteAuthor: pasteInfo.authorId === req.user.id })
        ) {
          await service.deletePaste(id, undefined, req.user.id, true);
          await workspacesService.logAction(
            pasteInfo.workspaceId,
            req.user.id,
            'paste.deleted',
            'paste',
            id,
          );
          res.status(204).end();
          return;
        }
      }
    }

    await service.deletePaste(id, deleteToken, req.user?.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function getRevisions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const revisions = await service.getRevisions(id);
    res.json({ success: true, data: revisions });
  } catch (err) {
    next(err);
  }
}

export async function listMyPastes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pastes = await service.listByAuthor(req.user!.id);
    res.json({ success: true, data: pastes });
  } catch (err) {
    next(err);
  }
}

export async function createRawPaste(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const content = typeof req.body === 'string' ? req.body : '';
    if (!content) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Request body must be non-empty text' },
      });
      return;
    }
    if (content.length > 500_000) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Content too large (max 500KB)' },
      });
      return;
    }

    const query = req.query;
    const rawMode = typeof query['mode'] === 'string' ? query['mode'] : undefined;
    const rawVisibility = typeof query['visibility'] === 'string' ? query['visibility'] : undefined;
    const validModes = ['TEXT', 'CODE', 'LOG', 'MARKDOWN'];
    const validVisibilities = ['PUBLIC', 'UNLISTED', 'PRIVATE'];

    if (rawMode && !validModes.includes(rawMode)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Invalid mode. Must be one of: ${validModes.join(', ')}`,
        },
      });
      return;
    }

    if (rawVisibility && !validVisibilities.includes(rawVisibility)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Invalid visibility. Must be one of: ${validVisibilities.join(', ')}`,
        },
      });
      return;
    }

    const rawExpiresIn =
      typeof query['expiresIn'] === 'string' ? Number(query['expiresIn']) : undefined;
    if (rawExpiresIn !== undefined && (!Number.isFinite(rawExpiresIn) || rawExpiresIn <= 0)) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'expiresIn must be a positive number (seconds)' },
      });
      return;
    }

    const options = {
      mode: rawMode,
      visibility: rawVisibility,
      expiresIn: rawExpiresIn,
      burnAfterRead: query['burnAfterRead'] === 'true' ? true : undefined,
      title: typeof query['title'] === 'string' ? query['title'].slice(0, 200) : undefined,
      language: typeof query['language'] === 'string' ? query['language'].slice(0, 50) : undefined,
    };

    const rawWorkspaceId =
      typeof query['workspaceId'] === 'string' ? query['workspaceId'] : undefined;

    // Workspace authorization for raw paste creation
    if (rawWorkspaceId) {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required for workspace pastes',
          },
        });
        return;
      }
      const role = await workspacesService.getMemberRole(rawWorkspaceId, req.user.id);
      if (!role || !canPerform(role, 'paste.create')) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Not authorized to create pastes in this workspace',
          },
        });
        return;
      }
    }

    // Quota enforcement for raw upload
    const rawContentBytes = Buffer.byteLength(content, 'utf-8');
    await quotaService.enforceRawUploadSize(req.user?.id, rawContentBytes);
    if (rawWorkspaceId) {
      await quotaService.enforceWorkspaceStorageLimit(rawWorkspaceId, rawContentBytes);
    } else if (req.user) {
      await quotaService.enforcePersonalPasteCountLimit(req.user.id);
      await quotaService.enforcePersonalStorageLimit(req.user.id, rawContentBytes);
    }

    const result = await service.createRawPaste(content, options, req.user?.id, rawWorkspaceId);

    if (rawWorkspaceId && req.user) {
      await workspacesService.logAction(
        rawWorkspaceId,
        req.user.id,
        'paste.created',
        'paste',
        result.id,
      );
    }

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function forkPaste(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const paste = await service.forkPaste(id, req.user?.id);
    res.status(201).json({ success: true, data: paste });
  } catch (err) {
    next(err);
  }
}

export async function searchPastes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const limit =
      typeof req.query['limit'] === 'string' ? Math.min(Number(req.query['limit']), 50) : 20;
    const offset = typeof req.query['offset'] === 'string' ? Number(req.query['offset']) : 0;
    if (!q.trim()) {
      res.json({ success: true, data: [] });
      return;
    }
    const results = await service.searchPastes(q, limit, offset);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function listRecentPublic(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const limit =
      typeof req.query['limit'] === 'string' ? Math.min(Number(req.query['limit']), 50) : 20;
    const results = await service.listRecentPublic(limit);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function listSitemapEntries(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const limit =
      typeof req.query['limit'] === 'string' ? Math.min(Number(req.query['limit']), 5000) : 1000;
    const offset = typeof req.query['offset'] === 'string' ? Number(req.query['offset']) : 0;
    const entries = await service.listSitemapEntries(limit, offset);
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
}

export async function searchMyPastes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const limit =
      typeof req.query['limit'] === 'string' ? Math.min(Number(req.query['limit']), 50) : 20;
    const offset = typeof req.query['offset'] === 'string' ? Number(req.query['offset']) : 0;
    const language = typeof req.query['language'] === 'string' ? req.query['language'] : undefined;
    const mode = typeof req.query['mode'] === 'string' ? req.query['mode'] : undefined;

    if (!q.trim()) {
      res.json({ success: true, data: { items: [], total: 0, limit, offset, hasMore: false } });
      return;
    }

    const results = await service.searchMyPastes(req.user!.id, q, limit, offset, {
      language,
      mode,
    });
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function searchWorkspacePastes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.params['id'] as string;
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const limit =
      typeof req.query['limit'] === 'string' ? Math.min(Number(req.query['limit']), 50) : 20;
    const offset = typeof req.query['offset'] === 'string' ? Number(req.query['offset']) : 0;
    const language = typeof req.query['language'] === 'string' ? req.query['language'] : undefined;
    const mode = typeof req.query['mode'] === 'string' ? req.query['mode'] : undefined;

    // Verify workspace membership
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const role = await workspacesService.getMemberRole(workspaceId, req.user.id);
    if (!role) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this workspace' },
      });
      return;
    }

    if (!q.trim()) {
      res.json({ success: true, data: { items: [], total: 0, limit, offset, hasMore: false } });
      return;
    }

    const results = await service.searchWorkspacePastes(workspaceId, q, limit, offset, {
      language,
      mode,
    });
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function adminSearchPastes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
    const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
    const moderationStatus =
      typeof req.query['moderationStatus'] === 'string' ? req.query['moderationStatus'] : undefined;
    const visibility =
      typeof req.query['visibility'] === 'string' ? req.query['visibility'] : undefined;
    const authorId = typeof req.query['authorId'] === 'string' ? req.query['authorId'] : undefined;
    const limit =
      typeof req.query['limit'] === 'string' ? Math.min(Number(req.query['limit']), 50) : 20;
    const offset = typeof req.query['offset'] === 'string' ? Number(req.query['offset']) : 0;

    const results = await service.adminSearchPastes(
      { q, status, moderationStatus, visibility, authorId },
      limit,
      offset,
    );
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function getPasteAnalytics(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const analytics = await service.getPasteAnalytics(id, req.user!.id);
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
}

export async function getUserAnalytics(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const analytics = await service.getUserAnalytics(req.user!.id);
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
}

export async function getRevisionDiff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const from = Number(req.params['from'] as string);
    const to = Number(req.params['to'] as string);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid revision numbers' },
      });
      return;
    }
    const diff = await service.getRevisionDiff(id, from, to);
    res.json({ success: true, data: diff });
  } catch (err) {
    next(err);
  }
}
