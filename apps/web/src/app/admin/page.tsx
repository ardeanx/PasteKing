import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';
import { AdminReportActions } from './report-actions';

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reason?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);
  const params = await searchParams;

  let reports;
  let total = 0;
  try {
    const result = await api.adminListReports({
      status: params.status,
      reason: params.reason,
      limit: 50,
    });
    reports = result.data;
    total = (result as unknown as { total?: number }).total ?? reports.length;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/dashboard');
    throw err;
  }

  const statusFilters = [
    'OPEN',
    'UNDER_REVIEW',
    'RESOLVED_NO_ACTION',
    'RESOLVED_CONTENT_REMOVED',
    'RESOLVED_USER_ACTION',
    'REJECTED',
  ];

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
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Reports ({total})</h2>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <a
            href="/admin"
            className={!params.status ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}
          >
            All
          </a>
          {statusFilters.map((s) => (
            <a
              key={s}
              href={`/admin?status=${s}`}
              className={params.status === s ? 'btn-primary' : 'btn-ghost'}
              style={{ fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}
            >
              {s.replace(/_/g, ' ').toLowerCase()}
            </a>
          ))}
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No reports found.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {reports.map((report, idx) => (
            <div
              key={report.id}
              style={{
                padding: '12px 16px',
                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {report.pasteTitle ?? report.pasteId.slice(0, 8) + '…'}
                  </span>
                  <span className="badge-warning">
                    {report.reason.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <span
                    className={
                      report.status === 'OPEN'
                        ? 'badge-error'
                        : report.status === 'UNDER_REVIEW'
                          ? 'badge-accent'
                          : 'badge-default'
                    }
                  >
                    {report.status.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  {report.pasteEncrypted && <span className="badge-accent">encrypted</span>}
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>

              {report.description && (
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>
                  {report.description}
                </p>
              )}

              <div
                style={{
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--muted)',
                }}
              >
                <span>by {report.reporterUsername ?? 'unknown'}</span>
                {report.pasteAuthorId && (
                  <span>
                    · author:{' '}
                    <a
                      href={`/admin/users?id=${report.pasteAuthorId}`}
                      style={{ color: 'var(--accent)' }}
                    >
                      {report.pasteAuthorId.slice(0, 8)}…
                    </a>
                  </span>
                )}
                <span>
                  · paste:{' '}
                  <Link href={`/p/${report.pasteId}`} style={{ color: 'var(--accent)' }}>
                    {report.pasteId.slice(0, 8)}…
                  </Link>
                </span>
              </div>

              {(report.status === 'OPEN' || report.status === 'UNDER_REVIEW') && (
                <AdminReportActions
                  reportId={report.id}
                  pasteId={report.pasteId}
                  currentStatus={report.status}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
