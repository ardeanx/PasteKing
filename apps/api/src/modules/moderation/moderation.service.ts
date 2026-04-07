import type {
  ReportResponse,
  AdminReportResponse,
  AdminPasteModerationResponse,
  AdminUserResponse,
  AbuseFlagResponse,
  ModerationAuditLogResponse,
  ReportStatus,
  ModerationAction,
  AbuseFlagType,
} from '@pasteking/types';
import type {
  CreateReportSchema,
  UpdateReportStatusSchema,
  ModerationActionSchema,
  UpdateUserStatusSchema,
} from '@pasteking/validation';
import { AppError, NotFoundError } from '../../middleware';
import { getStorage } from '../../storage';
import { logger } from '../../logger';
import { ModerationRepository } from './moderation.repository';

/**
 * Abuse signal thresholds — defaults loaded from DB via SiteSettings.
 * Falls back to these values if DB is unavailable.
 */
const DEFAULT_THRESHOLDS = {
  SECRET_SCAN_THRESHOLD: 3,
  EXCESSIVE_PASTE_RATE_WINDOW_MS: 5 * 60 * 1000,
  EXCESSIVE_PASTE_RATE_MAX: 30,
  REPEATED_REPORT_THRESHOLD: 5,
};

export class ModerationService {
  private repo = new ModerationRepository();

  private async getThresholds() {
    try {
      const s = await this.repo.getSiteSettings();
      return {
        SECRET_SCAN_THRESHOLD: s.secretScanThreshold,
        EXCESSIVE_PASTE_RATE_WINDOW_MS: s.excessivePasteRateWindowMs,
        EXCESSIVE_PASTE_RATE_MAX: s.excessivePasteRateMax,
        REPEATED_REPORT_THRESHOLD: s.repeatedReportThreshold,
      };
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  }

  // ─── Reports ─────────────────────────────────────────────────────────

  async createReport(input: CreateReportSchema, reporterId: string): Promise<ReportResponse> {
    // Check paste exists
    const paste = await this.repo.getPasteForModeration(input.pasteId);
    if (!paste || paste.status === 'DELETED') {
      throw new NotFoundError('Paste', input.pasteId);
    }

    // Prevent self-reporting
    if (paste.authorId === reporterId) {
      throw new AppError(400, 'BAD_REQUEST', 'You cannot report your own paste');
    }

    // Prevent duplicate reports
    const existing = await this.repo.findDuplicateReport(input.pasteId, reporterId);
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'You have already reported this paste');
    }

    const report = await this.repo.createReport({
      pasteId: input.pasteId,
      reporterId,
      reason: input.reason,
      description: input.description,
    });

    // Mark paste for review if not already moderated
    if (paste.moderationStatus === 'NONE') {
      await this.repo.updatePasteModerationStatus(input.pasteId, 'PENDING_REVIEW');
    }

    // Audit log
    await this.repo.createAuditLog({
      actorId: reporterId,
      action: 'report.created',
      entityType: 'report',
      entityId: report.id,
      metadata: { pasteId: input.pasteId, reason: input.reason },
    });

    // Check for repeated reports against this user's content
    if (paste.authorId) {
      await this.checkRepeatedReports(paste.authorId);
    }

