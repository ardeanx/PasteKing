import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { requireAuth, optionalAuth } from '../../middleware';
import {
  createWorkspace,
  listMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  createInvite,
  listInvites,
  listMyInvites,
  acceptInvite,
  declineInvite,
  revokeInvite,
  listMembers,
  updateMemberRole,
  removeMember,
  listWorkspacePastes,
  listAuditLogs,
  searchWorkspacePastes,
} from './workspaces.controller';

export const workspacesRouter: IRouter = Router();

workspacesRouter.use(optionalAuth);
workspacesRouter.use(requireAuth);

// ─── My invites (before /:id routes) ────────────────────────────────────────
workspacesRouter.get('/invites/mine', listMyInvites);

// ─── Workspace CRUD ──────────────────────────────────────────────────────────
workspacesRouter.post('/', createWorkspace);
workspacesRouter.get('/', listMyWorkspaces);
workspacesRouter.get('/:id', getWorkspace);
workspacesRouter.patch('/:id', updateWorkspace);
workspacesRouter.delete('/:id', deleteWorkspace);

// ─── Invites ─────────────────────────────────────────────────────────────────
workspacesRouter.post('/:id/invites', createInvite);
workspacesRouter.get('/:id/invites', listInvites);
workspacesRouter.post('/:id/invites/:inviteId/accept', acceptInvite);
workspacesRouter.post('/:id/invites/:inviteId/decline', declineInvite);
workspacesRouter.delete('/:id/invites/:inviteId', revokeInvite);

// ─── Members ─────────────────────────────────────────────────────────────────
workspacesRouter.get('/:id/members', listMembers);
workspacesRouter.patch('/:id/members/:memberId', updateMemberRole);
workspacesRouter.delete('/:id/members/:memberId', removeMember);

// ─── Workspace Pastes ────────────────────────────────────────────────────────
workspacesRouter.get('/:id/pastes', listWorkspacePastes);

// ─── Workspace Search ────────────────────────────────────────────────────────
workspacesRouter.get('/:id/search/pastes', searchWorkspacePastes);

// ─── Audit Logs ──────────────────────────────────────────────────────────────
workspacesRouter.get('/:id/audit-logs', listAuditLogs);
