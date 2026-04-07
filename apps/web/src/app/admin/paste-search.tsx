'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface AdminPaste {
  id: string;
  title: string | null;
  mode: string;
  visibility: string;
  status: string;
  moderationStatus: string;
  language: string | null;
  encrypted: boolean;
  authorId: string | null;
  authorUsername?: string | null;
  workspaceId: string | null;
  createdAt: string;
}

export function AdminPasteSearch() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [moderationStatus, setModerationStatus] = useState('');
  const [results, setResults] = useState<AdminPaste[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 50;

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<AdminPaste | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadPastes = useCallback(
    async (searchQuery?: string, pageNum?: number) => {
      setLoading(true);
      setError(null);
      const currentPage = pageNum ?? page;
      try {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (moderationStatus) params.set('moderationStatus', moderationStatus);
        params.set('limit', String(limit));
        params.set('offset', String(currentPage * limit));

        let endpoint: string;
        if (searchQuery?.trim()) {
          params.set('q', searchQuery.trim());
          endpoint = `${API}/v1/admin/pastes/search?${params}`;
        } else {
          endpoint = `${API}/v1/admin/pastes?${params}`;
        }

        const res = await fetch(endpoint, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load pastes');
        const body = await res.json();
        const items = body.data?.items ?? body.data ?? [];
        setResults(items);
        setTotal(body.total ?? body.data?.total ?? items.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pastes');
      }
      setLoading(false);
    },
    [status, moderationStatus, page],
  );

  useEffect(() => {
    loadPastes('', 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    loadPastes(query, 0);
  }

  async function handleDelete() {
    if (!deleteTarget || !deleteReason.trim()) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API}/v1/admin/pastes/${deleteTarget.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'DELETE_CONTENT', reason: deleteReason.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Delete failed');
      }
      setDeleteTarget(null);
      setDeleteReason('');
      loadPastes(query);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    }
    setDeleting(false);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>All Pastes</h2>

      <form
        onSubmit={handleSearch}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by content or title…"
          className="input"
          style={{ flex: 1, fontSize: 13 }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
          }}
          aria-label="Filter by status"
          className="input"
          style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="BURNED">Burned</option>
          <option value="DELETED">Deleted</option>
        </select>
        <select
          value={moderationStatus}
          onChange={(e) => {
            setModerationStatus(e.target.value);
          }}
          aria-label="Filter by moderation status"
          className="input"
          style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
        >
          <option value="">All moderation</option>
          <option value="NONE">None</option>
          <option value="PENDING_REVIEW">Pending review</option>
          <option value="HIDDEN">Hidden</option>
          <option value="DISABLED">Disabled</option>
          <option value="REMOVED">Removed</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {error && <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 8 }}>{error}</p>}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          {total} paste{total !== 1 ? 's' : ''}
          {totalPages > 1 && ` — page ${page + 1} of ${totalPages}`}
        </p>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => {
                const p = Math.max(0, page - 1);
                setPage(p);
                loadPastes(query, p);
              }}
              disabled={page === 0}
              className="btn-ghost"
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              ← Prev
            </button>
            <button
              onClick={() => {
                const p = page + 1;
                setPage(p);
                loadPastes(query, p);
              }}
              disabled={page >= totalPages - 1}
              className="btn-ghost"
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {results.length === 0 && !loading ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No pastes found.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Title / ID
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Author
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Moderation
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Visibility
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Created
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((paste) => (
                <tr key={paste.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <Link href={`/p/${paste.id}`} style={{ fontWeight: 500, color: 'var(--fg)' }}>
                      {paste.title ?? paste.id.slice(0, 10) + '…'}
                    </Link>
                    {paste.language && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>
                        {paste.language}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>
                    {paste.authorUsername ??
                      (paste.authorId ? paste.authorId.slice(0, 8) : 'guest')}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span
                      className={
                        paste.status === 'ACTIVE'
                          ? 'badge-success'
                          : paste.status === 'DELETED'
                            ? 'badge-error'
                            : 'badge-warning'
                      }
                      style={{ fontSize: 11 }}
                    >
                      {paste.status.toLowerCase()}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span
                      className={
                        paste.moderationStatus === 'NONE'
                          ? 'badge-default'
                          : paste.moderationStatus === 'REMOVED' ||
                              paste.moderationStatus === 'HIDDEN' ||
                              paste.moderationStatus === 'DISABLED'
                            ? 'badge-error'
                            : 'badge-warning'
                      }
                      style={{ fontSize: 11 }}
                    >
                      {paste.moderationStatus.toLowerCase().replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: 12 }}>
                    {paste.visibility.toLowerCase()}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: 12 }}>
                    {new Date(paste.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {paste.status !== 'DELETED' && (
                      <button
                        onClick={() => {
                          setDeleteTarget(paste);
                          setDeleteReason('');
                          setDeleteError(null);
                        }}
                        className="btn-danger"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="card" style={{ padding: 24, maxWidth: 480, width: '100%', margin: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Delete Paste</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              This will permanently remove the content of{' '}
              <strong>{deleteTarget.title ?? deleteTarget.id}</strong>. The deletion reason will be
              shown to anyone who visits this paste&apos;s link.
            </p>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Deletion reason <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. Violated terms of service — contained malware distribution links"
              className="input"
              rows={3}
              style={{ width: '100%', resize: 'vertical', marginBottom: 12 }}
              autoFocus
            />
            {deleteError && (
              <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 8 }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-ghost"
                style={{ fontSize: 13, padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !deleteReason.trim()}
                className="btn-danger"
                style={{ fontSize: 13, padding: '8px 16px' }}
              >
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
