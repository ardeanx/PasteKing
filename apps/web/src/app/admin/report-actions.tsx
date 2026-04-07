'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  reportId: string;
  pasteId: string;
  currentStatus: string;
}

export function AdminReportActions({ reportId, pasteId, currentStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function updateReport(status: string, reviewNote?: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/v1/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, reviewNote }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to update report');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function takeAction(action: string) {
    setBusy(true);
    setError('');
    try {
      const reason = prompt('Reason for action:');
      if (reason === null) {
        setBusy(false);
        return;
      }
      const res = await fetch(`${API}/v1/admin/pastes/${pasteId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to take action');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingTop: 6 }}>
      {currentStatus === 'OPEN' && (
        <button
          onClick={() => updateReport('UNDER_REVIEW')}
          disabled={busy}
          style={{
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 12,
            color: 'var(--accent)',
            background: 'transparent',
            cursor: 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          Review
        </button>
      )}
      <button
        onClick={() => updateReport('RESOLVED_NO_ACTION', 'No action required')}
        disabled={busy}
        className="btn-ghost"
        style={{ fontSize: 12, padding: '3px 8px' }}
      >
        Dismiss
      </button>
      <button
        onClick={() => updateReport('REJECTED', 'Report rejected')}
        disabled={busy}
        className="btn-ghost"
        style={{ fontSize: 12, padding: '3px 8px' }}
      >
        Reject
      </button>

      <span style={{ color: 'var(--muted)', fontSize: 12 }}>|</span>

      <button
        onClick={() => takeAction('HIDE_CONTENT')}
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
        Hide paste
      </button>
      <button
        onClick={() => takeAction('DISABLE_ACCESS')}
        disabled={busy}
        style={{
          border: '1px solid color-mix(in srgb, #f97316 30%, transparent)',
          borderRadius: 6,
          padding: '3px 8px',
          fontSize: 12,
          color: '#f97316',
          background: 'transparent',
          cursor: 'pointer',
          opacity: busy ? 0.5 : 1,
        }}
      >
        Disable
      </button>
      <button
        onClick={() => takeAction('DELETE_CONTENT')}
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
        Delete
      </button>

      {error && <span style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>}
    </div>
  );
}
