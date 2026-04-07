'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { WorkspaceMemberResponse } from '@pasteking/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  workspaceId: string;
  members: WorkspaceMemberResponse[];
  isAdmin: boolean;
  isOwner: boolean;
}

export function WorkspaceMembers({ workspaceId, members, isAdmin, isOwner }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this member?')) return;
    setBusy(memberId);
    setError('');
    try {
      const res = await fetch(`${API}/v1/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? 'Failed to remove member');
        return;
      }
      router.refresh();
    } catch {
      setError('Failed to connect to server');
    } finally {
      setBusy(null);
    }
  }

  async function handleRoleChange(memberId: string, role: string) {
    setBusy(memberId);
    setError('');
    try {
      const res = await fetch(`${API}/v1/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? 'Failed to update role');
        return;
      }
      router.refresh();
    } catch {
      setError('Failed to connect to server');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
        Members ({members.length})
      </h2>
      {error && <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 8 }}>{error}</p>}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {members.map((m, idx) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{m.username}</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>{m.email}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {m.role === 'OWNER' ? (
                <span className="badge-warning">owner</span>
              ) : isOwner ? (
                <select
                  value={m.role}
                  disabled={busy === m.id}
                  onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  className="input"
                  style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                >
                  <option value="ADMIN">admin</option>
                  <option value="MEMBER">member</option>
                </select>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{m.role.toLowerCase()}</span>
              )}
              {isAdmin && m.role !== 'OWNER' && (
                <button
                  onClick={() => handleRemove(m.id)}
                  disabled={busy === m.id}
                  className="btn-ghost"
                  style={{ fontSize: 12, color: 'var(--error)' }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
