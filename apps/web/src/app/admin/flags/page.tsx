import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';

export default async function AdminAbuseFlagsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);

  let flags;
  try {
    const result = await api.adminListAbuseFlags({ resolved: false });
    flags = result.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/dashboard');
    throw err;
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>
        Abuse Flags ({flags.length} unresolved)
      </h2>

      {flags.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No unresolved abuse flags.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {flags.map((flag, idx) => (
            <div
              key={flag.id}
              style={{
                padding: '10px 16px',
                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={flag.severity === 'high' ? 'badge-error' : 'badge-warning'}>
                    {flag.severity}
                  </span>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {flag.type.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(flag.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 12,
                  color: 'var(--muted)',
                }}
              >
                {flag.pasteId && (
                  <span>
                    paste:{' '}
                    <Link href={`/p/${flag.pasteId}`} style={{ color: 'var(--accent)' }}>
                      {flag.pasteId.slice(0, 8)}…
                    </Link>
                  </span>
                )}
                {flag.userId && <span>user: {(flag.userId as string).slice(0, 8)}…</span>}
                {flag.metadata ? (
                  <span style={{ fontFamily: 'monospace' }}>{JSON.stringify(flag.metadata)}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
