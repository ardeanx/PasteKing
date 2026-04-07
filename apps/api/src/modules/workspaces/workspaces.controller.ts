import type { Request, Response, NextFunction } from 'express';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createInviteSchema,
  updateMemberRoleSchema,
} from '@pasteking/validation';
import { WorkspacesService } from './workspaces.service';
import { searchWorkspacePastes as searchWorkspacePastesHandler } from '../pastes/pastes.controller';
import { QuotaService } from '../billing/quota';

const service = new WorkspacesService();
const quotaService = new QuotaService();

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0]! : v!;
}

// ─── Workspace CRUD ──────────────────────────────────────────────────────────

export async function createWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = createWorkspaceSchema.parse(req.body);
    await quotaService.enforceWorkspaceCreationLimit(req.user!.id);
    const workspace = await service.createWorkspace(input, req.user!.id);
    res.status(201).json({ success: true, data: workspace });
  } catch (err) {
    next(err);
  }
}

export async function listMyWorkspaces(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaces = await service.listMyWorkspaces(req.user!.id);
    res.json({ success: true, data: workspaces });
  } catch (err) {
    next(err);
  }
}

export async function getWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const workspace = await service.getWorkspace(param(req, 'id'), req.user!.id);
    res.json({ success: true, data: workspace });
  } catch (err) {
    next(err);
  }
}

export async function updateWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = updateWorkspaceSchema.parse(req.body);
    const workspace = await service.updateWorkspace(param(req, 'id'), input, req.user!.id);
    res.json({ success: true, data: workspace });
  } catch (err) {
    next(err);
  }
}

export async function deleteWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await service.deleteWorkspace(param(req, 'id'), req.user!.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export async function createInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createInviteSchema.parse(req.body);
    await quotaService.enforceWorkspaceMemberLimit(param(req, 'id'));
    const invite = await service.createInvite(param(req, 'id'), input, req.user!.id);
    res.status(201).json({ success: true, data: invite });
  } catch (err) {
    next(err);
  }
}

export async function listInvites(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invites = await service.listInvites(param(req, 'id'), req.user!.id);
    res.json({ success: true, data: invites });
  } catch (err) {
    next(err);
  }
}

export async function listMyInvites(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const invites = await service.listMyInvites(req.user!.email);
    res.json({ success: true, data: invites });
  } catch (err) {
    next(err);
  }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.acceptInvite(param(req, 'inviteId'), req.user!.id, req.user!.email);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function declineInvite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await service.declineInvite(param(req, 'inviteId'), req.user!.id, req.user!.email);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function revokeInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.revokeInvite(param(req, 'id'), param(req, 'inviteId'), req.user!.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const members = await service.listMembers(param(req, 'id'), req.user!.id);
    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = updateMemberRoleSchema.parse(req.body);
    const member = await service.updateMemberRole(
      param(req, 'id'),
      param(req, 'memberId'),
      input.role,
      req.user!.id,
    );
    res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.removeMember(param(req, 'id'), param(req, 'memberId'), req.user!.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ─── Workspace Pastes ────────────────────────────────────────────────────────

export async function listWorkspacePastes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const pastes = await service.listWorkspacePastes(param(req, 'id'), req.user!.id);
    res.json({ success: true, data: pastes });
  } catch (err) {
    next(err);
  }
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export async function listAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const logs = await service.listAuditLogs(param(req, 'id'), req.user!.id);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

// ─── Workspace Search ────────────────────────────────────────────────────────

export { searchWorkspacePastesHandler as searchWorkspacePastes };
