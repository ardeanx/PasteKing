import Link from 'next/link';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  const isLoggedIn = !!session?.value;

  // Fetch recent public pastes
  let recentPastes: {
    id: string;
    title: string | null;
    language: string | null;
    mode: string;
    createdAt: string;
  }[] = [];
  try {
    const res = await fetch(`${API_URL}/v1/pastes/recent?limit=20`, { cache: 'no-store' });
    if (res.ok) {
      const body = await res.json();
      recentPastes = (body.data ?? []).map(
        (p: {
          id: string;
          title: string | null;
          language: string | null;
          mode: string;
          createdAt: string;
        }) => ({
          id: p.id,
          title: p.title,
          language: p.language,
          mode: p.mode,
          createdAt: p.createdAt,
        }),
      );
    }
  } catch {
    // non-critical
  }

  return (
    <div>
      {/* ── Hero section ──────────────────────────────────── */}
      <section style={{ textAlign: 'center', padding: '48px 0 40px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>
          Share code &amp; text instantly
        </h1>
        <p
          style={{
            color: 'var(--muted)',
            fontSize: 16,
            maxWidth: 520,
            margin: '0 auto 28px',
            lineHeight: 1.6,
          }}
        >
          Fast, minimal paste-sharing for developers. Syntax highlighting, encryption,
          burn-after-read, and team workspaces.
        </p>

        {/* Search + New Paste */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            maxWidth: 520,
            margin: '0 auto',
            alignItems: 'center',
          }}
        >
          <form action="/search" method="get" style={{ flex: 1, display: 'flex' }}>
            <input
              name="q"
              type="text"
              placeholder="Search public pastes..."
              className="input"
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: 14,
                borderRadius: '8px 0 0 8px',
                borderRight: 'none',
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{
                borderRadius: '0 8px 8px 0',
                padding: '12px 20px',
                fontSize: 14,
                whiteSpace: 'nowrap',
              }}
            >
              Search
            </button>
          </form>
          <a
            href="/new"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: '12px 20px', fontSize: 14, whiteSpace: 'nowrap' }}
          >
            + New Paste
          </a>
        </div>

        {!isLoggedIn && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>
            <Link href="/login" style={{ color: 'var(--accent)' }}>
              Sign in
            </Link>{' '}
            for encryption, burn-after-read, expiration, private pastes, and more.
          </p>
        )}
      </section>

      {/* ── Recent Public Pastes ──────────────────────────── */}
      <section style={{ paddingTop: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Recent Public Pastes</h2>
          <Link href="/search" style={{ fontSize: 13, color: 'var(--accent)' }}>
            View all →
          </Link>
        </div>

        {recentPastes.length === 0 ? (
          <div
            className="card"
            style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}
          >
            No public pastes yet. Be the first to{' '}
            <Link href="/new" style={{ color: 'var(--accent)' }}>
              create one
            </Link>
            .
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}
          >
            {recentPastes.map((paste) => (
              <a
                key={paste.id}
                href={`/p/${paste.id}`}
                className="card"
                style={{
                  display: 'block',
                  padding: '14px 16px',
                  textDecoration: 'none',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={undefined}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--fg)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: 6,
                  }}
                >
                  {paste.title || 'Untitled'}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                  <span
                    style={{
                      background: 'var(--accent-subtle)',
                      color: 'var(--accent)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    {paste.mode.toLowerCase()}
                  </span>
                  {paste.language && (
                    <span
                      style={{
                        background: 'var(--surface)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                    >
                      {paste.language}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto' }}>
                    {new Date(paste.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
