export const PasteMode = {
  CODE: 'CODE',
  TEXT: 'TEXT',
  LOG: 'LOG',
  MARKDOWN: 'MARKDOWN',
} as const;

export type PasteMode = (typeof PasteMode)[keyof typeof PasteMode];

export const PasteVisibility = {
  PUBLIC: 'PUBLIC',
  UNLISTED: 'UNLISTED',
  PRIVATE: 'PRIVATE',
} as const;

export type PasteVisibility = (typeof PasteVisibility)[keyof typeof PasteVisibility];

export const PasteStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  BURNED: 'BURNED',
  DELETED: 'DELETED',
} as const;

export type PasteStatus = (typeof PasteStatus)[keyof typeof PasteStatus];

export const WorkspaceRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const InviteStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;

export type InviteStatus = (typeof InviteStatus)[keyof typeof InviteStatus];

// ─── Platform Admin & Moderation ─────────────────────────────────────────────

export const PlatformRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  RESTRICTED: 'RESTRICTED',
  SUSPENDED: 'SUSPENDED',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ModerationStatus = {
  NONE: 'NONE',
  PENDING_REVIEW: 'PENDING_REVIEW',
  HIDDEN: 'HIDDEN',
  DISABLED: 'DISABLED',
  REMOVED: 'REMOVED',
} as const;

export type ModerationStatus = (typeof ModerationStatus)[keyof typeof ModerationStatus];

export const ReportReason = {
  SPAM: 'SPAM',
  MALWARE_OR_PHISHING: 'MALWARE_OR_PHISHING',
  CREDENTIAL_OR_SECRET_EXPOSURE: 'CREDENTIAL_OR_SECRET_EXPOSURE',
  ILLEGAL_OR_HARMFUL_CONTENT: 'ILLEGAL_OR_HARMFUL_CONTENT',
  HARASSMENT_OR_ABUSE: 'HARASSMENT_OR_ABUSE',
  COPYRIGHT_OR_SENSITIVE_MATERIAL: 'COPYRIGHT_OR_SENSITIVE_MATERIAL',
  OTHER: 'OTHER',
} as const;

export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const ReportStatus = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED_NO_ACTION: 'RESOLVED_NO_ACTION',
  RESOLVED_CONTENT_REMOVED: 'RESOLVED_CONTENT_REMOVED',
  RESOLVED_USER_ACTION: 'RESOLVED_USER_ACTION',
  REJECTED: 'REJECTED',
} as const;

export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const ModerationAction = {
  NO_ACTION: 'NO_ACTION',
  HIDE_CONTENT: 'HIDE_CONTENT',
  DISABLE_ACCESS: 'DISABLE_ACCESS',
  DELETE_CONTENT: 'DELETE_CONTENT',
} as const;

export type ModerationAction = (typeof ModerationAction)[keyof typeof ModerationAction];

export const AbuseFlagType = {
  SECRET_DETECTED: 'SECRET_DETECTED',
  EXCESSIVE_PASTE_RATE: 'EXCESSIVE_PASTE_RATE',
  REPEATED_REPORTS: 'REPEATED_REPORTS',
  SPAM_HEURISTIC: 'SPAM_HEURISTIC',
} as const;

export type AbuseFlagType = (typeof AbuseFlagType)[keyof typeof AbuseFlagType];

// ─── Billing & Plans ─────────────────────────────────────────────────────────

export const SubscriptionStatus = {
  FREE: 'FREE',
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
  INCOMPLETE: 'INCOMPLETE',
  UNPAID: 'UNPAID',
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PlanId = {
  FREE: 'free',
  PRO: 'pro',
  TEAM: 'team',
} as const;

export type PlanId = (typeof PlanId)[keyof typeof PlanId];
