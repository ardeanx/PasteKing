import { prisma } from '@pasteking/db';
import { sha256 } from '@pasteking/crypto';
import type {
  CreatePasteData,
  UpdatePasteData,
  PasteWithContent,
  PasteRevisionRow,
} from './pastes.types';

/**
 * Map snake_case raw SQL row to camelCase to match PasteWithContent interface.
 * Columns not in the map are passed through as-is.
 */
function mapRawPaste<T>(row: T): T {
  const mapped: Record<string, unknown> = {};
  const keyMap: Record<string, string> = {
    moderation_status: 'moderationStatus',
    burn_after_read: 'burnAfterRead',
    expires_at: 'expiresAt',
    current_revision: 'currentRevision',
    content_ref: 'contentRef',
    delete_token_hash: 'deleteTokenHash',
    author_id: 'authorId',
    workspace_id: 'workspaceId',
    forked_from_id: 'forkedFromId',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    encryption_iv: 'encryptionIv',
    encryption_version: 'encryptionVersion',
    delete_reason: 'deleteReason',
  };
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    mapped[keyMap[k] ?? k] = v;
  }
  return mapped as T;
}

export class PastesRepository {
  async create(data: CreatePasteData & { forkedFromId?: string }): Promise<PasteWithContent> {
    const contentHash = sha256(data.content);

    const paste = await prisma.paste.create({
      data: {
        title: data.title,
        mode: data.mode,
        visibility: data.visibility,
        language: data.language,
        burnAfterRead: data.burnAfterRead,
        expiresAt: data.expiresAt,
        content: data.contentRef ? null : data.content,
        contentRef: data.contentRef ?? null,
        deleteTokenHash: data.deleteTokenHash,
        authorId: data.authorId,
        workspaceId: data.workspaceId,
        encrypted: data.encrypted ?? false,
        encryptionIv: data.encryptionIv ?? null,
        encryptionVersion: data.encryptionVersion ?? null,
        forkedFromId: data.forkedFromId ?? null,
        currentRevision: 1,
        revisions: {
          create: {
            revisionNumber: 1,
            content: data.contentRef ? null : data.content,
            contentRef: data.contentRef ?? null,
            contentHash,
          },
        },
      },
    });

    return paste as PasteWithContent;
  }

  async findById(id: string): Promise<PasteWithContent | null> {
    const paste = await prisma.paste.findUnique({ where: { id } });
    return paste as PasteWithContent | null;
  }

  async findByDeleteTokenHash(hash: string): Promise<PasteWithContent | null> {
    const paste = await prisma.paste.findUnique({ where: { deleteTokenHash: hash } });
    return paste as PasteWithContent | null;
  }

