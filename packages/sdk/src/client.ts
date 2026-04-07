import type {
  RegisterInput,
  LoginInput,
  AuthUserResponse,
  AuthTokenResponse,
  ApiTokenListItem,
  CreatePasteInput,
  UpdatePasteInput,
  PasteDetailResponse,
  PasteCreateResponse,
  PasteListItem,
  RevisionResponse,
  RawPasteResponse,
  ApiResponse,
  HealthResponse,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceDetailResponse,
  WorkspaceResponse,
  WorkspaceMemberResponse,
  CreateInviteInput,
  WorkspaceInviteResponse,
  UpdateMemberRoleInput,
  WorkspaceAuditLogResponse,
  WorkspacePasteListItem,
  CreateReportInput,
  ReportResponse,
  AdminReportResponse,
  UpdateReportStatusInput,
  AdminPasteModerationResponse,
  ModerationActionInput,
  AdminUserResponse,
  UpdateUserStatusInput,
  AbuseFlagResponse,
  ModerationAuditLogResponse,
  SearchResultItem,
  PaginatedSearchResponse,
  RevisionDiffResponse,
  PasteAnalyticsResponse,
  UserAnalyticsResponse,
  PlanDefinition,
  BillingStatusResponse,
  WorkspaceBillingStatusResponse,
  CheckoutSessionResponse,
  PortalSessionResponse,
  AdminBillingSummary,
} from '@pasteking/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class PasteKingClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, opts?: { token?: string; cookie?: string }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = {};
    if (opts?.token) {
      this.headers['Authorization'] = `Bearer ${opts.token}`;
    }
    if (opts?.cookie) {
      this.headers['Cookie'] = opts.cookie;
    }
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
        ...options?.headers,
      },
    });

    if (res.status === 204) {
      return undefined as unknown as T;
    }

    const body = await res.json();

    if (!res.ok) {
      throw new ApiError(
        res.status,
        body?.error?.code ?? 'UNKNOWN_ERROR',
        body?.error?.message ?? 'An unknown error occurred',
      );
    }

    return body as T;
  }

  // ─── Health ────────────────────────────────────────────────────────────

  async health(): Promise<ApiResponse<HealthResponse>> {
    return this.request('/health');
  }

  // ─── Auth ──────────────────────────────────────────────────────────────

  async register(input: RegisterInput): Promise<ApiResponse<AuthUserResponse>> {
    return this.request('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async login(input: LoginInput): Promise<ApiResponse<AuthUserResponse>> {
    return this.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async logout(): Promise<void> {
    await this.request('/v1/auth/logout', { method: 'POST' });
  }

  async getMe(): Promise<ApiResponse<AuthUserResponse>> {
    return this.request('/v1/auth/me');
  }

  // ─── API Tokens ────────────────────────────────────────────────────────

  async createApiToken(
    name: string,
    scopes: string[] = [],
  ): Promise<ApiResponse<AuthTokenResponse>> {
    return this.request('/v1/auth/tokens', {
      method: 'POST',
      body: JSON.stringify({ name, scopes }),
    });
  }

  async listApiTokens(): Promise<ApiResponse<ApiTokenListItem[]>> {
    return this.request('/v1/auth/tokens');
  }

  async revokeApiToken(id: string): Promise<void> {
    await this.request(`/v1/auth/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ─── Pastes ────────────────────────────────────────────────────────────

  async createPaste(input: CreatePasteInput): Promise<ApiResponse<PasteCreateResponse>> {
    return this.request('/v1/pastes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getPaste(id: string): Promise<ApiResponse<PasteDetailResponse>> {
    return this.request(`/v1/pastes/${encodeURIComponent(id)}`);
  }

  async getPasteRaw(id: string): Promise<string> {
    const url = `${this.baseUrl}/v1/pastes/${encodeURIComponent(id)}/raw`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(
        res.status,
        body?.error?.code ?? 'UNKNOWN_ERROR',
        body?.error?.message ?? 'An unknown error occurred',
      );
    }
    return res.text();
  }

  async updatePaste(
    id: string,
    input: UpdatePasteInput,
  ): Promise<ApiResponse<PasteDetailResponse>> {
    return this.request(`/v1/pastes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async deletePaste(id: string, deleteToken?: string): Promise<void> {
    const url = `${this.baseUrl}/v1/pastes/${encodeURIComponent(id)}`;
    const headers: Record<string, string> = { ...this.headers };
    if (deleteToken) {
      headers['x-delete-token'] = deleteToken;
    }
    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(
        res.status,
        body?.error?.code ?? 'UNKNOWN_ERROR',
        body?.error?.message ?? 'An unknown error occurred',
      );
    }
  }

  async getRevisions(id: string): Promise<ApiResponse<RevisionResponse[]>> {
    return this.request(`/v1/pastes/${encodeURIComponent(id)}/revisions`);
  }

  async listMyPastes(): Promise<ApiResponse<PasteListItem[]>> {
    return this.request('/v1/pastes/mine');
  }

  async createRawPaste(
    content: string,
    options?: {
      mode?: string;
      visibility?: string;
      expiresIn?: number;
      burnAfterRead?: boolean;
      title?: string;
      language?: string;
    },
  ): Promise<ApiResponse<RawPasteResponse>> {
    const params = new URLSearchParams();
    if (options?.mode) params.set('mode', options.mode);
    if (options?.visibility) params.set('visibility', options.visibility);
    if (options?.expiresIn) params.set('expiresIn', String(options.expiresIn));
    if (options?.burnAfterRead) params.set('burnAfterRead', 'true');
    if (options?.title) params.set('title', options.title);
    if (options?.language) params.set('language', options.language);
    const qs = params.toString();
    const url = `${this.baseUrl}/v1/pastes/raw${qs ? '?' + qs : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', ...this.headers },
      body: content,
    });

    const body = await res.json();

    if (!res.ok) {
      throw new ApiError(
        res.status,
        body?.error?.code ?? 'UNKNOWN_ERROR',
        body?.error?.message ?? 'An unknown error occurred',
      );
    }

    return body as ApiResponse<RawPasteResponse>;
  }

  // ─── Workspaces ────────────────────────────────────────────────────────

  async createWorkspace(input: CreateWorkspaceInput): Promise<ApiResponse<WorkspaceResponse>> {
    return this.request('/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listMyWorkspaces(): Promise<ApiResponse<WorkspaceDetailResponse[]>> {
    return this.request('/v1/workspaces');
  }

  async getWorkspace(id: string): Promise<ApiResponse<WorkspaceDetailResponse>> {
    return this.request(`/v1/workspaces/${encodeURIComponent(id)}`);
  }

  async updateWorkspace(
    id: string,
    input: UpdateWorkspaceInput,
  ): Promise<ApiResponse<WorkspaceResponse>> {
    return this.request(`/v1/workspaces/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.request(`/v1/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ─── Workspace Invites ─────────────────────────────────────────────────

  async createInvite(
    workspaceId: string,
    input: CreateInviteInput,
  ): Promise<ApiResponse<WorkspaceInviteResponse>> {
    return this.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/invites`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listInvites(workspaceId: string): Promise<ApiResponse<WorkspaceInviteResponse[]>> {
    return this.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/invites`);
  }

  async listMyInvites(): Promise<ApiResponse<WorkspaceInviteResponse[]>> {
    return this.request('/v1/workspaces/invites/mine');
  }

  async acceptInvite(workspaceId: string, inviteId: string): Promise<void> {
    await this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/invites/${encodeURIComponent(inviteId)}/accept`,
      { method: 'POST' },
    );
  }

  async declineInvite(workspaceId: string, inviteId: string): Promise<void> {
    await this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/invites/${encodeURIComponent(inviteId)}/decline`,
      { method: 'POST' },
    );
  }

  async revokeInvite(workspaceId: string, inviteId: string): Promise<void> {
    await this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/invites/${encodeURIComponent(inviteId)}`,
      { method: 'DELETE' },
    );
  }

  // ─── Workspace Members ─────────────────────────────────────────────────

  async listMembers(workspaceId: string): Promise<ApiResponse<WorkspaceMemberResponse[]>> {
    return this.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/members`);
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<ApiResponse<WorkspaceMemberResponse>> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
  }

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    await this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`,
      { method: 'DELETE' },
    );
  }

  // ─── Workspace Pastes ──────────────────────────────────────────────────

  async listWorkspacePastes(workspaceId: string): Promise<ApiResponse<WorkspacePasteListItem[]>> {
    return this.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/pastes`);
  }

  async createWorkspacePaste(
    workspaceId: string,
    input: CreatePasteInput,
  ): Promise<ApiResponse<PasteCreateResponse>> {
    return this.request('/v1/pastes', {
      method: 'POST',
      body: JSON.stringify({ ...input, workspaceId }),
    });
  }

  // ─── Workspace Audit Logs ──────────────────────────────────────────────

  async listWorkspaceAuditLogs(
    workspaceId: string,
  ): Promise<ApiResponse<WorkspaceAuditLogResponse[]>> {
    return this.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/audit-logs`);
  }

  // ─── Reports (user-facing) ────────────────────────────────────────────

  async createReport(input: CreateReportInput): Promise<ApiResponse<ReportResponse>> {
    return this.request('/v1/reports', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // ─── Admin: Reports ──────────────────────────────────────────────────

  async adminListReports(filters?: {
    status?: string;
    reason?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<AdminReportResponse[]> & { total?: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.reason) params.set('reason', filters.reason);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return this.request(`/v1/admin/reports${qs ? '?' + qs : ''}`);
  }

  async adminGetReport(id: string): Promise<ApiResponse<AdminReportResponse>> {
    return this.request(`/v1/admin/reports/${encodeURIComponent(id)}`);
  }

  async adminUpdateReportStatus(
    id: string,
    input: UpdateReportStatusInput,
  ): Promise<ApiResponse<ReportResponse>> {
    return this.request(`/v1/admin/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  // ─── Admin: Paste Moderation ─────────────────────────────────────────

  async adminGetPasteModeration(
    pasteId: string,
  ): Promise<ApiResponse<AdminPasteModerationResponse>> {
    return this.request(`/v1/admin/pastes/${encodeURIComponent(pasteId)}/moderation`);
  }

  async adminTakeModerationAction(
    pasteId: string,
    input: ModerationActionInput,
  ): Promise<ApiResponse<AdminPasteModerationResponse>> {
    return this.request(`/v1/admin/pastes/${encodeURIComponent(pasteId)}/actions`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // ─── Admin: Users ────────────────────────────────────────────────────

  async adminListUsers(filters?: {
    status?: string;
    platformRole?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<AdminUserResponse[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.platformRole) params.set('platformRole', filters.platformRole);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return this.request(`/v1/admin/users${qs ? '?' + qs : ''}`);
  }

  async adminGetUser(id: string): Promise<ApiResponse<AdminUserResponse>> {
    return this.request(`/v1/admin/users/${encodeURIComponent(id)}`);
  }

  async adminUpdateUserStatus(
    id: string,
    input: UpdateUserStatusInput,
  ): Promise<ApiResponse<AdminUserResponse>> {
    return this.request(`/v1/admin/users/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  // ─── Admin: Abuse Flags ──────────────────────────────────────────────

  async adminListAbuseFlags(filters?: {
    type?: string;
    resolved?: boolean;
    pasteId?: string;
    userId?: string;
  }): Promise<ApiResponse<AbuseFlagResponse[]>> {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.resolved !== undefined) params.set('resolved', String(filters.resolved));
    if (filters?.pasteId) params.set('pasteId', filters.pasteId);
    if (filters?.userId) params.set('userId', filters.userId);
    const qs = params.toString();
    return this.request(`/v1/admin/flags${qs ? '?' + qs : ''}`);
  }

  // ─── Admin: Moderation Audit Logs ──────────────────────────────────────

  async adminListAuditLogs(filters?: {
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ModerationAuditLogResponse[]>> {
    const params = new URLSearchParams();
    if (filters?.entityType) params.set('entityType', filters.entityType);
    if (filters?.entityId) params.set('entityId', filters.entityId);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return this.request(`/v1/admin/audit-logs${qs ? '?' + qs : ''}`);
  }

  // ─── Search ────────────────────────────────────────────────────────────

  async searchPastes(
    q: string,
    limit?: number,
    offset?: number,
  ): Promise<ApiResponse<SearchResultItem[]>> {
    const params = new URLSearchParams({ q });
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    return this.request(`/v1/pastes/search?${params.toString()}`);
  }

  async searchMyPastes(
    q: string,
    opts?: { limit?: number; offset?: number; language?: string; mode?: string },
  ): Promise<ApiResponse<PaginatedSearchResponse<SearchResultItem>>> {
    const params = new URLSearchParams({ q });
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    if (opts?.language) params.set('language', opts.language);
    if (opts?.mode) params.set('mode', opts.mode);
    return this.request(`/v1/pastes/search/mine?${params.toString()}`);
  }

  async searchWorkspacePastes(
    workspaceId: string,
    q: string,
    opts?: { limit?: number; offset?: number; language?: string; mode?: string },
  ): Promise<
    ApiResponse<PaginatedSearchResponse<SearchResultItem & { authorUsername: string | null }>>
  > {
    const params = new URLSearchParams({ q });
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    if (opts?.language) params.set('language', opts.language);
    if (opts?.mode) params.set('mode', opts.mode);
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/search/pastes?${params.toString()}`,
    );
  }

  async adminSearchPastes(filters?: {
    q?: string;
    status?: string;
    moderationStatus?: string;
    visibility?: string;
    authorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<PaginatedSearchResponse<AdminPasteModerationResponse>>> {
    const params = new URLSearchParams();
    if (filters?.q) params.set('q', filters.q);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.moderationStatus) params.set('moderationStatus', filters.moderationStatus);
    if (filters?.visibility) params.set('visibility', filters.visibility);
    if (filters?.authorId) params.set('authorId', filters.authorId);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return this.request(`/v1/admin/pastes/search${qs ? '?' + qs : ''}`);
  }

  // ─── Fork ──────────────────────────────────────────────────────────────

  async forkPaste(id: string): Promise<ApiResponse<PasteCreateResponse>> {
    return this.request(`/v1/pastes/${encodeURIComponent(id)}/fork`, { method: 'POST' });
  }

  // ─── Revision Diff ─────────────────────────────────────────────────────

  async getRevisionDiff(
    id: string,
    from: number,
    to: number,
  ): Promise<ApiResponse<RevisionDiffResponse>> {
    return this.request(`/v1/pastes/${encodeURIComponent(id)}/revisions/${from}/diff/${to}`);
  }

  // ─── Analytics ─────────────────────────────────────────────────────────

  async getPasteAnalytics(id: string): Promise<ApiResponse<PasteAnalyticsResponse>> {
    return this.request(`/v1/pastes/${encodeURIComponent(id)}/analytics`);
  }

  async getUserAnalytics(): Promise<ApiResponse<UserAnalyticsResponse>> {
    return this.request('/v1/pastes/analytics/me');
  }

  // ─── Billing ─────────────────────────────────────────────────────────

  async getPlans(): Promise<ApiResponse<PlanDefinition[]>> {
    return this.request('/v1/billing/plans');
  }

  async getBillingStatus(): Promise<ApiResponse<BillingStatusResponse>> {
    return this.request('/v1/billing/status');
  }

  async createCheckoutSession(planId: string): Promise<ApiResponse<CheckoutSessionResponse>> {
    return this.request('/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }

  async createPortalSession(): Promise<ApiResponse<PortalSessionResponse>> {
    return this.request('/v1/billing/portal', { method: 'POST' });
  }

  async getWorkspaceBillingStatus(
    workspaceId: string,
  ): Promise<ApiResponse<WorkspaceBillingStatusResponse>> {
    return this.request(`/v1/billing/workspaces/${encodeURIComponent(workspaceId)}/status`);
  }

  async createWorkspaceCheckoutSession(
    workspaceId: string,
    planId: string,
  ): Promise<ApiResponse<CheckoutSessionResponse>> {
    return this.request(`/v1/billing/workspaces/${encodeURIComponent(workspaceId)}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }

  async createWorkspacePortalSession(
    workspaceId: string,
  ): Promise<ApiResponse<PortalSessionResponse>> {
    return this.request(`/v1/billing/workspaces/${encodeURIComponent(workspaceId)}/portal`, {
      method: 'POST',
    });
  }

  async adminGetUserBilling(userId: string): Promise<ApiResponse<AdminBillingSummary>> {
    return this.request(`/v1/billing/admin/users/${encodeURIComponent(userId)}`);
  }

  async adminGetWorkspaceBilling(workspaceId: string): Promise<ApiResponse<AdminBillingSummary>> {
    return this.request(`/v1/billing/admin/workspaces/${encodeURIComponent(workspaceId)}`);
  }
}
