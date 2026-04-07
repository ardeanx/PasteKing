'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const username = form.get('username') as string;
    const password = form.get('password') as string;

    try {
      const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
      const res = await fetch(`${API_URL}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, username, password }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body?.error?.message ?? 'Registration failed');
        setSubmitting(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Failed to connect to the server');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto' }}>
      <div className="card" style={{ padding: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Create Account</h1>

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
              htmlFor="email"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="username"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]+"
              className="input"
              style={{ width: '100%' }}
            />
            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
              Letters, numbers, hyphens, underscores. 3-30 characters.
            </p>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              className="input"
              style={{ width: '100%' }}
            />
            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
              At least 8 characters.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ width: '100%', fontSize: 14, padding: '10px 0' }}
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ position: 'relative', textAlign: 'center', margin: '20px 0' }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              borderTop: '1px solid var(--border)',
            }}
          />
          <span
            style={{
              position: 'relative',
              background: 'var(--surface)',
              padding: '0 10px',
              fontSize: 12,
              color: 'var(--muted)',
            }}
          >
            or continue with
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <a
            href={`${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'}/v1/auth/oauth/github`}
            className="btn-secondary"
            style={{ textAlign: 'center', textDecoration: 'none', fontSize: 13 }}
          >
            GitHub
          </a>
          <a
            href={`${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'}/v1/auth/oauth/google`}
            className="btn-secondary"
            style={{ textAlign: 'center', textDecoration: 'none', fontSize: 13 }}
          >
            Google
          </a>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 18 }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'var(--accent)' }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
