import { prisma } from '@pasteking/db';
import type {
  SubscriptionResponse,
  BillingStatusResponse,
  WorkspaceBillingStatusResponse,
  CheckoutSessionResponse,
  PortalSessionResponse,
  PlanId,
  AdminBillingSummary,
} from '@pasteking/types';
import { AppError } from '../../middleware';
import { logger } from '../../logger';
import { requireStripe } from './stripe';
import { getPlanById, getEffectiveEntitlements } from './plans';
import { UsageService } from './quota';
import { env } from '../../env';

export class BillingService {
  private usage = new UsageService();

  // ─── Personal Billing ──────────────────────────────────────────────────

  async getPersonalBillingStatus(userId: string): Promise<BillingStatusResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planId: true,
        subscriptionStatus: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const plan = getPlanById(user.planId) ?? getPlanById('free')!;
    const entitlements = getEffectiveEntitlements(
      user.planId,
      user.subscriptionStatus,
      user.currentPeriodEnd,
    );
    const usage = await this.usage.getPersonalUsage(userId);

    return {
      subscription: {
        planId: plan.id,
        planName: plan.name,
        subscriptionStatus: user.subscriptionStatus as SubscriptionResponse['subscriptionStatus'],
        currentPeriodStart: user.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
        entitlements,
      },
      usage,
    };
  }

  async createPersonalCheckoutSession(
    userId: string,
    planId: PlanId,
  ): Promise<CheckoutSessionResponse> {
    const plan = getPlanById(planId);
    if (!plan || !plan.stripePriceId) {
      throw new AppError(400, 'BAD_REQUEST', `No paid plan found for: ${planId}`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const stripe = requireStripe();
    const baseUrl = env.API_URL.replace(/\/+$/, '');

    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${baseUrl.replace(':4000', ':3000')}/billing?success=true`,
      cancel_url: `${baseUrl.replace(':4000', ':3000')}/billing?canceled=true`,
      metadata: { subjectType: 'user', subjectId: userId, planId },
      client_reference_id: userId,
    };

    if (user.stripeCustomerId) {
      sessionParams.customer = user.stripeCustomerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0],
    );

    logger.info(
      {
        event: 'checkout_session_created',
        subjectType: 'user',
        subjectId: userId,
        planId,
        sessionId: session.id,
      },
      'Checkout session created',
    );

    return { url: session.url! };
  }

  async createPersonalPortalSession(userId: string): Promise<PortalSessionResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      throw new AppError(400, 'BAD_REQUEST', 'No billing account. Subscribe to a plan first.');
    }

    const stripe = requireStripe();
    const baseUrl = env.API_URL.replace(/\/+$/, '');

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl.replace(':4000', ':3000')}/billing`,
    });

    return { url: session.url };
  }

  // ─── Workspace Billing ─────────────────────────────────────────────────

  async getWorkspaceBillingStatus(workspaceId: string): Promise<WorkspaceBillingStatusResponse> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        planId: true,
        subscriptionStatus: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    });
    if (!ws) throw new AppError(404, 'NOT_FOUND', 'Workspace not found');

    const plan = getPlanById(ws.planId) ?? getPlanById('free')!;
    const entitlements = getEffectiveEntitlements(
      ws.planId,
      ws.subscriptionStatus,
      ws.currentPeriodEnd,
    );
    const usage = await this.usage.getWorkspaceUsage(workspaceId);

    return {
      subscription: {
        planId: plan.id,
        planName: plan.name,
        subscriptionStatus: ws.subscriptionStatus as SubscriptionResponse['subscriptionStatus'],
        currentPeriodStart: ws.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: ws.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: ws.cancelAtPeriodEnd,
        entitlements,
      },
      usage,
    };
  }

  async createWorkspaceCheckoutSession(
    workspaceId: string,
    userId: string,
    planId: PlanId,
  ): Promise<CheckoutSessionResponse> {
    // Verify ownership
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true, stripeCustomerId: true },
    });
    if (!ws) throw new AppError(404, 'NOT_FOUND', 'Workspace not found');
    if (ws.ownerId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the workspace owner can manage billing');
    }

    const plan = getPlanById(planId);
    if (!plan || !plan.stripePriceId) {
      throw new AppError(400, 'BAD_REQUEST', `No paid plan found for: ${planId}`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const stripe = requireStripe();
    const baseUrl = env.API_URL.replace(/\/+$/, '');

    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${baseUrl.replace(':4000', ':3000')}/workspaces/${workspaceId}/billing?success=true`,
      cancel_url: `${baseUrl.replace(':4000', ':3000')}/workspaces/${workspaceId}/billing?canceled=true`,
      metadata: { subjectType: 'workspace', subjectId: workspaceId, planId },
      client_reference_id: userId,
    };

    if (ws.stripeCustomerId) {
      sessionParams.customer = ws.stripeCustomerId;
    } else {
      sessionParams.customer_email = user?.email;
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0],
    );

    logger.info(
      {
        event: 'checkout_session_created',
        subjectType: 'workspace',
        subjectId: workspaceId,
        planId,
        sessionId: session.id,
      },
      'Workspace checkout session created',
    );

    return { url: session.url! };
  }

  async createWorkspacePortalSession(
    workspaceId: string,
    userId: string,
  ): Promise<PortalSessionResponse> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true, stripeCustomerId: true },
    });
    if (!ws) throw new AppError(404, 'NOT_FOUND', 'Workspace not found');
    if (ws.ownerId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the workspace owner can manage billing');
    }
    if (!ws.stripeCustomerId) {
      throw new AppError(400, 'BAD_REQUEST', 'No billing account. Subscribe to a plan first.');
    }

    const stripe = requireStripe();
    const baseUrl = env.API_URL.replace(/\/+$/, '');

    const session = await stripe.billingPortal.sessions.create({
      customer: ws.stripeCustomerId,
      return_url: `${baseUrl.replace(':4000', ':3000')}/workspaces/${workspaceId}/billing`,
    });

    return { url: session.url };
  }

  // ─── Admin ─────────────────────────────────────────────────────────────

  async getAdminUserBillingSummary(userId: string): Promise<AdminBillingSummary> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planId: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
      },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return {
      planId: user.planId as PlanId,
      subscriptionStatus: user.subscriptionStatus as AdminBillingSummary['subscriptionStatus'],
      stripeCustomerId: user.stripeCustomerId,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
    };
  }

  async getAdminWorkspaceBillingSummary(workspaceId: string): Promise<AdminBillingSummary> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        planId: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
      },
    });
    if (!ws) throw new AppError(404, 'NOT_FOUND', 'Workspace not found');
    return {
      planId: ws.planId as PlanId,
      subscriptionStatus: ws.subscriptionStatus as AdminBillingSummary['subscriptionStatus'],
      stripeCustomerId: ws.stripeCustomerId,
      cancelAtPeriodEnd: ws.cancelAtPeriodEnd,
      currentPeriodEnd: ws.currentPeriodEnd?.toISOString() ?? null,
    };
  }

  // ─── Reconciliation ────────────────────────────────────────────────────
  // Manual reconciliation: sync subscription state from Stripe for a user or workspace.

  async reconcileUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true },
    });
    if (!user?.stripeSubscriptionId) return;

    const stripe = requireStripe();
    const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    await this.syncSubscriptionFromStripe(sub as any, 'user');
    logger.info({ event: 'reconcile_user', userId }, 'User subscription reconciled');
  }

  async reconcileWorkspace(workspaceId: string): Promise<void> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { stripeSubscriptionId: true },
    });
    if (!ws?.stripeSubscriptionId) return;

    const stripe = requireStripe();
    const sub = await stripe.subscriptions.retrieve(ws.stripeSubscriptionId);
    await this.syncSubscriptionFromStripe(sub as any, 'workspace');
    logger.info({ event: 'reconcile_workspace', workspaceId }, 'Workspace subscription reconciled');
  }

  // ─── Subscription Sync (from webhook/reconciliation) ───────────────────

  async syncSubscriptionFromStripe(
    subscription: {
      id: string;
      customer: string | { id: string };
      status: string;
      metadata: Record<string, string>;
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
      items?: { data: Array<{ price?: { id: string; metadata?: Record<string, string> } }> };
    },
    subjectTypeHint?: string,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const subjectType = subjectTypeHint ?? subscription.metadata?.subjectType;
    const planId =
      subscription.metadata?.planId ??
      subscription.items?.data[0]?.price?.metadata?.planId ??
      'pro';

    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      trialing: 'TRIALING',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      incomplete: 'INCOMPLETE',
      unpaid: 'UNPAID',
      incomplete_expired: 'CANCELED',
      paused: 'CANCELED',
    };
    const subscriptionStatus = statusMap[subscription.status] ?? 'FREE';

    const updateData = {
      planId,
      subscriptionStatus: subscriptionStatus as
        | 'FREE'
        | 'TRIALING'
        | 'ACTIVE'
        | 'PAST_DUE'
        | 'CANCELED'
        | 'INCOMPLETE'
        | 'UNPAID',
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };

    if (subjectType === 'workspace') {
      // Find workspace by stripe customer ID
      let ws = await prisma.workspace.findUnique({ where: { stripeCustomerId: customerId } });
      if (!ws) {
        ws = await prisma.workspace.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });
      }
      if (!ws) {
        const subjectId = subscription.metadata?.subjectId;
        if (subjectId) {
          ws = await prisma.workspace.findUnique({ where: { id: subjectId } });
        }
      }
      if (ws) {
        await prisma.workspace.update({ where: { id: ws.id }, data: updateData });
        logger.info(
          {
            event: 'subscription_synced',
            subjectType: 'workspace',
            subjectId: ws.id,
            status: subscriptionStatus,
            planId,
          },
          'Workspace subscription synced',
        );
      }
    } else {
      // Find user by stripe customer ID
      let user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
      if (!user) {
        user = await prisma.user.findUnique({ where: { stripeSubscriptionId: subscription.id } });
      }
      if (!user) {
        const subjectId = subscription.metadata?.subjectId;
        if (subjectId) {
          user = await prisma.user.findUnique({ where: { id: subjectId } });
        }
      }
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: updateData });
        logger.info(
          {
            event: 'subscription_synced',
            subjectType: 'user',
            subjectId: user.id,
            status: subscriptionStatus,
            planId,
          },
          'User subscription synced',
        );
      }
    }
  }

  /**
   * Handle canceled/expired subscription → revert to free plan.
   * Preserves existing data (does not delete anything).
   */
  async revertToFree(subjectType: 'user' | 'workspace', customerId: string): Promise<void> {
    const freeData = {
      planId: 'free',
      subscriptionStatus: 'FREE' as const,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };

    if (subjectType === 'workspace') {
      const ws = await prisma.workspace.findUnique({ where: { stripeCustomerId: customerId } });
      if (ws) {
        await prisma.workspace.update({ where: { id: ws.id }, data: freeData });
        logger.info(
          { event: 'reverted_to_free', subjectType: 'workspace', subjectId: ws.id },
          'Workspace reverted to free',
        );
      }
    } else {
      const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: freeData });
        logger.info(
          { event: 'reverted_to_free', subjectType: 'user', subjectId: user.id },
          'User reverted to free',
        );
      }
    }
  }
}
