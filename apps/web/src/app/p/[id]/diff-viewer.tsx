'use client';

import { useState } from 'react';
import type { DiffHunk } from '@pasteking/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface DiffViewerProps {
  pasteId: string;
  revisions: { revisionNumber: number }[];
}

export function DiffViewer({ pasteId, revisions }: DiffViewerProps) {
  const [fromRev, setFromRev] = useState(revisions[0]?.revisionNumber ?? 1);
  const [toRev, setToRev] = useState(revisions[revisions.length - 1]?.revisionNumber ?? 2);
  const [hunks, setHunks] = useState<DiffHunk[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDiff() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/v1/pastes/${pasteId}/revisions/diff?from=${fromRev}&to=${toRev}`,
        {
          credentials: 'include',
        },
      );
      if (!res.ok) throw new Error('Failed to load diff');
      const body = await res.json();
      setHunks(body.data.hunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diff');
    }
    setLoading(false);
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Compare Revisions</h2>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}
      >
        <select
          value={fromRev}
          onChange={(e) => setFromRev(Number(e.target.value))}
          className="input"
          style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}
        >
          {revisions.map((r) => (
            <option key={r.revisionNumber} value={r.revisionNumber}>
              Rev {r.revisionNumber}
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--muted)' }}>→</span>
        <select
          value={toRev}
          onChange={(e) => setToRev(Number(e.target.value))}
          className="input"
          style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}
        >
          {revisions.map((r) => (
            <option key={r.revisionNumber} value={r.revisionNumber}>
              Rev {r.revisionNumber}
            </option>
          ))}
        </select>
        <button
          onClick={loadDiff}
          disabled={loading || fromRev === toRev}
          className="btn-primary"
          style={{ fontSize: 13, padding: '6px 14px' }}
        >
          {loading ? 'Loading...' : 'Compare'}
        </button>
      </div>

      {error && <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 8 }}>{error}</p>}

      {hunks && (
        <pre
          className="card"
          style={{
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 13,
          }}
        >
          {hunks.map((hunk, i) => (
            <span
              key={i}
              style={{
                color:
                  hunk.type === 'added'
                    ? 'var(--success)'
                    : hunk.type === 'removed'
                      ? 'var(--error)'
                      : undefined,
                background:
                  hunk.type === 'added'
                    ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                    : hunk.type === 'removed'
                      ? 'color-mix(in srgb, var(--error) 10%, transparent)'
                      : undefined,
                textDecoration: hunk.type === 'removed' ? 'line-through' : undefined,
              }}
            >
              {hunk.type === 'added' ? '+ ' : hunk.type === 'removed' ? '- ' : '  '}
              {hunk.value}
              {'\n'}
            </span>
          ))}
        </pre>
      )}
    </div>
  );
}
