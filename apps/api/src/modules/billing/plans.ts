import type { PlanDefinition, PlanEntitlements, PlanId } from '@pasteking/types';

// ─── Plan Catalog ────────────────────────────────────────────────────────────
// Single source of truth for plan definitions and entitlements.
// All limits are enforced at the service layer.

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

const FREE_ENTITLEMENTS: PlanEntitlements = {
  maxPasteSizeBytes: 512 * KB,
  maxRawUploadSizeBytes: 1 * MB,
  maxActiveApiTokens: 5,
  maxPersonalActivePastes: 500,
  maxPersonalStorageBytes: 100 * MB,
  maxWorkspacesOwned: 2,
  maxWorkspaceMembers: 5,
  maxWorkspaceStorageBytes: 100 * MB,
  workspaceFeaturesEnabled: true,
  maxExpirationSeconds: 30 * 24 * 60 * 60, // 30 days
};

const PRO_ENTITLEMENTS: PlanEntitlements = {
  maxPasteSizeBytes: 5 * MB,
  maxRawUploadSizeBytes: 10 * MB,
  maxActiveApiTokens: 25,
  maxPersonalActivePastes: 5000,
  maxPersonalStorageBytes: 5 * GB,
  maxWorkspacesOwned: 10,
  maxWorkspaceMembers: 25,
  maxWorkspaceStorageBytes: 5 * GB,
  workspaceFeaturesEnabled: true,
  maxExpirationSeconds: null, // unlimited
};

const TEAM_ENTITLEMENTS: PlanEntitlements = {
  maxPasteSizeBytes: 10 * MB,
  maxRawUploadSizeBytes: 25 * MB,
  maxActiveApiTokens: 50,
  maxPersonalActivePastes: 25000,
  maxPersonalStorageBytes: 25 * GB,
  maxWorkspacesOwned: 50,
  maxWorkspaceMembers: 100,
  maxWorkspaceStorageBytes: 25 * GB,
  workspaceFeaturesEnabled: true,
  maxExpirationSeconds: null, // unlimited
};

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'For individuals getting started',
    entitlements: FREE_ENTITLEMENTS,
    stripePriceId: null,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For power users and professionals',
    entitlements: PRO_ENTITLEMENTS,
    stripePriceId: process.env['STRIPE_PRO_PRICE_ID'] ?? '',
  },
  team: {
    id: 'team',
    name: 'Team',
    description: 'For teams and organizations',
    entitlements: TEAM_ENTITLEMENTS,
    stripePriceId: process.env['STRIPE_TEAM_PRICE_ID'] ?? '',
  },
};

/**
 * Resolve entitlements for a given plan ID.
 * Falls back to free if the plan is unknown.
 */
export function getEntitlements(planId: string): PlanEntitlements {
  const plan = PLAN_CATALOG[planId as PlanId];
  return plan?.entitlements ?? FREE_ENTITLEMENTS;
}

/**
 * Resolve the effective plan for a subscription status.
 * Past-due/canceled/unpaid users get free-tier entitlements.
 */
export function getEffectiveEntitlements(
  planId: string,
  status: string,
  currentPeriodEnd?: Date | null,
): PlanEntitlements {
  // Active or trialing → full plan entitlements
  if (status === 'ACTIVE' || status === 'TRIALING') {
    return getEntitlements(planId);
  }

  // Cancel at period end → keep access until period ends
  if (status === 'CANCELED' && currentPeriodEnd && currentPeriodEnd > new Date()) {
    return getEntitlements(planId);
  }

  // Past due gets a grace: keep access for now
  if (status === 'PAST_DUE') {
    return getEntitlements(planId);
  }

  // All other states → free entitlements
  return FREE_ENTITLEMENTS;
}

export function getPlanById(planId: string): PlanDefinition | undefined {
  return PLAN_CATALOG[planId as PlanId];
}

export function getAllPlans(): PlanDefinition[] {
  return Object.values(PLAN_CATALOG);
}
