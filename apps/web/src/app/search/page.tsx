'use client';

import { useState, useCallback } from 'react';
import type { SearchResultItem, PaginatedSearchResponse } from '@pasteking/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type SearchScope = 'public' | 'personal';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('public');
  const [language, setLanguage] = useState('');
  const [mode, setMode] = useState('');

  const [publicResults, setPublicResults] = useState<SearchResultItem[] | null>(null);
  const [personalResults, setPersonalResults] =
    useState<PaginatedSearchResponse<SearchResultItem> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(
    async (offset = 0) => {
      if (!query.trim()) return;
      setLoading(true);
      setError(null);
      try {
        if (scope === 'public') {
          const params = new URLSearchParams({ q: query.trim(), limit: '20', offset: String(offset) });
          const res = await fetch(`${API}/v1/pastes/search?${params}`, { credentials: 'include' });
          if (!res.ok) throw new Error('Search failed');
          const body = await res.json();
          setPublicResults(body.data);
          setPersonalResults(null);
        } else {
          const params = new URLSearchParams({ q: query.trim(), limit: '20', offset: String(offset) });
          if (language) params.set('language', language);
          if (mode) params.set('mode', mode);
          const res = await fetch(`${API}/v1/pastes/search/mine?${params}`, { credentials: 'include' });
          if (!res.ok) throw new Error('Search failed');
          const body = await res.json();
          setPersonalResults(body.data);
          setPublicResults(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
      setLoading(false);
    },
    [query, scope, language, mode],
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    doSearch(0);
  }

  const items: SearchResultItem[] =
    scope === 'public' ? (publicResults ?? []) : (personalResults?.items ?? []);

  const showPagination = scope === 'personal' && personalResults;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Search Pastes</h1>

      {/* Scope Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
        <button type="button" onClick={() => { setScope('public'); setPublicResults(null); setPersonalResults(null); }}
          className={scope === 'public' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 14px' }}>
          Public
        </button>
        <button type="button" onClick={() => { setScope('personal'); setPublicResults(null); setPersonalResults(null); }}
          className={scope === 'personal' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 14px' }}>
          My Pastes
        </button>
      </div>

      <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: scope === 'personal' ? 10 : 0 }}>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={scope === 'public' ? 'Search public pastes...' : 'Search your pastes...'}
            className="input" style={{ flex: 1, fontSize: 13 }} />
          <button type="submit" disabled={loading} className="btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {scope === 'personal' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="input" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}>
              <option value="">All modes</option>
              <option value="TEXT">Text</option>
              <option value="CODE">Code</option>
              <option value="LOG">Log</option>
              <option value="MARKDOWN">Markdown</option>
            </select>
            <input type="text" value={language} onChange={(e) => setLanguage(e.target.value)}
              placeholder="Language filter..." className="input" style={{ fontSize: 12, padding: '6px 10px', width: 160 }} />
          </div>
        )}
      </form>

      {error && (
        <div style={{ background: 'color-mix(in srgb, var(--error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--error)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {showPagination && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          {personalResults.total} result{personalResults.total !== 1 ? 's' : ''} found
          {personalResults.total > 0 && ` (showing ${personalResults.offset + 1}–${personalResults.offset + personalResults.items.length})`}
        </p>
      )}

      {(publicResults !== null || personalResults !== null) && (
        items.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>No results found.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((item, idx) => (
              <a key={item.id} href={`/p/${item.id}`} style={{ display: 'block', padding: '12px 16px', borderTop: idx > 0 ? '1px solid var(--border)' : 'none', textDecoration: 'none', transition: 'background 0.15s' }} className="hover:bg-[var(--surface-hover)]">
                <div style={{ fontWeight: 500, color: 'var(--fg)', fontSize: 14 }}>{item.title || 'Untitled'}</div>
                <div style={{ marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                  <span>{item.mode.toLowerCase()}</span>
                  <span>{item.visibility.toLowerCase()}</span>
                  {item.language && <span>{item.language}</span>}
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                {item.headline && (
                  <p style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}
                    dangerouslySetInnerHTML={{
                      __html: item.headline
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/&lt;&lt;/g, '<mark>')
                        .replace(/&gt;&gt;/g, '</mark>'),
                    }}
                  />
                )}
              </a>
            ))}
          </div>
        )
      )}

      {showPagination && personalResults.total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <button type="button" disabled={personalResults.offset === 0 || loading}
            onClick={() => doSearch(Math.max(0, personalResults.offset - personalResults.limit))}
            className="btn-secondary" style={{ fontSize: 13 }}>
            Previous
          </button>
          <button type="button" disabled={!personalResults.hasMore || loading}
            onClick={() => doSearch(personalResults.offset + personalResults.limit)}
            className="btn-secondary" style={{ fontSize: 13 }}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
