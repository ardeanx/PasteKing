import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ApiError } from '@pasteking/sdk';
import { createServerApi } from '@/lib/api';
import { OwnerActions } from './owner-actions';
import { EncryptedContent } from './encrypted-content';
import { ReportButton } from './report-button';
import { SyntaxHighlightedCode } from './syntax-highlight';
import { ForkButton } from './fork-button';
import { DiffViewer } from './diff-viewer';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface PastePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PastePageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const client = createServerApi();
    const { data: paste } = await client.getPaste(id);
    const title = paste.title || 'Untitled Paste';
    const description = paste.encrypted
      ? 'This paste is encrypted'
      : (paste.content ?? '').slice(0, 160).replace(/\n/g, ' ') || 'View this paste on PasteKing';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        ...(paste.createdAt && { publishedTime: paste.createdAt }),
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
      robots: paste.encrypted ? { index: false, follow: false } : undefined,
    };
  } catch {
    return { title: 'Paste Not Found' };
  }
}

export default async function PastePage({ params }: PastePageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  const client = createServerApi(session?.value ? `pasteking_session=${session.value}` : undefined);

  let paste;
  try {
    const result = await client.getPaste(id);
    paste = result.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  // Determine ownership
  let currentUserId: string | null = null;
  if (session?.value) {
    try {
      const me = await client.getMe();
      currentUserId = me.data.id;
    } catch {
      // not logged in or session expired
    }
  }
  const isOwner = !!currentUserId && paste.authorId === currentUserId;

  let revisions: {
    id: string;
    revisionNumber: number;
    contentHash: string | null;
    createdAt: string;
  }[] = [];
  let pasteAnalytics: {
    totalViews: number;
    last24h: number;
    last7d: number;
    last30d: number;
  } | null = null;
  if (paste.currentRevision > 1) {
    try {
      const result = await client.getRevisions(id);
      revisions = result.data;
    } catch {
      // revision fetch is non-critical
    }
  }
  if (isOwner) {
    try {
      const result = await client.getPasteAnalytics(id);
      pasteAnalytics = result.data;
    } catch {
      // analytics is non-critical
    }
  }

  // Check if syntax highlighting should be used (CODE or LOG mode, not encrypted)
  const useSyntaxHighlight = !paste.encrypted && (paste.mode === 'CODE' || paste.mode === 'LOG');

  return (
    <div>
      {/* Deleted paste notice */}
      {paste.status === 'DELETED' && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--error)' }}>
              This paste has been removed
            </p>
            {paste.deleteReason && (
              <p style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
                <strong>Reason:</strong> {paste.deleteReason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{paste.title ?? 'Untitled'}</h1>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: 13,
              color: 'var(--muted)',
            }}
          >
            <span className="badge-default">{paste.mode.toLowerCase()}</span>
            <span className="badge-default">{paste.visibility.toLowerCase()}</span>
            {paste.language && <span className="badge-default">{paste.language}</span>}
            {paste.burnAfterRead && <span className="badge-error">burn after read</span>}
            {paste.encrypted && <span className="badge-accent">encrypted</span>}
            {paste.currentRevision > 1 && (
              <span className="badge-default">rev {paste.currentRevision}</span>
            )}
            {'viewCount' in paste && (
              <span style={{ color: 'var(--muted)' }}>
                {(paste as { viewCount: number }).viewCount} views
              </span>
            )}
            {'moderationStatus' in paste &&
              (paste as { moderationStatus: string }).moderationStatus !== 'NONE' &&
              (paste as { moderationStatus: string }).moderationStatus !== 'CLEAN' && (
                <span
                  className={
                    (paste as { moderationStatus: string }).moderationStatus === 'HIDDEN'
                      ? 'badge-error'
                      : 'badge-warning'
                  }
                >
                  {(paste as { moderationStatus: string }).moderationStatus.toLowerCase()}
                </span>
              )}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>
          <div>{new Date(paste.createdAt).toLocaleDateString()}</div>
          {paste.expiresAt && <div>expires {new Date(paste.expiresAt).toLocaleDateString()}</div>}
        </div>
      </div>

      {/* Content */}
      {paste.status !== 'DELETED' && (
        <div style={{ marginBottom: 16 }}>
          {paste.encrypted && paste.encryptionIv && paste.encryptionVersion ? (
            <EncryptedContent
              ciphertext={paste.content}
              iv={paste.encryptionIv}
              version={paste.encryptionVersion}
            />
          ) : useSyntaxHighlight ? (
            <SyntaxHighlightedCode code={paste.content} language={paste.language} />
          ) : (
            <pre
              className="card"
              style={{
                overflow: 'auto',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <code>{paste.content}</code>
            </pre>
          )}
        </div>
      )}

      {paste.forkedFromId && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Forked from{' '}
          <Link href={`/p/${paste.forkedFromId}`} style={{ color: 'var(--accent)' }}>
            {paste.forkedFromId}
          </Link>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 24 }}>
        {!paste.encrypted && (
          <a
            href={`${API_URL}/v1/pastes/${paste.id}/raw`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            Raw
          </a>
        )}
        {!paste.encrypted && !paste.burnAfterRead && <ForkButton pasteId={paste.id} />}
        {isOwner && (
          <OwnerActions
            pasteId={paste.id}
            encrypted={paste.encrypted}
            burnAfterRead={paste.burnAfterRead}
          />
        )}
        {!isOwner && currentUserId && <ReportButton pasteId={paste.id} />}
      </div>

      {revisions.length > 1 && <DiffViewer pasteId={paste.id} revisions={revisions} />}

      {/* Analytics */}
      {isOwner && pasteAnalytics && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <div className="stat-card" style={{ flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 700 }}>{pasteAnalytics.totalViews}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>total views</p>
          </div>
          <div className="stat-card" style={{ flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 700 }}>{pasteAnalytics.last24h}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>24h</p>
          </div>
          <div className="stat-card" style={{ flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 700 }}>{pasteAnalytics.last7d}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>7d</p>
          </div>
          <div className="stat-card" style={{ flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 700 }}>{pasteAnalytics.last30d}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>30d</p>
          </div>
        </div>
      )}

      {/* Revision history */}
      {revisions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Revision History</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {revisions.map((rev, idx) => (
              <div
                key={rev.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  fontSize: 13,
                  borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span>Revision {rev.revisionNumber}</span>
                <span style={{ color: 'var(--muted)' }}>
                  {new Date(rev.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
