import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';

export default async function AdminAuditLogsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);

  let logs;
  try {
    const result = await api.adminListAuditLogs({ limit: 100 });
    logs = result.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/dashboard');
    throw err;
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Moderation Audit Logs</h2>

      {logs.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No audit log entries yet.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {logs.map((log, idx) => (
            <div
              key={log.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{log.action}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    by {log.actorUsername}
                  </span>
                </div>
                <div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>
                  {log.entityType} · {log.entityId?.slice(0, 8)}…
                  {log.metadata ? (
                    <span style={{ marginLeft: 8, fontFamily: 'monospace' }}>
                      {JSON.stringify(log.metadata)}
                    </span>
                  ) : null}
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
