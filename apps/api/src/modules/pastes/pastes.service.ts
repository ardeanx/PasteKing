import type {
  PasteDetailResponse,
  PasteCreateResponse,
  PasteListItem,
  RevisionResponse,
  RawPasteResponse,
  SearchResultItem,
  PaginatedSearchResponse,
  PasteAnalyticsResponse,
  UserAnalyticsResponse,
  RevisionDiffResponse,
  AdminPasteModerationResponse,
} from '@pasteking/types';
import type { CreatePasteSchema, UpdatePasteSchema } from '@pasteking/validation';
import { sha256, generateId } from '@pasteking/crypto';
import { scanForSecrets } from '@pasteking/validation';
import { AppError, NotFoundError } from '../../middleware';
import { enqueueExpiration } from '../../queues';
import { getStorage } from '../../storage';
import { logger } from '../../logger';
import { PastesRepository } from './pastes.repository';
import type { PasteWithContent, PasteRevisionRow } from './pastes.types';

export interface RawPasteOptions {
  mode?: string;
  visibility?: string;
  expiresIn?: number;
  burnAfterRead?: boolean;
  title?: string;
  language?: string;
}

export class PastesService {
  private repository: PastesRepository;

  constructor() {
    this.repository = new PastesRepository();
  }

  async createPaste(
    input: CreatePasteSchema,
    authorId?: string,
    workspaceId?: string,
  ): Promise<PasteCreateResponse> {
    // Encrypted pastes cannot be workspace-owned
    if (workspaceId && input.encrypted) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Encrypted pastes cannot be assigned to a workspace. Encrypted pastes remain personal/share-link based.',
      );
    }

    const expiresAt = input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000) : null;

    // Generate anonymous delete token
    const deleteToken = generateId(32);
    const deleteTokenHash = sha256(deleteToken);

    // Storage decision
    const storage = getStorage();
    const storageKey = `pastes/${generateId(24)}`;
    const decision = await storage.store(storageKey, input.content);

    const paste = await this.repository.create({
      title: input.title,
      content: decision.dbContent ?? input.content,
      mode: input.mode,
      visibility: input.visibility,
      language: input.language,
      burnAfterRead: input.burnAfterRead ?? false,
      expiresAt,
      deleteTokenHash,
      authorId,
      workspaceId,
      contentRef: decision.contentRef,
      encrypted: input.encrypted ?? false,
      encryptionIv: input.encryptionIv ?? null,
      encryptionVersion: input.encryptionVersion ?? null,
    });

    // Enqueue expiration job if expiresAt is set
    if (input.expiresIn && expiresAt) {
      enqueueExpiration(paste.id, input.expiresIn * 1000).catch(() => {});
    }

    const content = await this.resolveContent(paste);

    // Scan non-encrypted pastes for secrets
    const warnings = !input.encrypted ? scanForSecrets(input.content) : [];

    logger.info(
      {
        event: 'paste_created',
        pasteId: paste.id,
        mode: input.mode,
        visibility: input.visibility,
        encrypted: !!input.encrypted,
        burnAfterRead: !!input.burnAfterRead,
        contentLength: input.content.length,
        secretWarnings: warnings.length,
        hasExpiration: !!input.expiresIn,
        authorId: authorId ?? null,
      },
      'Paste created',
    );

    return {
      ...this.toDetailResponse(paste, content),
      deleteToken,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  async getPaste(id: string, viewerIpHash?: string): Promise<PasteDetailResponse> {
    const paste = await this.repository.findById(id);
    if (!paste) throw new NotFoundError('Paste', id);

    // Deleted pastes: return stub with delete reason instead of 404
    if (paste.status === 'DELETED') {
      return this.toDetailResponse(paste, '', 0);
    }

    // All other inactive states still 404
    if (paste.status === 'EXPIRED' || paste.status === 'BURNED') {
      throw new NotFoundError('Paste', id);
    }
    if (paste.expiresAt && paste.expiresAt < new Date()) {
      throw new NotFoundError('Paste', id);
    }
    if (
      paste.moderationStatus === 'HIDDEN' ||
      paste.moderationStatus === 'DISABLED' ||
      paste.moderationStatus === 'REMOVED'
    ) {
      throw new NotFoundError('Paste', id);
    }

    const content = await this.resolveContent(paste);

    // Record view (async, non-blocking)
    this.repository.recordView(id, viewerIpHash).catch(() => {});

    // Handle burn after read
    if (paste.burnAfterRead) {
      await this.repository.markBurned(id);
      await getStorage().remove(paste.contentRef);
    }

    const viewCount = await this.repository.countViews(id);
    return this.toDetailResponse(paste, content, viewCount);
  }

  async getPasteRaw(id: string): Promise<string> {
    const paste = await this.findActivePaste(id);

    if (paste.encrypted) {
      throw new AppError(400, 'BAD_REQUEST', 'Raw endpoint is not available for encrypted pastes');
    }

    const content = await this.resolveContent(paste);

    // Handle burn after read
    if (paste.burnAfterRead) {
      await this.repository.markBurned(id);
      await getStorage().remove(paste.contentRef);
    }

    return content;
  }

  async updatePaste(
    id: string,
    input: UpdatePasteSchema,
    userId?: string,
  ): Promise<PasteDetailResponse> {
    const paste = await this.findActivePaste(id);

    this.assertCanModify(paste, userId);

    if (paste.encrypted) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot update an encrypted paste');
    }

    if (paste.burnAfterRead) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot update a burn-after-read paste');
    }

    // Remove old object storage content if present
    const oldContentRef = paste.contentRef;

    // Storage decision for new content
    const storage = getStorage();
    const storageKey = `pastes/${generateId(24)}`;
    const decision = await storage.store(storageKey, input.content);

    const newRevision = paste.currentRevision + 1;
    const updated = await this.repository.update(
      id,
      {
        title: input.title,
        content: decision.dbContent ?? input.content,
        language: input.language,
        contentRef: decision.contentRef,
      },
      newRevision,
    );

    // Clean up old object storage content
    if (oldContentRef) {
      await storage.remove(oldContentRef);
    }

    const content = await this.resolveContent(updated);
    return this.toDetailResponse(updated, content);
  }

  async deletePaste(
    id: string,
    deleteToken: string | undefined,
    userId?: string,
    workspaceOverride?: boolean,
  ): Promise<void> {
    const paste = await this.repository.findById(id);

    if (!paste || paste.status === 'DELETED') {
      throw new NotFoundError('Paste', id);
    }

    // Workspace admin/owner override
    if (workspaceOverride && userId) {
      await getStorage().remove(paste.contentRef);
      await this.repository.hardDelete(id);
      logger.info(
        { event: 'paste_deleted', pasteId: id, method: 'workspace_role' },
        'Paste deleted by workspace role',
      );
      return;
    }

    // Ownership check: owner can delete directly
    if (userId && paste.authorId === userId) {
      await getStorage().remove(paste.contentRef);
      await this.repository.hardDelete(id);
      logger.info(
        { event: 'paste_deleted', pasteId: id, method: 'owner' },
        'Paste deleted by owner',
      );
      return;
    }

    // Anonymous deletion via token
    if (!deleteToken) {
      throw new AppError(403, 'FORBIDDEN', 'Not authorized to delete this paste');
    }

    const tokenHash = sha256(deleteToken);
    if (paste.deleteTokenHash !== tokenHash) {
      throw new AppError(403, 'FORBIDDEN', 'Invalid delete token');
    }

    await getStorage().remove(paste.contentRef);
    await this.repository.hardDelete(id);
    logger.info({ event: 'paste_deleted', pasteId: id, method: 'token' }, 'Paste deleted by token');
  }

  async getPasteInfo(id: string) {
    return this.repository.findById(id);
  }

  async getRevisions(id: string): Promise<RevisionResponse[]> {
    await this.findActivePaste(id);

    const revisions = await this.repository.findRevisions(id);

    return revisions.map((r: PasteRevisionRow) => ({
      id: r.id,
      revisionNumber: r.revisionNumber,
      contentHash: r.contentHash,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async listByAuthor(authorId: string): Promise<PasteListItem[]> {
    const pastes = await this.repository.findByAuthor(authorId);
    return pastes.map((p) => ({
      id: p.id,
      title: p.title,
      mode: p.mode as PasteListItem['mode'],
      visibility: p.visibility as PasteListItem['visibility'],
      status: p.status as PasteListItem['status'],
      language: p.language,
      burnAfterRead: p.burnAfterRead,
      encrypted: p.encrypted,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async createRawPaste(
    content: string,
    options?: RawPasteOptions,
    authorId?: string,
    workspaceId?: string,
  ): Promise<RawPasteResponse> {
    const mode = options?.mode ?? 'TEXT';
    const visibility = options?.visibility ?? 'UNLISTED';
    const burnAfterRead = options?.burnAfterRead ?? false;
    const expiresIn = options?.expiresIn;

    const result = await this.createPaste(
      {
        content,
        title: options?.title,
        mode: mode as CreatePasteSchema['mode'],
        visibility: visibility as CreatePasteSchema['visibility'],
        language: options?.language,
        burnAfterRead,
        encrypted: false,
        ...(expiresIn ? { expiresIn } : {}),
      },
      authorId,
      workspaceId,
    );

    return {
      id: result.id,
      url: `/p/${result.id}`,
      raw_url: `/v1/pastes/${result.id}/raw`,
      expires_at: result.expiresAt,
    };
  }

  // ─── Fork ───────────────────────────────────────────────────────────────

  async forkPaste(id: string, authorId?: string): Promise<PasteCreateResponse> {
    const paste = await this.findActivePaste(id);

    if (paste.encrypted) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot fork an encrypted paste');
    }

    if (paste.burnAfterRead) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot fork a burn-after-read paste');
    }

    const content = await this.resolveContent(paste);
    const deleteToken = generateId(32);
    const deleteTokenHash = sha256(deleteToken);

    const storage = getStorage();
    const storageKey = `pastes/${generateId(24)}`;
    const decision = await storage.store(storageKey, content);

    const forked = await this.repository.create({
      title: paste.title ? `Fork of ${paste.title}` : undefined,
      content: decision.dbContent ?? content,
      mode: paste.mode as CreatePasteSchema['mode'],
      visibility: paste.visibility as CreatePasteSchema['visibility'],
      language: paste.language || undefined,
      burnAfterRead: false,
      expiresAt: null,
      deleteTokenHash,
      authorId,
      contentRef: decision.contentRef,
      encrypted: false,
      forkedFromId: id,
    });

    const resolvedContent = await this.resolveContent(forked);

    logger.info(
      {
        event: 'paste_forked',
        sourceId: id,
        forkId: forked.id,
        authorId: authorId ?? null,
      },
      'Paste forked',
    );

    return {
      ...this.toDetailResponse(forked, resolvedContent),
      deleteToken,
    };
  }

  // ─── Search ────────────────────────────────────────────────────────────

  async listRecentPublic(limit = 20): Promise<SearchResultItem[]> {
    const results = await this.repository.listRecentPublic(Math.min(limit, 50));
    return results.map((p) => ({
      id: p.id,
      title: p.title,
      mode: p.mode as SearchResultItem['mode'],
      visibility: p.visibility as SearchResultItem['visibility'],
      language: p.language,
      authorId: p.authorId,
      headline: null,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async listSitemapEntries(limit = 1000, offset = 0) {
    return this.repository.listSitemapEntries(limit, offset);
  }

  async searchPastes(query: string, limit = 20, offset = 0): Promise<SearchResultItem[]> {
    if (!query.trim()) return [];
    const results = await this.repository.searchPublic(query, Math.min(limit, 50), offset);
    return results.map((p) => ({
      id: p.id,
      title: p.title,
      mode: p.mode as SearchResultItem['mode'],
      visibility: p.visibility as SearchResultItem['visibility'],
      language: p.language,
      authorId: p.authorId,
      headline: p.headline,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  // ─── Personal Search ──────────────────────────────────────────────────

  async searchMyPastes(
    authorId: string,
    query: string,
    limit = 20,
    offset = 0,
    filters?: { language?: string; mode?: string },
  ): Promise<PaginatedSearchResponse<SearchResultItem>> {
    if (!query.trim()) return { items: [], total: 0, limit, offset, hasMore: false };

    const clampedLimit = Math.min(limit, 50);
    const { items, total } = await this.repository.searchByAuthor(
      authorId,
      query,
      clampedLimit,
      offset,
      filters,
    );

    return {
      items: items.map((p) => this.toSearchResultItem(p)),
      total,
      limit: clampedLimit,
      offset,
      hasMore: offset + clampedLimit < total,
    };
  }

  // ─── Workspace Search ─────────────────────────────────────────────────

  async searchWorkspacePastes(
    workspaceId: string,
    query: string,
    limit = 20,
    offset = 0,
    filters?: { language?: string; mode?: string },
  ): Promise<PaginatedSearchResponse<SearchResultItem & { authorUsername: string | null }>> {
    if (!query.trim()) return { items: [], total: 0, limit, offset, hasMore: false };

    const clampedLimit = Math.min(limit, 50);
    const { items, total } = await this.repository.searchByWorkspace(
      workspaceId,
      query,
      clampedLimit,
      offset,
      filters,
    );

    return {
      items: items.map((p) => ({
        ...this.toSearchResultItem(p),
        authorUsername: (p as { author_username?: string | null }).author_username ?? null,
      })),
      total,
      limit: clampedLimit,
      offset,
      hasMore: offset + clampedLimit < total,
    };
  }

  // ─── Admin Search ─────────────────────────────────────────────────────

  async adminSearchPastes(
    filters: {
      q?: string;
      status?: string;
      moderationStatus?: string;
      visibility?: string;
      authorId?: string;
    },
    limit = 20,
    offset = 0,
  ): Promise<PaginatedSearchResponse<AdminPasteModerationResponse>> {
    const clampedLimit = Math.min(limit, 50);
    const { items, total } = await this.repository.adminSearch(filters, clampedLimit, offset);

    return {
      items: items.map((p) => ({
        id: p.id,
        title: p.title,
        mode: p.mode as AdminPasteModerationResponse['mode'],
        visibility: p.visibility as AdminPasteModerationResponse['visibility'],
        status: p.status as AdminPasteModerationResponse['status'],
        moderationStatus: (p.moderationStatus ??
          'NONE') as AdminPasteModerationResponse['moderationStatus'],
        encrypted: p.encrypted,
        authorId: p.authorId,
        authorUsername: (p as { author_username?: string | null }).author_username ?? null,
        workspaceId: p.workspaceId ?? null,
        reportCount: (p as { report_count?: number }).report_count ?? 0,
        flagCount: 0,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      limit: clampedLimit,
      offset,
      hasMore: offset + clampedLimit < total,
    };
  }

  private toSearchResultItem(p: {
    id: string;
    title: string | null;
    mode: string;
    visibility: string;
    language: string | null;
    authorId: string | null;
    headline?: string | null;
    createdAt: Date;
  }): SearchResultItem {
    return {
      id: p.id,
      title: p.title,
      mode: p.mode as SearchResultItem['mode'],
      visibility: p.visibility as SearchResultItem['visibility'],
      language: p.language,
      authorId: p.authorId,
      headline: p.headline ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }

  // ─── Analytics ─────────────────────────────────────────────────────────

  async recordView(pasteId: string, ipHash?: string): Promise<void> {
    await this.repository.recordView(pasteId, ipHash);
  }

  async getPasteAnalytics(pasteId: string, userId: string): Promise<PasteAnalyticsResponse> {
    const paste = await this.repository.findById(pasteId);
    if (!paste || paste.status === 'DELETED') {
      throw new NotFoundError('Paste', pasteId);
    }
    if (paste.authorId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the paste owner can view analytics');
    }

    const now = new Date();
    const [totalViews, last24h, last7d, last30d] = await Promise.all([
      this.repository.countViews(pasteId),
      this.repository.countViewsSince(pasteId, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      this.repository.countViewsSince(pasteId, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
      this.repository.countViewsSince(pasteId, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    ]);

    return { pasteId, totalViews, last24h, last7d, last30d };
  }

  async getUserAnalytics(userId: string): Promise<UserAnalyticsResponse> {
    const [totalPastes, totalViews, totalForks] = await Promise.all([
      this.repository.countByAuthor(userId),
      this.repository.countTotalViews(userId),
      this.repository.countForks(userId),
    ]);

    return { totalPastes, totalViews, totalForks };
  }

  // ─── Revision Diff ────────────────────────────────────────────────────

  async getRevisionDiff(
    pasteId: string,
    fromRev: number,
    toRev: number,
  ): Promise<RevisionDiffResponse> {
    await this.findActivePaste(pasteId);

    const [fromRevision, toRevision] = await Promise.all([
      this.repository.findRevisionByNumber(pasteId, fromRev),
      this.repository.findRevisionByNumber(pasteId, toRev),
    ]);

    if (!fromRevision) throw new NotFoundError('Revision', String(fromRev));
    if (!toRevision) throw new NotFoundError('Revision', String(toRev));

    const storage = getStorage();
    const [fromContent, toContent] = await Promise.all([
      storage.retrieve(fromRevision.content, fromRevision.contentRef),
      storage.retrieve(toRevision.content, toRevision.contentRef),
    ]);

    const hunks = this.computeDiff(fromContent, toContent);

    return { pasteId, from: fromRev, to: toRev, hunks };
  }

  private computeDiff(from: string, to: string): RevisionDiffResponse['hunks'] {
    const fromLines = from.split('\n');
    const toLines = to.split('\n');
    const hunks: RevisionDiffResponse['hunks'] = [];

    // Simple LCS-based diff
    const maxLen = Math.max(fromLines.length, toLines.length);
    let fi = 0;
    let ti = 0;

    while (fi < fromLines.length || ti < toLines.length) {
      if (fi < fromLines.length && ti < toLines.length && fromLines[fi] === toLines[ti]) {
        // Collect consecutive unchanged lines
        const start = fi;
        while (fi < fromLines.length && ti < toLines.length && fromLines[fi] === toLines[ti]) {
          fi++;
          ti++;
        }
        hunks.push({ type: 'unchanged', value: fromLines.slice(start, fi).join('\n') });
      } else {
        // Find next common line
        let foundFrom = -1;
        let foundTo = -1;
        for (let look = 1; look <= Math.min(maxLen - Math.min(fi, ti), 50); look++) {
          if (
            fi + look < fromLines.length &&
            ti < toLines.length &&
            fromLines[fi + look] === toLines[ti]
          ) {
            foundFrom = fi + look;
            break;
          }
          if (
            ti + look < toLines.length &&
            fi < fromLines.length &&
            toLines[ti + look] === fromLines[fi]
          ) {
            foundTo = ti + look;
            break;
          }
        }

        if (foundFrom >= 0) {
          hunks.push({ type: 'removed', value: fromLines.slice(fi, foundFrom).join('\n') });
          fi = foundFrom;
        } else if (foundTo >= 0) {
          hunks.push({ type: 'added', value: toLines.slice(ti, foundTo).join('\n') });
          ti = foundTo;
        } else {
          if (fi < fromLines.length) {
            hunks.push({ type: 'removed', value: fromLines[fi]! });
            fi++;
          }
          if (ti < toLines.length) {
            hunks.push({ type: 'added', value: toLines[ti]! });
            ti++;
          }
        }
      }
    }

    return hunks;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private assertCanModify(paste: PasteWithContent, userId?: string): void {
    // Anonymous paste: anyone with access can modify (they'll need delete token for deletion)
    if (!paste.authorId) return;
    // Owned paste: only the owner can modify
    if (paste.authorId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Not authorized to modify this paste');
    }
  }

  private async findActivePaste(id: string): Promise<PasteWithContent> {
    const paste = await this.repository.findById(id);

    if (!paste || paste.status === 'DELETED') {
      throw new NotFoundError('Paste', id);
    }

    if (paste.status === 'EXPIRED') {
      throw new NotFoundError('Paste', id);
    }

    if (paste.status === 'BURNED') {
      throw new NotFoundError('Paste', id);
    }

    if (paste.expiresAt && paste.expiresAt < new Date()) {
      throw new NotFoundError('Paste', id);
    }

    // Moderation enforcement: HIDDEN/DISABLED/REMOVED pastes are inaccessible to normal users
    if (
      paste.moderationStatus === 'HIDDEN' ||
      paste.moderationStatus === 'DISABLED' ||
      paste.moderationStatus === 'REMOVED'
    ) {
      throw new NotFoundError('Paste', id);
    }

    return paste;
  }

  private async resolveContent(paste: PasteWithContent): Promise<string> {
    const storage = getStorage();
    return storage.retrieve(paste.content, paste.contentRef);
  }

  private toDetailResponse(
    paste: PasteWithContent,
    content: string,
    viewCount = 0,
  ): PasteDetailResponse {
    return {
      id: paste.id,
      title: paste.title,
      mode: paste.mode as PasteDetailResponse['mode'],
      visibility: paste.visibility as PasteDetailResponse['visibility'],
      status: paste.status as PasteDetailResponse['status'],
      moderationStatus: (paste.moderationStatus ??
        'NONE') as PasteDetailResponse['moderationStatus'],
      language: paste.language,
      encrypted: paste.encrypted,
      encryptionIv: paste.encryptionIv ?? null,
      encryptionVersion: paste.encryptionVersion ?? null,
      burnAfterRead: paste.burnAfterRead,
      expiresAt: paste.expiresAt?.toISOString() ?? null,
      currentRevision: paste.currentRevision,
      content,
      authorId: paste.authorId,
      workspaceId: paste.workspaceId ?? null,
      forkedFromId: paste.forkedFromId ?? null,
      viewCount,
      deleteReason: paste.deleteReason ?? null,
      createdAt: paste.createdAt.toISOString(),
      updatedAt: paste.updatedAt.toISOString(),
    };
  }
}
