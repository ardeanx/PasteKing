import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';

export default async function WorkspacesPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);

  let workspaces;
  let invites;
  try {
    const [wsResult, invResult] = await Promise.all([api.listMyWorkspaces(), api.listMyInvites()]);
    workspaces = wsResult.data;
    invites = invResult.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Workspaces</h1>
        <a
          href="/workspaces/new"
          className="btn-primary"
          style={{ textDecoration: 'none', fontSize: 13 }}
        >
          New Workspace
        </a>
      </div>

      {invites.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Pending Invites</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {invites.map((inv, idx) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{inv.workspaceId}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
                    as {inv.role.toLowerCase()}
                  </span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
                    expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <form action={`/api/workspaces/invites/${inv.id}/accept`} method="POST">
                    <input type="hidden" name="workspaceId" value={inv.workspaceId} />
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      Accept
                    </button>
                  </form>
                  <form action={`/api/workspaces/invites/${inv.id}/decline`} method="POST">
                    <input type="hidden" name="workspaceId" value={inv.workspaceId} />
                    <button
                      type="submit"
                      className="btn-secondary"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      Decline
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {workspaces.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            You&apos;re not a member of any workspaces yet.
          </p>
          <a
            href="/workspaces/new"
            className="btn-primary"
            style={{ display: 'inline-block', marginTop: 12, textDecoration: 'none', fontSize: 13 }}
          >
            Create Your First Workspace
          </a>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {workspaces.map((ws, idx) => (
            <a
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                textDecoration: 'none',
                color: 'var(--fg)',
              }}
            >
              <div>
                <span style={{ fontWeight: 500 }}>{ws.name}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
                  /{ws.slug}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 12,
                  color: 'var(--muted)',
                }}
              >
                <span>{ws.role.toLowerCase()}</span>
                <span>
                  {ws.memberCount} member{ws.memberCount !== 1 ? 's' : ''}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
