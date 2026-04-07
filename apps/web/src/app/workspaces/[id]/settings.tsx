'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  workspaceId: string;
  name: string;
  slug: string;
  isOwner: boolean;
}

export function WorkspaceSettings({
  workspaceId,
  name: initialName,
  slug: initialSlug,
  isOwner,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await fetch(`${API}/v1/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to update workspace');
      }
      setSuccess('Saved');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        'Delete this workspace? All workspace pastes will become personal pastes or be removed. This cannot be undone.',
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/v1/workspaces/${workspaceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to delete workspace');
      }
      router.push('/workspaces');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setDeleting(false);
    }
  }

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Settings</h2>

      <form onSubmit={handleSave} className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            style={{ width: '100%' }}
            required
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            Slug
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="input"
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
            required
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
          />
          <p style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
            Lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        {error && <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 8 }}>{error}</p>}
        {success && (
          <p style={{ fontSize: 13, color: 'var(--success)', marginBottom: 8 }}>{success}</p>
        )}

        <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {isOwner && (
        <div
          style={{
            border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--error)' }}>Danger zone</h3>
          <p style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
            Permanently delete this workspace and all its data.
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-danger"
            style={{ marginTop: 10, fontSize: 13 }}
          >
            {deleting ? 'Deleting…' : 'Delete workspace'}
          </button>
        </div>
      )}
    </section>
  );
}