  async findByAuthor(authorId: string, limit = 50, offset = 0): Promise<PasteWithContent[]> {
    const pastes = await prisma.paste.findMany({
      where: { authorId, workspaceId: null, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return pastes as PasteWithContent[];
  }

  async findByWorkspace(
    workspaceId: string,
    limit = 50,
    offset = 0,
  ): Promise<(PasteWithContent & { author?: { username: string } | null })[]> {
    const pastes = await prisma.paste.findMany({
      where: { workspaceId, status: { not: 'DELETED' } },
      include: { author: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return pastes as (PasteWithContent & { author?: { username: string } | null })[];
  }

  async update(
    id: string,
    data: UpdatePasteData,
    newRevisionNumber: number,
  ): Promise<PasteWithContent> {
    const contentHash = sha256(data.content);

    const paste = await prisma.paste.update({
      where: { id },
      data: {
        title: data.title,
        content: data.contentRef ? null : data.content,
        contentRef: data.contentRef ?? null,
        language: data.language,
        currentRevision: newRevisionNumber,
        revisions: {
          create: {
            revisionNumber: newRevisionNumber,
            content: data.contentRef ? null : data.content,
            contentRef: data.contentRef ?? null,
            contentHash,
          },
        },
      },
    });

    return paste as PasteWithContent;
  }

  async markBurned(id: string): Promise<void> {
    await prisma.paste.update({
      where: { id },
      data: { status: 'BURNED', content: null },
    });
  }

  async hardDelete(id: string): Promise<void> {
    await prisma.paste.delete({
      where: { id },
    });
  }

  async findRevisions(pasteId: string): Promise<PasteRevisionRow[]> {
    const revisions = await prisma.pasteRevision.findMany({
      where: { pasteId },
      orderBy: { revisionNumber: 'desc' },
      select: {
        id: true,
        revisionNumber: true,
        content: true,
        contentRef: true,
        contentHash: true,
        createdAt: true,
      },
    });

    return revisions as PasteRevisionRow[];
  }

  async findRevisionByNumber(
    pasteId: string,
    revisionNumber: number,
  ): Promise<PasteRevisionRow | null> {
    const revision = await prisma.pasteRevision.findUnique({
      where: { pasteId_revisionNumber: { pasteId, revisionNumber } },
      select: {
        id: true,
        revisionNumber: true,
        content: true,
        contentRef: true,
        contentHash: true,
        createdAt: true,
      },
    });
    return revision as PasteRevisionRow | null;
  }

  async searchPublic(
    query: string,
    limit = 20,
    offset = 0,
  ): Promise<(PasteWithContent & { headline: string | null })[]> {
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(Boolean)
      .join(' & ');

    if (!tsQuery) return [];

    try {
      const results = await prisma.$queryRaw<(PasteWithContent & { headline: string | null })[]>`
        SELECT p.*,
          ts_headline('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''), to_tsquery('english', ${tsQuery}),
            'StartSel=<<, StopSel=>>, MaxWords=30, MinWords=10') as headline
        FROM pastes p
        WHERE p.status = 'ACTIVE'
          AND p.encrypted = false
          AND p.visibility IN ('PUBLIC', 'UNLISTED')
          AND p.moderation_status = 'NONE'
          AND (
            to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''))
            @@ to_tsquery('english', ${tsQuery})
          )
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return results.map(mapRawPaste);
    } catch {
      return [];
    }
  }

  async listRecentPublic(limit = 20): Promise<PasteWithContent[]> {
    // Use Prisma client (not raw SQL) for proper column name mapping
    const results = await prisma.paste.findMany({
      where: {
        status: 'ACTIVE',
        encrypted: false,
        visibility: 'PUBLIC',
        moderationStatus: 'NONE',
        burnAfterRead: false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return results as unknown as PasteWithContent[];
  }

  async countViews(pasteId: string): Promise<number> {
    return prisma.pasteView.count({ where: { pasteId } });
  }

  async countViewsSince(pasteId: string, since: Date): Promise<number> {
    return prisma.pasteView.count({ where: { pasteId, createdAt: { gte: since } } });
  }

  async recordView(pasteId: string, ipHash?: string): Promise<void> {
    await prisma.pasteView.create({ data: { pasteId, ipHash } });
  }

  async countByAuthor(authorId: string): Promise<number> {
    return prisma.paste.count({ where: { authorId, status: { not: 'DELETED' } } });
  }

  async countTotalViews(authorId: string): Promise<number> {
    const result = await prisma.pasteView.count({
      where: { paste: { authorId } },
    });
    return result;
  }

  async countForks(authorId: string): Promise<number> {
    return prisma.paste.count({
      where: { forkedFrom: { authorId }, status: { not: 'DELETED' } },
    });
  }

  // ─── Personal Search (user's own pastes) ────────────────────────────────

  async searchByAuthor(
    authorId: string,
    query: string,
    limit = 20,
    offset = 0,
    filters?: { language?: string; mode?: string },
  ): Promise<{ items: (PasteWithContent & { headline: string | null })[]; total: number }> {
    const tsQuery = this.buildTsQuery(query);
    if (!tsQuery) return { items: [], total: 0 };

    const langFilter = filters?.language
      ? `AND p.language = '${filters.language.replace(/'/g, "''")}'`
      : '';
    const modeFilter = filters?.mode ? `AND p.mode = '${filters.mode.replace(/'/g, "''")}'` : '';

    const [items, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<(PasteWithContent & { headline: string | null })[]>(
        `SELECT p.*,
          ts_headline('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''), to_tsquery('english', $1),
            'StartSel=<<, StopSel=>>, MaxWords=30, MinWords=10') as headline
        FROM pastes p
        WHERE p.author_id = $2
          AND p.status = 'ACTIVE'
          AND p.encrypted = false
          AND p.workspace_id IS NULL
          AND p.moderation_status NOT IN ('REMOVED', 'DISABLED')
          ${langFilter} ${modeFilter}
          AND (
            to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''))
            @@ to_tsquery('english', $1)
          )
        ORDER BY p.created_at DESC
        LIMIT $3 OFFSET $4`,
        tsQuery,
        authorId,
        limit,
        offset,
      ),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT count(*)::bigint as count
        FROM pastes p
        WHERE p.author_id = $1
          AND p.status = 'ACTIVE'
          AND p.encrypted = false
          AND p.workspace_id IS NULL
          AND p.moderation_status NOT IN ('REMOVED', 'DISABLED')
          ${langFilter} ${modeFilter}
          AND (
            to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''))
            @@ to_tsquery('english', $2)
          )`,
        authorId,
        tsQuery,
      ),
    ]);

    return { items: items.map(mapRawPaste), total: Number(countResult[0]?.count ?? 0) };
  }

  // ─── Workspace Search ───────────────────────────────────────────────────

  async searchByWorkspace(
    workspaceId: string,
    query: string,
    limit = 20,
    offset = 0,
    filters?: { language?: string; mode?: string },
  ): Promise<{
    items: (PasteWithContent & { headline: string | null; author_username: string | null })[];
    total: number;
  }> {
    const tsQuery = this.buildTsQuery(query);
    if (!tsQuery) return { items: [], total: 0 };

    const langFilter = filters?.language
      ? `AND p.language = '${filters.language.replace(/'/g, "''")}'`
      : '';
    const modeFilter = filters?.mode ? `AND p.mode = '${filters.mode.replace(/'/g, "''")}'` : '';

    const [items, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<
        (PasteWithContent & { headline: string | null; author_username: string | null })[]
      >(
        `SELECT p.*, u.username as author_username,
          ts_headline('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''), to_tsquery('english', $1),
            'StartSel=<<, StopSel=>>, MaxWords=30, MinWords=10') as headline
        FROM pastes p
        LEFT JOIN users u ON u.id = p.author_id
        WHERE p.workspace_id = $2
          AND p.status = 'ACTIVE'
          AND p.encrypted = false
          AND p.moderation_status NOT IN ('REMOVED', 'DISABLED')
          ${langFilter} ${modeFilter}
          AND (
            to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''))
            @@ to_tsquery('english', $1)
          )
        ORDER BY p.created_at DESC
        LIMIT $3 OFFSET $4`,
        tsQuery,
        workspaceId,
        limit,
        offset,
      ),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT count(*)::bigint as count
        FROM pastes p
        WHERE p.workspace_id = $1
          AND p.status = 'ACTIVE'
          AND p.encrypted = false
          AND p.moderation_status NOT IN ('REMOVED', 'DISABLED')
          ${langFilter} ${modeFilter}
          AND (
            to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''))
            @@ to_tsquery('english', $2)
          )`,
        workspaceId,
        tsQuery,
      ),
    ]);

    return { items: items.map(mapRawPaste), total: Number(countResult[0]?.count ?? 0) };
  }

  // ─── Admin filtered search ──────────────────────────────────────────────

  async adminSearch(
    filters: {
      q?: string;
      status?: string;
      moderationStatus?: string;
      visibility?: string;
      authorId?: string;
    },
    limit = 20,
    offset = 0,
  ): Promise<{
    items: (PasteWithContent & { author_username: string | null; report_count: number })[];
    total: number;
  }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.q) {
      const tsQuery = this.buildTsQuery(filters.q);
      if (tsQuery) {
        params.push(tsQuery);
        conditions.push(
          `to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')) @@ to_tsquery('english', $${paramIdx})`,
        );
        paramIdx++;
      }
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`p.status = $${paramIdx}`);
      paramIdx++;
    }

    if (filters.moderationStatus) {
      params.push(filters.moderationStatus);
      conditions.push(`p.moderation_status = $${paramIdx}`);
      paramIdx++;
    }

    if (filters.visibility) {
      params.push(filters.visibility);
      conditions.push(`p.visibility = $${paramIdx}`);
      paramIdx++;
    }

    if (filters.authorId) {
      params.push(filters.authorId);
      conditions.push(`p.author_id = $${paramIdx}`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    params.push(limit);
    const limitParamIdx = paramIdx;
    paramIdx++;
    params.push(offset);
    const offsetParamIdx = paramIdx;

    const [items, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<
        (PasteWithContent & { author_username: string | null; report_count: number })[]
      >(
        `SELECT p.*, u.username as author_username,
          (SELECT count(*)::int FROM reports r WHERE r.paste_id = p.id) as report_count
        FROM pastes p
        LEFT JOIN users u ON u.id = p.author_id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
        ...params,
      ),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT count(*)::bigint as count
        FROM pastes p
        ${whereClause}`,
        ...params.slice(0, -2), // exclude limit and offset
      ),
    ]);

    return { items: items.map(mapRawPaste), total: Number(countResult[0]?.count ?? 0) };
  }

  // ─── Updated searchPublic with count ───────────────────────────────────

  async searchPublicPaginated(
    query: string,
    limit = 20,
    offset = 0,
  ): Promise<{ items: (PasteWithContent & { headline: string | null })[]; total: number }> {
    const tsQuery = this.buildTsQuery(query);
    if (!tsQuery) return { items: [], total: 0 };

    const [items, countResult] = await Promise.all([
      prisma.$queryRaw<(PasteWithContent & { headline: string | null })[]>`
        SELECT p.*,
          ts_headline('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''), to_tsquery('english', ${tsQuery}),
            'StartSel=<<, StopSel=>>, MaxWords=30, MinWords=10') as headline
        FROM pastes p
        WHERE p.status = 'ACTIVE'
          AND p.encrypted = false
          AND p.visibility = 'PUBLIC'
          AND p.moderation_status = 'NONE'
          AND (
            to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''))
            @@ to_tsquery('english', ${tsQuery})
          )
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT count(*)::bigint as count
        FROM pastes p
        WHERE p.status = 'ACTIVE'
          AND p.encrypted = false
          AND p.visibility = 'PUBLIC'
          AND p.moderation_status = 'NONE'
          AND (
            to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''))
            @@ to_tsquery('english', ${tsQuery})
          )
      `,
    ]);

    return { items: items.map(mapRawPaste), total: Number(countResult[0]?.count ?? 0) };
  }

  // ─── Helper ────────────────────────────────────────────────────────────

  private buildTsQuery(query: string): string {
    return query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(Boolean)
      .join(' & ');
  }
}
