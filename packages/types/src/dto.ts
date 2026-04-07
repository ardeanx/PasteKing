import type {
  PasteMode,
  PasteVisibility,
  PasteStatus,
  WorkspaceRole,
  InviteStatus,
  PlatformRole,
  UserStatus,
  ModerationStatus,
  ReportReason,
  ReportStatus,
  ModerationAction,
  AbuseFlagType,
  SubscriptionStatus,
  PlanId,
} from './enums';

// ─── Auth DTOs ───────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  username: string;
  platformRole: PlatformRole;
  status: UserStatus;
  createdAt: string;
}

export interface AuthTokenResponse {
  id: string;
  token: string;
  prefix: string;
  name: string;
  scopes: string[];
  createdAt: string;
}

export interface ApiTokenListItem {
  id: string;
  prefix: string;
  name: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

// ─── Paste DTOs ──────────────────────────────────────────────────────────────

export interface CreatePasteInput {
  title?: string;
  content: string;
  mode: PasteMode;
  visibility: PasteVisibility;
  language?: string;
  burnAfterRead: boolean;
  expiresIn?: number; // seconds from now
  encrypted?: boolean;
  encryptionIv?: string; // base64-encoded IV
  encryptionVersion?: number; // algorithm version (1 = AES-256-GCM)
}

export interface UpdatePasteInput {
  title?: string;
  content: string;
  language?: string;
}

export interface PasteResponse {
  id: string;
  title: string | null;
  mode: PasteMode;
  visibility: PasteVisibility;
  status: PasteStatus;
  moderationStatus: ModerationStatus;
  language: string | null;
  encrypted: boolean;
  encryptionIv: string | null;
  encryptionVersion: number | null;
  burnAfterRead: boolean;
  expiresAt: string | null;
  currentRevision: number;
  authorId: string | null;
  workspaceId: string | null;
  forkedFromId: string | null;
  viewCount: number;
  deleteReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PasteDetailResponse extends PasteResponse {
  content: string;
}

export interface PasteCreateResponse extends PasteDetailResponse {
  deleteToken: string | null;
  warnings?: SecretWarning[];
}

export interface PasteListItem {
  id: string;
  title: string | null;
  mode: PasteMode;
  visibility: PasteVisibility;
  status: PasteStatus;
  language: string | null;
  burnAfterRead: boolean;
  encrypted: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface RevisionResponse {
  id: string;
  revisionNumber: number;
  contentHash: string | null;
  createdAt: string;
}

export interface RevisionDetailResponse extends RevisionResponse {
  content: string;
}

export interface RevisionDiffResponse {
  pasteId: string;
  from: number;
  to: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export interface RawPasteResponse {
  id: string;
  url: string;
  raw_url: string;
  expires_at: string | null;
}

// ─── Secret Warning DTOs ─────────────────────────────────────────────────────

export interface SecretWarning {
  type: string;
  description: string;
  line: number;
}

// ─── Generic API DTOs ────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  version: string;
}

// ─── Workspace DTOs ──────────────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  slug?: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDetailResponse extends WorkspaceResponse {
  memberCount: number;
  role: WorkspaceRole;
}

export interface WorkspaceMemberResponse {
  id: string;
  userId: string;
  username: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface CreateInviteInput {
  email: string;
  role?: WorkspaceRole;
}

export interface WorkspaceInviteResponse {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: InviteStatus;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface UpdateMemberRoleInput {
  role: WorkspaceRole;
}

export interface WorkspaceAuditLogResponse {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface WorkspacePasteListItem extends PasteListItem {
  authorUsername: string | null;
  workspaceId: string;
}

// ─── Report DTOs ─────────────────────────────────────────────────────────────

export interface CreateReportInput {
  pasteId: string;
  reason: ReportReason;
  description?: string;
}

export interface ReportResponse {
  id: string;
  pasteId: string;
  reporterId: string | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReportResponse extends ReportResponse {
  reporterUsername: string | null;
  pasteTitle: string | null;
  pasteEncrypted: boolean;
  pasteModerationStatus: ModerationStatus;
  pasteAuthorId: string | null;
}

export interface UpdateReportStatusInput {
  status: ReportStatus;
  reviewNote?: string;
}

// ─── Admin / Moderation DTOs ─────────────────────────────────────────────────

export interface AdminPasteModerationResponse {
  id: string;
  title: string | null;
  mode: PasteMode;
  visibility: PasteVisibility;
  status: PasteStatus;
  moderationStatus: ModerationStatus;
  encrypted: boolean;
  authorId: string | null;
  authorUsername: string | null;
  workspaceId: string | null;
  reportCount: number;
  flagCount: number;
  createdAt: string;
}

export interface ModerationActionInput {
  action: ModerationAction;
  reason?: string;
}

export interface AdminUserResponse {
  id: string;
  email: string;
  username: string;
  platformRole: PlatformRole;
  status: UserStatus;
  pasteCount: number;
  reportCount: number;
  createdAt: string;
}

export interface UpdateUserStatusInput {
  status: UserStatus;
  reason?: string;
}

export interface AbuseFlagResponse {
  id: string;
  type: AbuseFlagType;
  severity: string;
  pasteId: string | null;
  userId: string | null;
  metadata: unknown;
  resolved: boolean;
  createdAt: string;
}

export interface ModerationAuditLogResponse {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
}

// ─── Search DTOs ─────────────────────────────────────────────────────────────

export interface SearchPastesInput {
  q: string;
  limit?: number;
  offset?: number;
  language?: string;
  mode?: PasteMode;
}

export interface SearchResultItem {
  id: string;
  title: string | null;
  mode: PasteMode;
  visibility: PasteVisibility;
  language: string | null;
  authorId: string | null;
  headline: string | null;
  createdAt: string;
}

export interface PaginatedSearchResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdminPasteListInput {
  q?: string;
  status?: string;
  moderationStatus?: string;
  visibility?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
}

// ─── Analytics DTOs ──────────────────────────────────────────────────────────

export interface PasteAnalyticsResponse {
  pasteId: string;
  totalViews: number;
  last24h: number;
  last7d: number;
  last30d: number;
}

export interface UserAnalyticsResponse {
  totalPastes: number;
  totalViews: number;
  totalForks: number;
}

// ─── OAuth DTOs ──────────────────────────────────────────────────────────────

export type OAuthProvider = 'github' | 'google';

// ─── Billing & Quota DTOs ────────────────────────────────────────────────────

export interface PlanEntitlements {
  maxPasteSizeBytes: number;
  maxRawUploadSizeBytes: number;
  maxActiveApiTokens: number;
  maxPersonalActivePastes: number;
  maxPersonalStorageBytes: number;
  maxWorkspacesOwned: number;
  maxWorkspaceMembers: number;
  maxWorkspaceStorageBytes: number;
  workspaceFeaturesEnabled: boolean;
  maxExpirationSeconds: number | null; // null = unlimited
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  entitlements: PlanEntitlements;
  stripePriceId: string | null; // null for free plan
}

export interface SubscriptionResponse {
  planId: PlanId;
  planName: string;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  entitlements: PlanEntitlements;
}

export interface UsageResponse {
  personalStorageBytes: number;
  personalActivePastes: number;
  activeApiTokens: number;
  workspacesOwned: number;
}

export interface WorkspaceUsageResponse {
  storageBytes: number;
  activePastes: number;
  memberCount: number;
}

export interface BillingStatusResponse {
  subscription: SubscriptionResponse;
  usage: UsageResponse;
}

export interface WorkspaceBillingStatusResponse {
  subscription: SubscriptionResponse;
  usage: WorkspaceUsageResponse;
}

export interface CheckoutSessionResponse {
  url: string;
}

export interface PortalSessionResponse {
  url: string;
}

export interface QuotaErrorDetail {
  quotaName: string;
  currentUsage: number;
  limit: number;
  planId: PlanId;
}

export interface AdminBillingSummary {
  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  stripeCustomerId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

// ─── SEO DTOs ────────────────────────────────────────────────────────────────

export interface SeoSettingsResponse {
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  seoAuthor: string | null;
  seoCanonicalUrl: string | null;
  ogImageUrl: string | null;
  twitterHandle: string | null;
  facebookAppId: string | null;
  siteSchemaType: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export interface UpdateSeoSettingsInput {
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
}
