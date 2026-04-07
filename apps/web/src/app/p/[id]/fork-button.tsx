'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function ForkButton({ pasteId }: { pasteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleFork() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/pastes/${pasteId}/fork`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to fork paste');
      }
      const body = await res.json();
      router.push(`/p/${body.data.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to fork paste');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleFork}
      disabled={loading}
      className="btn-ghost"
      style={{ fontSize: 13, padding: '6px 12px' }}
    >
      {loading ? 'Forking...' : 'Fork'}
    </button>
  );
}
