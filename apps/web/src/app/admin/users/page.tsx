import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';
import { UserStatusActions } from './user-actions';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; platformRole?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);
  const params = await searchParams;

  let users;
  try {
    const result = await api.adminListUsers({
      status: params.status,
      platformRole: params.platformRole,
      limit: 50,
    });
    users = result.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/dashboard');
    throw err;
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Users ({users.length})</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <a
            href="/admin/users"
            className={!params.status ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}
          >
            All
          </a>
          {['ACTIVE', 'RESTRICTED', 'SUSPENDED'].map((s) => (
            <a
              key={s}
              href={`/admin/users?status=${s}`}
              className={params.status === s ? 'btn-primary' : 'btn-ghost'}
              style={{ fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}
            >
              {s.toLowerCase()}
            </a>
          ))}
        </div>
      </div>

      {users.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No users found.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {users.map((user, idx) => (
            <div
              key={user.id}
              style={{
                padding: '12px 16px',
                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{user.username}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{user.email}</span>
                  <span
                    className={
                      user.status === 'ACTIVE'
                        ? 'badge-default'
                        : user.status === 'RESTRICTED'
                          ? 'badge-warning'
                          : 'badge-error'
                    }
                  >
                    {user.status.toLowerCase()}
                  </span>
                  {user.platformRole === 'ADMIN' && <span className="badge-accent">admin</span>}
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(user.createdAt).toLocaleDateString()}
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
                <span>{user.pasteCount} pastes</span>
                <span>{user.reportCount} reports filed</span>
              </div>
              {user.platformRole !== 'ADMIN' && (
                <UserStatusActions userId={user.id} currentStatus={user.status} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
