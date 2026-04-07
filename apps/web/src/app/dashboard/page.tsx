import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';
import { DeletePasteButton } from './delete-button';
import { CopyLinkButton } from './copy-link';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');

  if (!session?.value) {
    redirect('/login');
  }

  const api = createServerApi(`pasteking_session=${session.value}`);

  let pastes;
  let analytics: { totalPastes: number; totalViews: number; totalForks: number } | null = null;
  try {
    const result = await api.listMyPastes();
    pastes = result.data;
    try {
      const analyticsResult = await api.getUserAnalytics();
      analytics = analyticsResult.data;
    } catch {
      // analytics is non-critical
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>My Pastes</h1>

      {analytics && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div className="stat-card">
            <p style={{ fontSize: 24, fontWeight: 700 }}>{analytics.totalPastes}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>pastes</p>
          </div>
          <div className="stat-card">
            <p style={{ fontSize: 24, fontWeight: 700 }}>{analytics.totalViews}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>views</p>
          </div>
          <div className="stat-card">
            <p style={{ fontSize: 24, fontWeight: 700 }}>{analytics.totalForks}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>forks</p>
          </div>
        </div>
      )}

      {pastes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
            You haven&apos;t created any pastes yet.
          </p>
          <Link href="/new" className="btn-primary">
            Create Your First Paste
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {pastes.map((paste, idx) => (
            <div
              key={paste.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <a
                  href={`/p/${paste.id}`}
                  style={{ fontWeight: 500, textDecoration: 'none', color: 'var(--fg)' }}
                >
                  {paste.title ?? 'Untitled'}
                </a>
                <div
                  style={{
                    marginTop: 2,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  <span>{paste.mode.toLowerCase()}</span>
                  <span
                    style={{ color: paste.visibility === 'PRIVATE' ? 'var(--warning)' : undefined }}
                  >
                    {paste.visibility.toLowerCase()}
                  </span>
                  {paste.language && <span>{paste.language}</span>}
                  {paste.burnAfterRead && <span className="badge-error">burn</span>}
                  {paste.status === 'EXPIRED' && <span className="badge-warning">expired</span>}
                  {paste.status === 'BURNED' && <span className="badge-error">burned</span>}
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
                  <span>{new Date(paste.createdAt).toLocaleDateString()}</span>
                  {paste.expiresAt && (
                    <span>expires {new Date(paste.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {!paste.encrypted && !paste.burnAfterRead && paste.status === 'ACTIVE' && (
                  <a
                    href={`/p/${paste.id}/edit`}
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    Edit
                  </a>
                )}
                <CopyLinkButton pasteId={paste.id} />
                <DeletePasteButton pasteId={paste.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
