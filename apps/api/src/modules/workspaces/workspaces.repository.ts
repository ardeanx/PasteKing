import { prisma } from '@pasteking/db';
import type { WorkspaceRole, InviteStatus } from '@pasteking/types';

export class WorkspacesRepository {
  // ─── Workspace CRUD ───────────────────────────────────────────────────

  async create(data: { name: string; slug: string; ownerId: string }) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: data.name, slug: data.slug, ownerId: data.ownerId },
      });

      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: data.ownerId, role: 'OWNER' },
      });

      return workspace;
    });
  }

  async findById(id: string) {
    return prisma.workspace.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return prisma.workspace.findUnique({ where: { slug } });
  }

  async update(id: string, data: { name?: string; slug?: string }) {
    return prisma.workspace.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.workspace.delete({ where: { id } });
  }

  async findByUserId(userId: string) {
    return prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Members ──────────────────────────────────────────────────────────

  async findMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  async findMemberById(id: string) {
    return prisma.workspaceMember.findUnique({
      where: { id },
      include: { user: { select: { username: true, email: true } } },
    });
  }

  async listMembers(workspaceId: string) {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { username: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
    return prisma.workspaceMember.create({
      data: { workspaceId, userId, role },
    });
  }

  async updateMemberRole(id: string, role: WorkspaceRole) {
    return prisma.workspaceMember.update({
      where: { id },
      data: { role },
    });
  }

  async removeMember(id: string) {
    return prisma.workspaceMember.delete({ where: { id } });
  }

  async countMembers(workspaceId: string) {
    return prisma.workspaceMember.count({ where: { workspaceId } });
  }

  // ─── Invites ──────────────────────────────────────────────────────────

  async createInvite(data: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    invitedBy: string;
    expiresAt: Date;
  }) {
    return prisma.workspaceInvite.create({ data });
  }

  async findInviteById(id: string) {
    return prisma.workspaceInvite.findUnique({
      where: { id },
      include: { workspace: true },
    });
  }

  async findPendingInvite(workspaceId: string, email: string) {
    return prisma.workspaceInvite.findFirst({
      where: { workspaceId, email, status: 'PENDING' },
    });
  }

  async listInvitesByWorkspace(workspaceId: string) {
    return prisma.workspaceInvite.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPendingInvitesForUser(email: string) {
    return prisma.workspaceInvite.findMany({
      where: { email, status: 'PENDING' },
      include: { workspace: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInviteStatus(id: string, status: InviteStatus) {
    return prisma.workspaceInvite.update({ where: { id }, data: { status } });
  }

  // ─── Audit Logs ───────────────────────────────────────────────────────

  async createAuditLog(data: {
    workspaceId: string;
    actorId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    return prisma.workspaceAuditLog.create({
      data: {
        ...data,
        metadata: data.metadata as never,
      },
      select: { id: true },
    });
  }

  async listAuditLogs(workspaceId: string, limit = 50, offset = 0): Promise<Array<{
    id: string;
    workspaceId: string;
    actorId: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    metadata: unknown;
    createdAt: Date;
    actor: { username: string };
  }>> {
    return prisma.workspaceAuditLog.findMany({
      where: { workspaceId },
      include: { actor: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }
}
