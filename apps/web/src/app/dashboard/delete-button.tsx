'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function DeletePasteButton({ pasteId }: { pasteId: string }) {
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
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        alert(body?.error?.message ?? 'Failed to delete paste');
        return;
      }
      router.refresh();
    } catch {
      alert('Failed to connect to server');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="btn-ghost"
      style={{ fontSize: 12, padding: '4px 10px', color: 'var(--error)' }}
    >
      {busy ? '…' : 'Delete'}
    </button>
  );
}