    return this.toReportResponse(report);
  }

  async getReport(id: string): Promise<AdminReportResponse> {
    const report = await this.repo.findReportById(id);
    if (!report) throw new NotFoundError('Report', id);
    return this.toAdminReportResponse(report);
  }

  async listReports(filters: {
    status?: string;
    reason?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AdminReportResponse[]; total: number }> {
    const [reports, total] = await Promise.all([
      this.repo.listReports(filters),
      this.repo.countReports(filters),
    ]);
    return {
      data: reports.map((r) => this.toAdminReportResponse(r)),
      total,
    };
  }

  async updateReportStatus(
    id: string,
    input: UpdateReportStatusSchema,
    adminId: string,
  ): Promise<ReportResponse> {
    const report = await this.repo.findReportById(id);
    if (!report) throw new NotFoundError('Report', id);

    const updated = await this.repo.updateReportStatus(
      id,
      input.status as ReportStatus,
      adminId,
      input.reviewNote,
    );

    await this.repo.createAuditLog({
      actorId: adminId,
      action: 'report.status_changed',
      entityType: 'report',
      entityId: id,
      metadata: { from: report.status, to: input.status, reviewNote: input.reviewNote },
    });

    return this.toReportResponse(updated);
  }

  // ─── Paste Moderation ──────────────────────────────────────────────────

  async getPasteModeration(pasteId: string): Promise<AdminPasteModerationResponse> {
    const paste = await this.repo.getPasteForModeration(pasteId);
    if (!paste) throw new NotFoundError('Paste', pasteId);
    return {
      id: paste.id,
      title: paste.title,
      mode: paste.mode as AdminPasteModerationResponse['mode'],
      visibility: paste.visibility as AdminPasteModerationResponse['visibility'],
      status: paste.status as AdminPasteModerationResponse['status'],
      moderationStatus: paste.moderationStatus as AdminPasteModerationResponse['moderationStatus'],
      encrypted: paste.encrypted,
      authorId: paste.authorId,
      authorUsername: paste.author?.username ?? null,
      workspaceId: paste.workspaceId,
      reportCount: paste._count.reports,
      flagCount: paste._count.abuseFlags,
      createdAt: paste.createdAt.toISOString(),
    };
  }

  /**
   * Take a moderation action on a paste.
   *
   * Actions:
   * - NO_ACTION: resets moderationStatus to NONE
   * - HIDE_CONTENT: paste content hidden from normal users (metadata visible to owner)
   * - DISABLE_ACCESS: paste inaccessible to anyone except admins
   * - DELETE_CONTENT: removes content from DB/storage, marks paste DELETED + REMOVED
   *
   * For encrypted pastes: same actions work on metadata/access level.
   * Admin cannot inspect encrypted plaintext but can still hide/disable/delete.
   */
  async takeModerationAction(
    pasteId: string,
    input: ModerationActionSchema,
    adminId: string,
  ): Promise<AdminPasteModerationResponse> {
    const paste = await this.repo.getPasteForModeration(pasteId);
    if (!paste) throw new NotFoundError('Paste', pasteId);

    const action = input.action as ModerationAction;

    switch (action) {
      case 'NO_ACTION':
        await this.repo.updatePasteModerationStatus(pasteId, 'NONE');
        break;
      case 'HIDE_CONTENT':
        await this.repo.updatePasteModerationStatus(pasteId, 'HIDDEN');
        break;
      case 'DISABLE_ACCESS':
        await this.repo.updatePasteModerationStatus(pasteId, 'DISABLED');
        break;
      case 'DELETE_CONTENT':
        // Remove from object storage if applicable
        if (paste.contentRef) {
          await getStorage().remove(paste.contentRef);
        }
        await this.repo.hardDeletePaste(pasteId);
        break;
    }

    await this.repo.createAuditLog({
      actorId: adminId,
      action: `paste.${action.toLowerCase()}`,
      entityType: 'paste',
      entityId: pasteId,
      metadata: {
        reason: input.reason,
        encrypted: paste.encrypted,
        previousStatus: paste.moderationStatus,
      },
    });

    logger.info(
      {
        event: 'moderation_action',
        action: input.action,
        pasteId,
        adminId,
        encrypted: paste.encrypted,
      },
      'Moderation action taken',
    );

    return this.getPasteModeration(pasteId);
  }

  // ─── User Management ──────────────────────────────────────────────────

  async getUser(userId: string): Promise<AdminUserResponse> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundError('User', userId);
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      platformRole: user.platformRole as AdminUserResponse['platformRole'],
      status: user.status as AdminUserResponse['status'],
      pasteCount: user._count.pastes,
      reportCount: user._count.reports,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async listUsers(filters: {
    status?: string;
    platformRole?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminUserResponse[]> {
    const users = await this.repo.listUsers(filters);
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      platformRole: u.platformRole as AdminUserResponse['platformRole'],
      status: u.status as AdminUserResponse['status'],
      pasteCount: u._count.pastes,
      reportCount: u._count.reports,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  /**
   * Update user enforcement status.
   *
   * Policy:
   * - ACTIVE: normal access
   * - RESTRICTED: cannot create public/unlisted/workspace pastes
   * - SUSPENDED: cannot authenticate for product usage
   *
   * Admins cannot change their own status or other admins' status.
   */
  async updateUserStatus(
    userId: string,
    input: UpdateUserStatusSchema,
    adminId: string,
  ): Promise<AdminUserResponse> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundError('User', userId);

    if (user.id === adminId) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot change your own status');
    }
    if (user.platformRole === 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', "Cannot change another admin's status");
    }

    await this.repo.updateUserStatus(userId, input.status);

    await this.repo.createAuditLog({
      actorId: adminId,
      action: `user.${input.status.toLowerCase()}`,
      entityType: 'user',
      entityId: userId,
      metadata: {
        from: user.status,
        to: input.status,
        reason: input.reason,
      },
    });

    logger.info(
      {
        event: 'user_status_changed',
        userId,
        from: user.status,
        to: input.status,
        adminId,
      },
      'User status changed',
    );

    return this.getUser(userId);
  }

  // ─── Abuse Signals ────────────────────────────────────────────────────

  /**
   * Create an abuse flag. Called automatically by:
   * - Secret scanning (SECRET_DETECTED)
   * - Paste rate monitoring (EXCESSIVE_PASTE_RATE)
   * - Report volume (REPEATED_REPORTS)
   * - Spam heuristics (SPAM_HEURISTIC)
   */
  async createAbuseFlag(data: {
    type: AbuseFlagType;
    severity?: string;
    pasteId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const flag = await this.repo.createAbuseFlag({
      type: data.type,
      severity: data.severity ?? 'medium',
      pasteId: data.pasteId,
      userId: data.userId,
      metadata: data.metadata,
    });

    // Mark paste for review if flagged
    if (data.pasteId) {
      const paste = await this.repo.getPasteForModeration(data.pasteId);
      if (paste && paste.moderationStatus === 'NONE') {
        await this.repo.updatePasteModerationStatus(data.pasteId, 'PENDING_REVIEW');
      }
    }

    return flag;
  }

  async listAbuseFlags(filters: {
    type?: string;
    resolved?: boolean;
    pasteId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AbuseFlagResponse[]> {
    const flags = await this.repo.listAbuseFlags(filters);
    return flags.map((f) => ({
      id: f.id,
      type: f.type as AbuseFlagResponse['type'],
      severity: f.severity,
      pasteId: f.pasteId,
      userId: f.userId,
      metadata: f.metadata,
      resolved: f.resolved,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  /**
   * Check secret scanning results and flag if above threshold.
   * Only called for non-encrypted pastes.
   */
  async checkSecretScanResults(
    pasteId: string,
    authorId: string | undefined,
    warningCount: number,
  ): Promise<void> {
    const thresholds = await this.getThresholds();
    if (warningCount >= thresholds.SECRET_SCAN_THRESHOLD) {
      await this.createAbuseFlag({
        type: 'SECRET_DETECTED',
        severity: warningCount >= 5 ? 'high' : 'medium',
        pasteId,
        userId: authorId,
        metadata: { warningCount },
      });
    }
  }

  /**
   * Check paste creation rate and flag if excessive.
   */
  async checkPasteRate(userId: string): Promise<void> {
    const thresholds = await this.getThresholds();
    const count = await this.repo.countRecentPastesByUser(
      userId,
      thresholds.EXCESSIVE_PASTE_RATE_WINDOW_MS,
    );
    if (count >= thresholds.EXCESSIVE_PASTE_RATE_MAX) {
      await this.createAbuseFlag({
        type: 'EXCESSIVE_PASTE_RATE',
        severity: 'high',
        userId,
        metadata: { count, windowMs: thresholds.EXCESSIVE_PASTE_RATE_WINDOW_MS },
      });
    }
  }

  /**
   * Check if user has accumulated too many open reports.
   */
  private async checkRepeatedReports(userId: string): Promise<void> {
    const thresholds = await this.getThresholds();
    const count = await this.repo.countOpenReportsForUser(userId);
    if (count >= thresholds.REPEATED_REPORT_THRESHOLD) {
      await this.createAbuseFlag({
        type: 'REPEATED_REPORTS',
        severity: 'high',
        userId,
        metadata: { openReportCount: count },
      });
    }
  }

  // ─── Audit Logs ───────────────────────────────────────────────────────

  async listAuditLogs(filters: {
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationAuditLogResponse[]> {
    const logs = await this.repo.listAuditLogs(filters);
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

  private toReportResponse(report: {
    id: string;
    pasteId: string;
    reporterId: string | null;
    reason: string;
    description: string | null;
    status: string;
    reviewedBy: string | null;
    reviewNote: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ReportResponse {
    return {
      id: report.id,
      pasteId: report.pasteId,
      reporterId: report.reporterId,
      reason: report.reason as ReportResponse['reason'],
      description: report.description,
      status: report.status as ReportResponse['status'],
      reviewedBy: report.reviewedBy,
      reviewNote: report.reviewNote,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }

  private toAdminReportResponse(report: {
    id: string;
    pasteId: string;
    reporterId: string | null;
    reason: string;
    description: string | null;
    status: string;
    reviewedBy: string | null;
    reviewNote: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    paste: {
      id: string;
      title: string | null;
      encrypted: boolean;
      moderationStatus: string;
      authorId: string | null;
    } | null;
    reporter: { username: string } | null;
  }): AdminReportResponse {
    return {
      ...this.toReportResponse(report),
      reporterUsername: report.reporter?.username ?? null,
      pasteTitle: report.paste?.title ?? null,
      pasteEncrypted: report.paste?.encrypted ?? false,
      pasteModerationStatus: (report.paste?.moderationStatus ??
        'NONE') as AdminReportResponse['pasteModerationStatus'],
      pasteAuthorId: report.paste?.authorId ?? null,
    };
  }

  // ─── Admin: List all pastes ──────────────────────────────────────────

  async listAllPastes(filters: {
    status?: string;
    moderationStatus?: string;
    limit?: number;
    offset?: number;
  }) {
    const { items, total } = await this.repo.listAllPastes(filters);
    return {
      data: items.map((p) => ({
        id: p.id,
        title: p.title,
        mode: p.mode,
        visibility: p.visibility,
        status: p.status,
        moderationStatus: p.moderationStatus,
        language: p.language,
        encrypted: p.encrypted,
        authorId: p.authorId,
        authorUsername: p.author?.username ?? null,
        workspaceId: p.workspaceId,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
    };
  }

  // ─── Site Settings ──────────────────────────────────────────────────

  async getSiteSettings() {
    const s = await this.repo.getSiteSettings();
    return {
      logoUrl: s.logoUrl,
      faviconUrl: s.faviconUrl,
      secretScanThreshold: s.secretScanThreshold,
      excessivePasteRateWindowMs: s.excessivePasteRateWindowMs,
      excessivePasteRateMax: s.excessivePasteRateMax,
      repeatedReportThreshold: s.repeatedReportThreshold,
    };
  }

  async updateSiteSettings(data: {
    logoUrl?: string | null;
    faviconUrl?: string | null;
    secretScanThreshold?: number;
    excessivePasteRateWindowMs?: number;
    excessivePasteRateMax?: number;
    repeatedReportThreshold?: number;
  }) {
    const s = await this.repo.updateSiteSettings(data);
    return {
      logoUrl: s.logoUrl,
      faviconUrl: s.faviconUrl,
      secretScanThreshold: s.secretScanThreshold,
      excessivePasteRateWindowMs: s.excessivePasteRateWindowMs,
      excessivePasteRateMax: s.excessivePasteRateMax,
      repeatedReportThreshold: s.repeatedReportThreshold,
    };
  }
}
