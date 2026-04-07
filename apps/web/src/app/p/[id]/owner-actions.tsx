'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function OwnerActions({
  pasteId,
  encrypted,
  burnAfterRead,
}: {
  pasteId: string;
  encrypted?: boolean;
  burnAfterRead?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this paste?')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/v1/pastes/${pasteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok || res.status === 204) {
        router.push('/dashboard');
      } else {
        const body = await res.json().catch(() => null);
        alert(body?.error?.message ?? 'Failed to delete paste');
      }
    } catch {
      alert('Failed to connect to server');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!encrypted && !burnAfterRead && (
        <a
          href={`/p/${pasteId}/edit`}
          className="btn-ghost"
          style={{ fontSize: 13, padding: '6px 12px' }}
        >
          Edit
        </a>
      )}
      <button
        onClick={handleDelete}
        disabled={busy}
        className="btn-ghost"
        style={{ fontSize: 13, padding: '6px 12px', color: 'var(--error)' }}
      >
        {busy ? 'Deleting…' : 'Delete'}
      </button>
    </>
  );
}
