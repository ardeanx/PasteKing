'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TokenItem {
  id: string;
  name: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const allScopes = ['paste:create', 'paste:read:own', 'paste:delete:own'];

  useEffect(() => {
    fetchTokens();
  }, []);

  async function fetchTokens() {
    const res = await fetch(`${API}/v1/auth/tokens`, { credentials: 'include' });
    if (res.ok) {
      const body = await res.json();
      setTokens(body.data);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewToken(null);

    const res = await fetch(`${API}/v1/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, scopes }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to create token');
      return;
    }

    const body = await res.json();
    setNewToken(body.data.token);
    setName('');
    setScopes([]);
    fetchTokens();
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this token?')) return;
    try {
      const res = await fetch(`${API}/v1/auth/tokens/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        alert('Failed to revoke token');
        return;
      }
    } catch {
      alert('Failed to revoke token');
      return;
    }
    fetchTokens();
  }

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>API Tokens</h1>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Create Token</h2>

        {error && <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 10 }}>{error}</p>}
        {newToken && (
          <div
            style={{
              background: 'color-mix(in srgb, var(--success) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
              borderRadius: 8,
              padding: 12,
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            <p style={{ fontWeight: 500, color: 'var(--success)', marginBottom: 6 }}>
              Token created — copy it now, it won&apos;t be shown again:
            </p>
            <code
              style={{
                display: 'block',
                wordBreak: 'break-all',
                background: 'var(--bg)',
                borderRadius: 6,
                padding: 8,
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              {newToken}
            </code>
          </div>
        )}

        <form onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Token name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
            style={{ width: '100%', fontSize: 13, marginBottom: 12 }}
          />
          <fieldset style={{ border: 'none', padding: 0, marginBottom: 14 }}>
            <legend
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}
            >
              Scopes (empty = full access)
            </legend>
            {allScopes.map((scope) => (
              <label
                key={scope}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  marginBottom: 4,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                />
                {scope}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn-primary" style={{ fontSize: 13 }}>
            Create Token
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          Your Tokens
        </h2>
        {loading ? (
          <p style={{ padding: 16, fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
        ) : tokens.length === 0 ? (
          <p style={{ padding: 16, fontSize: 13, color: 'var(--muted)' }}>No API tokens yet.</p>
        ) : (
          tokens.map((token, idx) => (
            <div
              key={token.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div>
                <p style={{ fontWeight: 500, fontSize: 14 }}>{token.name}</p>
                <p style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>
                  {token.scopes.length > 0 ? token.scopes.join(', ') : 'full access'}
                  {' · '}created {new Date(token.createdAt).toLocaleDateString()}
                  {token.lastUsedAt &&
                    ` · last used ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(token.id)}
                className="btn-ghost"
                style={{ fontSize: 12, color: 'var(--error)', marginLeft: 12, flexShrink: 0 }}
              >
                Revoke
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
