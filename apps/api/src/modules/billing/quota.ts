import { prisma } from '@pasteking/db';
import type { PlanEntitlements, UsageResponse, WorkspaceUsageResponse } from '@pasteking/types';
import { AppError } from '../../middleware';
import { getEffectiveEntitlements } from './plans';
import { logger } from '../../logger';

// ─── Usage Queries (DB aggregation) ──────────────────────────────────────────

export class UsageService {
  /** Get personal usage for a user */
  async getPersonalUsage(userId: string): Promise<UsageResponse> {
    const [pasteStats, tokenCount, workspaceCount] = await Promise.all([
      prisma.paste.aggregate({
        where: { authorId: userId, workspaceId: null, status: 'ACTIVE' },
        _count: true,
      }),
      prisma.apiToken.count({
        where: { userId, revokedAt: null },
      }),
      prisma.workspace.count({
        where: { ownerId: userId },
      }),
    ]);

    // Estimate storage: sum content lengths for DB-stored pastes
    const storageResult = await prisma.$queryRawUnsafe<[{ total_bytes: bigint }]>(
      `SELECT COALESCE(SUM(OCTET_LENGTH(COALESCE(content, ''))), 0) AS total_bytes
       FROM pastes
       WHERE author_id = $1 AND workspace_id IS NULL AND status = 'ACTIVE'`,
      userId,
    );

    const storageBytes = Number(storageResult[0]?.total_bytes ?? 0);

    return {
      personalStorageBytes: storageBytes,
      personalActivePastes: pasteStats._count,
      activeApiTokens: tokenCount,
      workspacesOwned: workspaceCount,
    };
  }

  /** Get workspace usage */
  async getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsageResponse> {
    const [pasteCount, memberCount] = await Promise.all([
      prisma.paste.count({
        where: { workspaceId, status: 'ACTIVE' },
      }),
      prisma.workspaceMember.count({
        where: { workspaceId },
      }),
    ]);

    const storageResult = await prisma.$queryRawUnsafe<[{ total_bytes: bigint }]>(
      `SELECT COALESCE(SUM(OCTET_LENGTH(COALESCE(content, ''))), 0) AS total_bytes
       FROM pastes
       WHERE workspace_id = $1 AND status = 'ACTIVE'`,
      workspaceId,
    );

    const storageBytes = Number(storageResult[0]?.total_bytes ?? 0);

    return {
      storageBytes,
      activePastes: pasteCount,
      memberCount,
    };
  }

  /** Resolve effective entitlements for a user */
  async getUserEntitlements(userId: string): Promise<PlanEntitlements> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planId: true, subscriptionStatus: true, currentPeriodEnd: true },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return getEffectiveEntitlements(user.planId, user.subscriptionStatus, user.currentPeriodEnd);
  }

  /** Resolve effective entitlements for a workspace */
  async getWorkspaceEntitlements(workspaceId: string): Promise<PlanEntitlements> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { planId: true, subscriptionStatus: true, currentPeriodEnd: true },
    });
    if (!ws) throw new AppError(404, 'NOT_FOUND', 'Workspace not found');
    return getEffectiveEntitlements(ws.planId, ws.subscriptionStatus, ws.currentPeriodEnd);
  }
}

// ─── Quota Enforcement ───────────────────────────────────────────────────────

export class QuotaService {
  private usage = new UsageService();

  /** Enforce paste size limit for personal context */
  async enforcePersonalPasteSize(userId: string, contentBytes: number): Promise<void> {
    const entitlements = await this.usage.getUserEntitlements(userId);
    if (contentBytes > entitlements.maxPasteSizeBytes) {
      this.throwQuotaError(
        'maxPasteSizeBytes',
        contentBytes,
        entitlements.maxPasteSizeBytes,
        await this.getUserPlanId(userId),
      );
    }
  }

  /** Enforce paste size limit for workspace context */
  async enforceWorkspacePasteSize(workspaceId: string, contentBytes: number): Promise<void> {
    const entitlements = await this.usage.getWorkspaceEntitlements(workspaceId);
    if (contentBytes > entitlements.maxPasteSizeBytes) {
      this.throwQuotaError(
        'maxPasteSizeBytes',
        contentBytes,
        entitlements.maxPasteSizeBytes,
        await this.getWorkspacePlanId(workspaceId),
      );
    }
  }

  /** Enforce raw upload size */
  async enforceRawUploadSize(userId: string | undefined, contentBytes: number): Promise<void> {
    if (!userId) {
      // Anonymous: use free limits
      const freeLimit = (await import('./plans')).getEntitlements('free').maxRawUploadSizeBytes;
      if (contentBytes > freeLimit) {
        this.throwQuotaError('maxRawUploadSizeBytes', contentBytes, freeLimit, 'free');
      }
      return;
    }
    const entitlements = await this.usage.getUserEntitlements(userId);
    if (contentBytes > entitlements.maxRawUploadSizeBytes) {
      this.throwQuotaError(
        'maxRawUploadSizeBytes',
        contentBytes,
        entitlements.maxRawUploadSizeBytes,
        await this.getUserPlanId(userId),
      );
    }
  }

