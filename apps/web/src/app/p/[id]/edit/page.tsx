'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { updatePasteSchema } from '@pasteking/validation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function EditPastePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPaste() {
      try {
        const res = await fetch(`${API}/v1/pastes/${params.id}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          setError(res.status === 404 ? 'Paste not found' : 'Failed to load paste');
          setLoading(false);
          return;
        }
        const body = await res.json();
        const paste = body.data;
        if (paste.encrypted) {
          setError('Encrypted pastes cannot be edited');
          setLoading(false);
          return;
        }
        if (paste.burnAfterRead) {
          setError('Burn-after-read pastes cannot be edited');
          setLoading(false);
          return;
        }
        setTitle(paste.title ?? '');
        setContent(paste.content);
        setLanguage(paste.language ?? '');
      } catch {
        setError('Failed to connect to server');
      }
      setLoading(false);
    }
    loadPaste();
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const raw = {
      title: title || undefined,
      content,
      language: language || undefined,
    };

    const parsed = updatePasteSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Validation failed');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`${API}/v1/pastes/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to update paste');
      }
      router.push(`/p/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update paste');
      setSaving(false);
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>;
  }

  if (error && !content) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Edit Paste</h1>
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
        <Link href={`/p/${params.id}`} style={{ fontSize: 13, color: 'var(--muted)' }}>
          &larr; Back to paste
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <a
          href={`/p/${params.id}`}
          className="btn-ghost"
          style={{ fontSize: 13, padding: '6px 12px' }}
        >
          &larr; Back
        </a>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Edit Paste</h1>
      </div>

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
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              style={{
                border: 'none',
                background: 'transparent',
                padding: '4px 0',
                fontSize: 15,
                fontWeight: 500,
              }}
              placeholder="Untitled"
            />
          </div>
          <textarea
            required
            rows={16}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: 16,
              color: 'var(--fg)',
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              resize: 'vertical',
              outline: 'none',
              minHeight: 350,
            }}
          />
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 500,
              display: 'block',
              marginBottom: 6,
              color: 'var(--fg-secondary)',
            }}
          >
            Language
          </label>
          <input
            type="text"
            maxLength={50}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="input"
            style={{ fontSize: 13, maxWidth: 250 }}
            placeholder="e.g. javascript"
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{ fontSize: 14, padding: '10px 24px' }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <a
            href={`/p/${params.id}`}
            className="btn-secondary"
            style={{ fontSize: 14, padding: '10px 24px' }}
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
