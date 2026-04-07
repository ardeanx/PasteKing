'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function NewWorkspacePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slug, setSlug] = useState('');

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const name = form.get('name') as string;
    const slugValue = form.get('slug') as string;

    try {
      const res = await fetch(`${API}/v1/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, slug: slugValue }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? 'Failed to create workspace');
        setSubmitting(false);
        return;
      }
      router.push(`/workspaces/${body.data.id}`);
    } catch {
      setError('Failed to connect to the server');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto' }}>
      <div className="card" style={{ padding: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Create Workspace</h1>

        {error && (
          <div
            style={{
              background: 'color-mix(in srgb, var(--error) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--error)',
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="name"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Workspace Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              placeholder="My Team"
              className="input"
              style={{ width: '100%' }}
              onChange={(e) => setSlug(generateSlug(e.target.value))}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="slug"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              maxLength={50}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-team"
              className="input"
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
            />
            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ width: '100%', fontSize: 14, padding: '10px 0' }}
          >
            {submitting ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
