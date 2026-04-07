'use client';

import type { WorkspaceAuditLogResponse } from '@pasteking/types';

interface Props {
  logs: WorkspaceAuditLogResponse[];
}

export function WorkspaceAuditLogs({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Audit Log</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>No activity recorded yet.</p>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Audit Log</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {logs.map((log, idx) => (
          <div
            key={log.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px',
              borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 500 }}>{log.action}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>by {log.actorUsername}</span>
              {log.entityType && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  → {log.entityType}
                  {log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ''}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
