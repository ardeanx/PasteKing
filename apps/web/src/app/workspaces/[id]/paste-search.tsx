'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface SearchResult {
  id: string;
  title: string | null;
  mode: string;
  language?: string | null;
  createdAt: string;
  authorUsername: string | null;
}

export function WorkspacePasteSearch({ workspaceId }: { workspaceId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      const res = await fetch(`${API}/v1/workspaces/${workspaceId}/pastes/search?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Search failed');
      const body = await res.json();
      setResults(body.data.items ?? body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
    setLoading(false);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workspace pastes…"
          className="input"
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          {loading ? '…' : 'Search'}
        </button>
        {results !== null && (
          <button
            type="button"
            onClick={() => {
              setResults(null);
              setQuery('');
            }}
            className="btn-secondary"
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            Clear
          </button>
        )}
      </form>

      {error && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--error)' }}>{error}</p>}

      {results !== null && (
        <div style={{ marginTop: 10 }}>
          {results.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No results found.</p>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {results.map((item, idx) => (
                <a
                  key={item.id}
                  href={`/p/${item.id}`}
                  style={{
                    display: 'block',
                    padding: '8px 16px',
                    borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                    textDecoration: 'none',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 500, color: 'var(--fg)' }}>
                    {item.title ?? 'Untitled'}
                  </span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
                    {item.mode.toLowerCase()}
                    {item.language ? ` · ${item.language}` : ''}
                    {item.authorUsername ? ` · by ${item.authorUsername}` : ''}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
