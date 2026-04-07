'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  userId: string;
  currentStatus: string;
}

export function UserStatusActions({ userId, currentStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function changeStatus(status: string) {
    const reason = prompt(`Reason for ${status.toLowerCase()}:`);
    if (reason === null) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/v1/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to update user status');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
      {currentStatus !== 'ACTIVE' && (
        <button
          onClick={() => changeStatus('ACTIVE')}
          disabled={busy}
          style={{
            border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 12,
            color: 'var(--success)',
            background: 'transparent',
            cursor: 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          Activate
        </button>
      )}
      {currentStatus !== 'RESTRICTED' && (
        <button
          onClick={() => changeStatus('RESTRICTED')}
          disabled={busy}
          style={{
            border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 12,
            color: 'var(--warning)',
            background: 'transparent',
            cursor: 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          Restrict
        </button>
      )}
      {currentStatus !== 'SUSPENDED' && (
        <button
          onClick={() => changeStatus('SUSPENDED')}
          disabled={busy}
          style={{
            border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 12,
            color: 'var(--error)',
            background: 'transparent',
            cursor: 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          Suspend
        </button>
      )}
      {error && <span style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>}
    </div>
  );
}