  /** Enforce API token creation limit */
  async enforceApiTokenLimit(userId: string): Promise<void> {
    const [entitlements, usage] = await Promise.all([
      this.usage.getUserEntitlements(userId),
      this.usage.getPersonalUsage(userId),
    ]);
    if (usage.activeApiTokens >= entitlements.maxActiveApiTokens) {
      this.throwQuotaError(
        'maxActiveApiTokens',
        usage.activeApiTokens,
        entitlements.maxActiveApiTokens,
        await this.getUserPlanId(userId),
      );
    }
  }

  /** Enforce workspace creation limit */
  async enforceWorkspaceCreationLimit(userId: string): Promise<void> {
    const [entitlements, usage] = await Promise.all([
      this.usage.getUserEntitlements(userId),
      this.usage.getPersonalUsage(userId),
    ]);
    if (usage.workspacesOwned >= entitlements.maxWorkspacesOwned) {
      this.throwQuotaError(
        'maxWorkspacesOwned',
        usage.workspacesOwned,
        entitlements.maxWorkspacesOwned,
        await this.getUserPlanId(userId),
      );
    }
  }

  /** Enforce workspace member invite limit */
  async enforceWorkspaceMemberLimit(workspaceId: string): Promise<void> {
    const [entitlements, usage] = await Promise.all([
      this.usage.getWorkspaceEntitlements(workspaceId),
      this.usage.getWorkspaceUsage(workspaceId),
    ]);
    if (usage.memberCount >= entitlements.maxWorkspaceMembers) {
      this.throwQuotaError(
        'maxWorkspaceMembers',
        usage.memberCount,
        entitlements.maxWorkspaceMembers,
        await this.getWorkspacePlanId(workspaceId),
      );
    }
  }

  /** Enforce personal storage limit */
  async enforcePersonalStorageLimit(userId: string, additionalBytes: number): Promise<void> {
    const [entitlements, usage] = await Promise.all([
      this.usage.getUserEntitlements(userId),
      this.usage.getPersonalUsage(userId),
    ]);
    const projected = usage.personalStorageBytes + additionalBytes;
    if (projected > entitlements.maxPersonalStorageBytes) {
      this.throwQuotaError(
        'maxPersonalStorageBytes',
        projected,
        entitlements.maxPersonalStorageBytes,
        await this.getUserPlanId(userId),
      );
    }
  }

  /** Enforce workspace storage limit */
  async enforceWorkspaceStorageLimit(workspaceId: string, additionalBytes: number): Promise<void> {
    const [entitlements, usage] = await Promise.all([
      this.usage.getWorkspaceEntitlements(workspaceId),
      this.usage.getWorkspaceUsage(workspaceId),
    ]);
    const projected = usage.storageBytes + additionalBytes;
    if (projected > entitlements.maxWorkspaceStorageBytes) {
      this.throwQuotaError(
        'maxWorkspaceStorageBytes',
        projected,
        entitlements.maxWorkspaceStorageBytes,
        await this.getWorkspacePlanId(workspaceId),
      );
    }
  }

  /** Enforce personal paste count limit */
  async enforcePersonalPasteCountLimit(userId: string): Promise<void> {
    const [entitlements, usage] = await Promise.all([
      this.usage.getUserEntitlements(userId),
      this.usage.getPersonalUsage(userId),
    ]);
    if (usage.personalActivePastes >= entitlements.maxPersonalActivePastes) {
      this.throwQuotaError(
        'maxPersonalActivePastes',
        usage.personalActivePastes,
        entitlements.maxPersonalActivePastes,
        await this.getUserPlanId(userId),
      );
    }
  }

  private throwQuotaError(
    quotaName: string,
    currentUsage: number,
    limit: number,
    planId: string,
  ): never {
    logger.warn(
      {
        event: 'quota_exceeded',
        quotaName,
        currentUsage,
        limit,
        planId,
      },
      `Quota exceeded: ${quotaName}`,
    );

    const err = new AppError(
      403,
      'QUOTA_EXCEEDED',
      `Plan limit exceeded for ${quotaName}. Current: ${currentUsage}, limit: ${limit}. Upgrade your plan for higher limits.`,
    );
    (err as AppError & { quotaDetail: unknown }).quotaDetail = {
      quotaName,
      currentUsage,
      limit,
      planId,
    };
    throw err;
  }

  private async getUserPlanId(userId: string): Promise<string> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { planId: true } });
    return u?.planId ?? 'free';
  }

  private async getWorkspacePlanId(workspaceId: string): Promise<string> {
    const w = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { planId: true },
    });
    return w?.planId ?? 'free';
  }
}
