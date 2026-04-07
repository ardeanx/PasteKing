import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';
import { WorkspaceMembers } from './members';
import { WorkspaceInvites } from './invites';
import { WorkspaceSettings } from './settings';
import { WorkspaceAuditLogs } from './audit-logs';
import { WorkspacePasteSearch } from './paste-search';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkspaceDetailPage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);

  let workspace;
  let members;
  let pastes;
  let invites;
  let auditLogs;
  try {
    [workspace, members, pastes] = await Promise.all([
      api.getWorkspace(id).then((r) => r.data),
      api.listMembers(id).then((r) => r.data),
      api.listWorkspacePastes(id).then((r) => r.data),
    ]);
    // Only admins/owners can see invites and audit logs
    if (workspace.role === 'OWNER' || workspace.role === 'ADMIN') {
      [invites, auditLogs] = await Promise.all([
        api.listInvites(id).then((r) => r.data),
        api.listWorkspaceAuditLogs(id).then((r) => r.data),
      ]);
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      redirect('/workspaces');
    }
    throw err;
  }

  const isAdmin = workspace.role === 'OWNER' || workspace.role === 'ADMIN';
  const isOwner = workspace.role === 'OWNER';

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
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{workspace.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>/{workspace.slug}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href={`/new?workspaceId=${workspace.id}`}
            className="btn-primary"
            style={{ textDecoration: 'none', fontSize: 13 }}
          >
            New Paste
          </a>
          {isOwner && (
            <a
              href={`/workspaces/${workspace.id}/billing`}
              className="btn-secondary"
              style={{ textDecoration: 'none', fontSize: 13 }}
            >
              Billing
            </a>
          )}
          <span className="badge-default">{workspace.role.toLowerCase()}</span>
        </div>
      </div>

      {/* Workspace Pastes */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Pastes</h2>
        <WorkspacePasteSearch workspaceId={workspace.id} />
        {pastes.length === 0 ? (
          <div
            className="card"
            style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}
          >
            No pastes in this workspace yet.
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
                  padding: '10px 16px',
                  borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <a
                    href={`/p/${paste.id}`}
                    style={{ fontWeight: 500, color: 'var(--fg)', fontSize: 14 }}
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
                    {paste.language && <span>{paste.language}</span>}
                    {paste.authorUsername && <span>by {paste.authorUsername}</span>}
                    <span>{new Date(paste.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Members */}
      <WorkspaceMembers
        workspaceId={workspace.id}
        members={members}
        isAdmin={isAdmin}
        isOwner={isOwner}
      />

      {/* Invites (admin/owner only) */}
      {isAdmin && invites && (
        <WorkspaceInvites workspaceId={workspace.id} invites={invites} isAdmin={isAdmin} />
      )}

      {/* Settings (admin/owner only) */}
      {isAdmin && (
        <WorkspaceSettings
          workspaceId={workspace.id}
          name={workspace.name}
          slug={workspace.slug}
          isOwner={isOwner}
        />
      )}

      {/* Audit Logs (admin/owner only) */}
      {isAdmin && auditLogs && <WorkspaceAuditLogs logs={auditLogs} />}
    </div>
  );
}
