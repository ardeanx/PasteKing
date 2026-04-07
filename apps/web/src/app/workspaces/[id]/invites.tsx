'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { WorkspaceInviteResponse } from '@pasteking/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  workspaceId: string;
  invites: WorkspaceInviteResponse[];
  isAdmin: boolean;
}

export function WorkspaceInvites({ workspaceId, invites, isAdmin }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const res = await fetch(`${API}/v1/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to send invite');
      }
      setEmail('');
      setRole('MEMBER');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    setBusy(inviteId);
    try {
      await fetch(`${API}/v1/workspaces/${workspaceId}/invites/${inviteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const pending = invites.filter((i) => i.status === 'PENDING');

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Invites</h2>

      {isAdmin && (
        <form
          onSubmit={handleInvite}
          style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 14 }}
        >
          <div style={{ flex: 1 }}>
            <label
              style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}
            >
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              style={{ width: '100%', fontSize: 13 }}
              placeholder="teammate@example.com"
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}
            >
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'MEMBER' | 'ADMIN')}
              className="input"
              style={{ width: 'auto', fontSize: 13 }}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={sending} className="btn-primary" style={{ fontSize: 13 }}>
            {sending ? 'Sending…' : 'Invite'}
          </button>
        </form>
      )}

      {error && <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 8 }}>{error}</p>}

      {pending.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>No pending invites.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {pending.map((inv, idx) => (
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
                <span style={{ fontWeight: 500, fontSize: 14 }}>{inv.email}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
                  {inv.role.toLowerCase()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  expires {new Date(inv.expiresAt).toLocaleDateString()}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    disabled={busy === inv.id}
                    className="btn-ghost"
                    style={{ fontSize: 12, color: 'var(--error)' }}
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
