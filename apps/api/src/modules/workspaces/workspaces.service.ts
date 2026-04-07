import type {
  WorkspaceResponse,
  WorkspaceDetailResponse,
  WorkspaceMemberResponse,
  WorkspaceInviteResponse,
  WorkspaceAuditLogResponse,
  WorkspacePasteListItem,
  WorkspaceRole,
} from '@pasteking/types';
import type {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  CreateInviteSchema,
} from '@pasteking/validation';
import { AppError, NotFoundError } from '../../middleware';
import { WorkspacesRepository } from './workspaces.repository';
import { PastesRepository } from '../pastes/pastes.repository';
import { canPerform } from './permissions';

const INVITE_EXPIRY_DAYS = 7;

export class WorkspacesService {
  private repo = new WorkspacesRepository();
  private pastesRepo = new PastesRepository();

  // ─── Workspace Lifecycle ──────────────────────────────────────────────

  async createWorkspace(input: CreateWorkspaceSchema, userId: string): Promise<WorkspaceResponse> {
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'Workspace slug already taken');
    }

    const workspace = await this.repo.create({
      name: input.name,
      slug: input.slug,
      ownerId: userId,
    });

    await this.repo.createAuditLog({
      workspaceId: workspace.id,
      actorId: userId,
      action: 'workspace.created',
      entityType: 'workspace',
      entityId: workspace.id,
    });

    return this.toWorkspaceResponse(workspace);
  }

  async listMyWorkspaces(userId: string): Promise<WorkspaceDetailResponse[]> {
    const memberships = await this.repo.findByUserId(userId);
    const results: WorkspaceDetailResponse[] = [];
    for (const m of memberships) {
      const memberCount = await this.repo.countMembers(m.workspace.id);
      results.push({
        ...this.toWorkspaceResponse(m.workspace),
        memberCount,
        role: m.role as WorkspaceRole,
      });
    }
    return results;
  }

  async getWorkspace(workspaceId: string, userId: string): Promise<WorkspaceDetailResponse> {
    const member = await this.requireMember(workspaceId, userId);
    const workspace = await this.repo.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace', workspaceId);
    const memberCount = await this.repo.countMembers(workspaceId);
    return {
      ...this.toWorkspaceResponse(workspace),
      memberCount,
      role: member.role as WorkspaceRole,
    };
  }

  async updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceSchema,
    userId: string,
  ): Promise<WorkspaceResponse> {
    const member = await this.requireMember(workspaceId, userId);
    this.assertPermission(member.role as WorkspaceRole, 'workspace.update');

    if (input.slug) {
      const existing = await this.repo.findBySlug(input.slug);
      if (existing && existing.id !== workspaceId) {
        throw new AppError(409, 'CONFLICT', 'Workspace slug already taken');
      }
    }

    const workspace = await this.repo.update(workspaceId, input);

    await this.repo.createAuditLog({
      workspaceId,
      actorId: userId,
      action: 'workspace.updated',
      entityType: 'workspace',
      entityId: workspaceId,
      metadata: input,
    });

    return this.toWorkspaceResponse(workspace);
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    const member = await this.requireMember(workspaceId, userId);
    this.assertPermission(member.role as WorkspaceRole, 'workspace.delete');
    await this.repo.delete(workspaceId);
  }

  // ─── Invitations ──────────────────────────────────────────────────────

  async createInvite(
    workspaceId: string,
    input: CreateInviteSchema,
    userId: string,
  ): Promise<WorkspaceInviteResponse> {
    const member = await this.requireMember(workspaceId, userId);
    this.assertPermission(member.role as WorkspaceRole, 'invite.create');

    // Check if user is already a member
    const existingUser = await this.repo.findUserByEmail(input.email);
    if (existingUser) {
      const existingMember = await this.repo.findMember(workspaceId, existingUser.id);
      if (existingMember) {
        throw new AppError(409, 'CONFLICT', 'User is already a workspace member');
      }
    }

    // Check for existing pending invite
    const existingInvite = await this.repo.findPendingInvite(workspaceId, input.email);
    if (existingInvite) {
      throw new AppError(409, 'CONFLICT', 'A pending invite already exists for this email');
    }

    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const invite = await this.repo.createInvite({
      workspaceId,
      email: input.email,
      role: (input.role ?? 'MEMBER') as WorkspaceRole,
      invitedBy: userId,
      expiresAt,
    });

    await this.repo.createAuditLog({
      workspaceId,
      actorId: userId,
      action: 'invite.created',
      entityType: 'invite',
      entityId: invite.id,
      metadata: { email: input.email, role: input.role ?? 'MEMBER' },
    });

    return this.toInviteResponse(invite);
  }

  async listInvites(workspaceId: string, userId: string): Promise<WorkspaceInviteResponse[]> {
    const member = await this.requireMember(workspaceId, userId);
    this.assertPermission(member.role as WorkspaceRole, 'invite.list');
    const invites = await this.repo.listInvitesByWorkspace(workspaceId);
    return invites.map((i) => this.toInviteResponse(i));
  }

  async listMyInvites(email: string): Promise<WorkspaceInviteResponse[]> {
    const invites = await this.repo.listPendingInvitesForUser(email);
    // Mark expired invites
    const now = new Date();
    const results: WorkspaceInviteResponse[] = [];
    for (const invite of invites) {
      if (invite.expiresAt < now) {
        await this.repo.updateInviteStatus(invite.id, 'EXPIRED');
        continue;
      }
      results.push(this.toInviteResponse(invite));
    }
    return results;
  }

  async acceptInvite(inviteId: string, userId: string, userEmail: string): Promise<void> {
    const invite = await this.repo.findInviteById(inviteId);
    if (!invite) throw new NotFoundError('Invite', inviteId);
    if (invite.status !== 'PENDING') {
      throw new AppError(400, 'BAD_REQUEST', 'Invite is no longer pending');
    }
    if (invite.email !== userEmail) {
      throw new AppError(403, 'FORBIDDEN', 'This invite is for a different email address');
    }
    if (invite.expiresAt < new Date()) {
      await this.repo.updateInviteStatus(inviteId, 'EXPIRED');
      throw new AppError(410, 'GONE', 'This invite has expired');
    }

    // Check if already a member (race condition guard)
    const existing = await this.repo.findMember(invite.workspaceId, userId);
    if (existing) {
      await this.repo.updateInviteStatus(inviteId, 'ACCEPTED');
      return;
    }

    await this.repo.addMember(invite.workspaceId, userId, invite.role as WorkspaceRole);
    await this.repo.updateInviteStatus(inviteId, 'ACCEPTED');

    await this.repo.createAuditLog({
      workspaceId: invite.workspaceId,
      actorId: userId,
      action: 'invite.accepted',
      entityType: 'invite',
      entityId: inviteId,
    });
  }

  async declineInvite(inviteId: string, userId: string, userEmail: string): Promise<void> {
    const invite = await this.repo.findInviteById(inviteId);
    if (!invite) throw new NotFoundError('Invite', inviteId);
    if (invite.status !== 'PENDING') {
      throw new AppError(400, 'BAD_REQUEST', 'Invite is no longer pending');
    }
    if (invite.email !== userEmail) {
      throw new AppError(403, 'FORBIDDEN', 'This invite is for a different email address');
    }

    await this.repo.updateInviteStatus(inviteId, 'DECLINED');

    await this.repo.createAuditLog({
      workspaceId: invite.workspaceId,
      actorId: userId,
      action: 'invite.declined',
      entityType: 'invite',
      entityId: inviteId,
    });
  }

  async revokeInvite(workspaceId: string, inviteId: string, userId: string): Promise<void> {
    const member = await this.requireMember(workspaceId, userId);
    this.assertPermission(member.role as WorkspaceRole, 'invite.revoke');

    const invite = await this.repo.findInviteById(inviteId);
    if (!invite || invite.workspaceId !== workspaceId) {
      throw new NotFoundError('Invite', inviteId);
    }
    if (invite.status !== 'PENDING') {
      throw new AppError(400, 'BAD_REQUEST', 'Invite is no longer pending');
    }

    await this.repo.updateInviteStatus(inviteId, 'REVOKED');

    await this.repo.createAuditLog({
      workspaceId,
      actorId: userId,
      action: 'invite.revoked',
      entityType: 'invite',
      entityId: inviteId,
    });
  }

  // ─── Members ──────────────────────────────────────────────────────────

  async listMembers(workspaceId: string, userId: string): Promise<WorkspaceMemberResponse[]> {
    const member = await this.requireMember(workspaceId, userId);
    this.assertPermission(member.role as WorkspaceRole, 'member.list');
    const members = await this.repo.listMembers(workspaceId);
    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      email: m.user.email,
      role: m.role as WorkspaceRole,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
    userId: string,
  ): Promise<WorkspaceMemberResponse> {
    const actor = await this.requireMember(workspaceId, userId);
    this.assertPermission(actor.role as WorkspaceRole, 'member.updateRole');

    const target = await this.repo.findMemberById(memberId);
    if (!target || target.workspaceId !== workspaceId) {
      throw new NotFoundError('Member', memberId);
    }
    if (target.role === 'OWNER') {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot change the owner role');
    }
    if (role === 'OWNER') {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Cannot promote to owner. Use ownership transfer instead.',
      );
    }

    await this.repo.updateMemberRole(memberId, role);

    await this.repo.createAuditLog({
      workspaceId,
      actorId: userId,
      action: 'member.roleChanged',
      entityType: 'member',
      entityId: memberId,
      metadata: { oldRole: target.role, newRole: role },
    });

    return {
      id: target.id,
      userId: target.userId,
      username: target.user!.username,
      email: target.user!.email,
      role,
      createdAt: target.createdAt.toISOString(),
    };
  }

  async removeMember(workspaceId: string, memberId: string, userId: string): Promise<void> {
    const actor = await this.requireMember(workspaceId, userId);
    const target = await this.repo.findMemberById(memberId);
    if (!target || target.workspaceId !== workspaceId) {
      throw new NotFoundError('Member', memberId);
    }
    if (target.userId === userId) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Cannot remove yourself. Transfer ownership or leave the workspace.',
      );
    }
    if (target.role === 'OWNER') {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot remove the workspace owner');
    }

    if (
      !canPerform(actor.role as WorkspaceRole, 'member.remove', {
        targetRole: target.role as WorkspaceRole,
      })
    ) {
      throw new AppError(403, 'FORBIDDEN', 'Not authorized to remove this member');
    }

    await this.repo.removeMember(memberId);

    await this.repo.createAuditLog({
      workspaceId,
      actorId: userId,
      action: 'member.removed',
      entityType: 'member',
      entityId: memberId,
      metadata: { removedUserId: target.userId, removedRole: target.role },
    });
  }

  // ─── Workspace Pastes ─────────────────────────────────────────────────

  async listWorkspacePastes(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspacePasteListItem[]> {
    const member = await this.requireMember(workspaceId, userId);
    this.assertPermission(member.role as WorkspaceRole, 'paste.view');

    const pastes = await this.pastesRepo.findByWorkspace(workspaceId);
    return pastes.map((p) => ({
      id: p.id,
      title: p.title,
      mode: p.mode as WorkspacePasteListItem['mode'],
      visibility: p.visibility as WorkspacePasteListItem['visibility'],
      status: p.status as WorkspacePasteListItem['status'],
      language: p.language,
      burnAfterRead: p.burnAfterRead,
      encrypted: p.encrypted,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      authorUsername: p.author?.username ?? null,
      workspaceId: p.workspaceId!,
    }));
  }

  // ─── Audit Logs ───────────────────────────────────────────────────────

  async listAuditLogs(workspaceId: string, userId: string): Promise<WorkspaceAuditLogResponse[]> {
    const member = await this.requireMember(workspaceId, userId);
    this.assertPermission(member.role as WorkspaceRole, 'auditLog.view');

    const logs = await this.repo.listAuditLogs(workspaceId);
    return logs.map((l) => ({
      id: l.id,
      actorId: l.actorId,
      actorUsername: l.actor.username,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  async requireMember(workspaceId: string, userId: string) {
    const workspace = await this.repo.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace', workspaceId);

    const member = await this.repo.findMember(workspaceId, userId);
    if (!member) {
      throw new AppError(403, 'FORBIDDEN', 'You are not a member of this workspace');
    }
    return member;
  }

  /** Get workspace member role (returns null if not a member) */
  async getMemberRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const member = await this.repo.findMember(workspaceId, userId);
    return member ? (member.role as WorkspaceRole) : null;
  }

  async logAction(
    workspaceId: string,
    actorId: string,
    action: string,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.repo.createAuditLog({
      workspaceId,
      actorId,
      action,
      entityType,
      entityId,
      metadata,
    });
  }

  private assertPermission(
    role: WorkspaceRole,
    action: Parameters<typeof canPerform>[1],
    opts?: Parameters<typeof canPerform>[2],
  ) {
    if (!canPerform(role, action, opts)) {
      throw new AppError(403, 'FORBIDDEN', `Not authorized to perform: ${action}`);
    }
  }

  private toWorkspaceResponse(w: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  }): WorkspaceResponse {
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      ownerId: w.ownerId,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    };
  }

  private toInviteResponse(i: {
    id: string;
    workspaceId: string;
    email: string;
    role: string;
    status: string;
    invitedBy: string;
    expiresAt: Date;
    createdAt: Date;
  }): WorkspaceInviteResponse {
    return {
      id: i.id,
      workspaceId: i.workspaceId,
      email: i.email,
      role: i.role as WorkspaceRole,
      status: i.status as WorkspaceInviteResponse['status'],
      invitedBy: i.invitedBy,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    };
  }
}
