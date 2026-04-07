import { prisma } from '@pasteking/db';
import type { ModerationStatus, ReportStatus, AbuseFlagType } from '@pasteking/types';

export class ModerationRepository {
  // ─── Reports ───────────────────────────────────────────────────────────

  async createReport(data: {
    pasteId: string;
    reporterId: string;
    reason: string;
    description?: string;
  }) {
    return prisma.report.create({ data: { ...data, reason: data.reason as never } });
  }

  async findReportById(id: string) {
    return prisma.report.findUnique({
      where: { id },
      include: {
        paste: {
          select: {
            id: true,
            title: true,
            encrypted: true,
            moderationStatus: true,
            authorId: true,
            mode: true,
            visibility: true,
            status: true,
            workspaceId: true,
            createdAt: true,
          },
        },
        reporter: { select: { username: true } },
      },
    });
  }

  async findDuplicateReport(pasteId: string, reporterId: string) {
    return prisma.report.findUnique({
      where: { pasteId_reporterId: { pasteId, reporterId } },
    });
  }

  async listReports(filters: {
    status?: string;
    reason?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    if (filters.reason) where['reason'] = filters.reason;

    return prisma.report.findMany({
      where,
      include: {
        paste: {
          select: {
            id: true,
            title: true,
            encrypted: true,
            moderationStatus: true,
            authorId: true,
          },
        },
        reporter: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }

  async countReports(filters: { status?: string; reason?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    if (filters.reason) where['reason'] = filters.reason;
    return prisma.report.count({ where });
  }

  async updateReportStatus(
    id: string,
    status: ReportStatus,
    reviewedBy: string,
    reviewNote?: string,
  ) {
    const resolved = status.startsWith('RESOLVED_') || status === 'REJECTED';
    return prisma.report.update({
      where: { id },
      data: {
        status,
        reviewedBy,
        reviewNote,
        ...(resolved ? { resolvedAt: new Date() } : {}),
      },
    });
  }

  async countReportsByPaste(pasteId: string) {
    return prisma.report.count({ where: { pasteId } });
  }

  async countReportsByUser(userId: string) {
    return prisma.report.count({
      where: { paste: { authorId: userId } },
    });
  }

  // ─── Paste Moderation ──────────────────────────────────────────────────

  async getPasteForModeration(id: string) {
    return prisma.paste.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true } },
        _count: { select: { reports: true, abuseFlags: true } },
      },
    });
  }

  async updatePasteModerationStatus(id: string, status: ModerationStatus) {
    return prisma.paste.update({
      where: { id },
      data: { moderationStatus: status },
    });
  }

  async hardDeletePaste(id: string) {
    return prisma.paste.delete({
      where: { id },
    });
  }

  // ─── User Management ──────────────────────────────────────────────────

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { pastes: true, reports: true } },
      },
    });
  }

  async listUsers(filters: {
    status?: string;
    platformRole?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    if (filters.platformRole) where['platformRole'] = filters.platformRole;

    return prisma.user.findMany({
      where,
      include: {
        _count: { select: { pastes: true, reports: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }

  async updateUserStatus(id: string, status: string) {
    return prisma.user.update({
      where: { id },
      data: { status: status as 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' },
    });
  }

  // ─── Abuse Flags ──────────────────────────────────────────────────────

  async createAbuseFlag(data: {
    type: AbuseFlagType;
    severity: string;
    pasteId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    return prisma.abuseFlag.create({
      data: {
        ...data,
        metadata: data.metadata as never,
      },
      select: { id: true },
    });
  }

  async listAbuseFlags(filters: {
    type?: string;
    resolved?: boolean;
    pasteId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      id: string;
      type: string;
      severity: string;
      pasteId: string | null;
      userId: string | null;
      metadata: unknown;
      resolved: boolean;
      createdAt: Date;
    }>
  > {
    const where: Record<string, unknown> = {};
    if (filters.type) where['type'] = filters.type;
    if (filters.resolved !== undefined) where['resolved'] = filters.resolved;
    if (filters.pasteId) where['pasteId'] = filters.pasteId;
    if (filters.userId) where['userId'] = filters.userId;

    return prisma.abuseFlag.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }

  async countAbuseFlagsByPaste(pasteId: string) {
    return prisma.abuseFlag.count({ where: { pasteId } });
  }

  async resolveAbuseFlag(id: string): Promise<{ id: string; resolved: boolean }> {
    return prisma.abuseFlag.update({
      where: { id },
      data: { resolved: true },
    });
  }

  // ─── Audit Log ────────────────────────────────────────────────────────

  async createAuditLog(data: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    return prisma.moderationAuditLog.create({
      data: {
        ...data,
        metadata: data.metadata as never,
      },
      select: { id: true },
    });
  }

  async listAuditLogs(filters: {
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      id: string;
      actorId: string;
      action: string;
      entityType: string;
      entityId: string;
      metadata: unknown;
      createdAt: Date;
      actor: { username: string };
    }>
  > {
    const where: Record<string, unknown> = {};
    if (filters.entityType) where['entityType'] = filters.entityType;
    if (filters.entityId) where['entityId'] = filters.entityId;

    return prisma.moderationAuditLog.findMany({
      where,
      include: { actor: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }

  // ─── Helpers for abuse detection ───────────────────────────────────────

  async countRecentPastesByUser(userId: string, windowMs: number) {
    const since = new Date(Date.now() - windowMs);
    return prisma.paste.count({
      where: { authorId: userId, createdAt: { gte: since } },
    });
  }

  async countOpenReportsForUser(userId: string) {
    return prisma.report.count({
      where: {
        paste: { authorId: userId },
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
    });
  }

  // ─── Admin: List all pastes (paginated) ────────────────────────────────

  async listAllPastes(filters: {
    status?: string;
    moderationStatus?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    if (filters.moderationStatus) where['moderationStatus'] = filters.moderationStatus;

    const [items, total] = await Promise.all([
      prisma.paste.findMany({
        where,
        include: {
          author: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      prisma.paste.count({ where }),
    ]);
    return { items, total };
  }

  // ─── Site Settings ─────────────────────────────────────────────────────

  async getSiteSettings() {
    let settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await prisma.siteSettings.create({ data: { id: 'default' } });
    }
    return settings;
  }

  async updateSiteSettings(data: {
    logoUrl?: string | null;
    faviconUrl?: string | null;
    secretScanThreshold?: number;
    excessivePasteRateWindowMs?: number;
    excessivePasteRateMax?: number;
    repeatedReportThreshold?: number;
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoKeywords?: string | null;
    seoAuthor?: string | null;
    seoCanonicalUrl?: string | null;
    ogImageUrl?: string | null;
    twitterHandle?: string | null;
    facebookAppId?: string | null;
    siteSchemaType?: string;
    robotsIndex?: boolean;
    robotsFollow?: boolean;
  }) {
    return prisma.siteSettings.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
  }
}
