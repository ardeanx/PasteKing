import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerApi } from '@/lib/api';
import './globals.css';

export const metadata: Metadata = {
  title: 'PasteKing',
  description: 'Share code snippets, text, and logs with ease',
};

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getBranding(): Promise<{ logoUrl: string | null; faviconUrl: string | null }> {
  try {
    const res = await fetch(`${API_URL}/v1/settings/branding`, { next: { revalidate: 60 } });
    if (!res.ok) return { logoUrl: null, faviconUrl: null };
    const body = await res.json();
    return body.data ?? { logoUrl: null, faviconUrl: null };
  } catch {
    return { logoUrl: null, faviconUrl: null };
  }
}

function SiteLogo({ logoUrl, size = 32 }: { logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt="PasteKing"
        style={{ width: size, height: size, borderRadius: 8, objectFit: 'contain' }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size * 0.44),
        color: 'white',
      }}
    >
      PK
    </div>
  );
}

/* ── SVG icon helpers (inline to avoid package deps) ─────────────────── */
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const icons = {
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  paste: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2 M9 2h6v4H9z',
  search: 'M11 17.25a6.25 6.25 0 110-12.5 6.25 6.25 0 010 12.5z M16 16l4.5 4.5',
  workspace:
    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  key: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  billing: 'M2 5a2 2 0 012-2h16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5z M2 10h20',
  admin:
    'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  plus: 'M12 5v14m-7-7h14',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  const isLoggedIn = !!session?.value;

  const branding = await getBranding();

  let isAdmin = false;
  let username = '';
  if (isLoggedIn) {
    try {
      const api = createServerApi(`pasteking_session=${session.value}`);
      const { data: user } = await api.getMe();
      isAdmin = user.platformRole === 'ADMIN';
      username = user.username;
    } catch {
      // session may be expired
    }
  }

  if (isLoggedIn) {
    return (
      <html lang="en">
        <head>{branding.faviconUrl && <link rel="icon" href={branding.faviconUrl} />}</head>
        <body>
          <div className="app-shell">
            {/* ── Sidebar ─────────────────────────────────────── */}
            <aside className="app-sidebar">
              <div style={{ padding: '20px 16px 12px' }}>
                <a
                  href="/"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textDecoration: 'none',
                    color: 'var(--fg)',
                  }}
                >
                  <SiteLogo logoUrl={branding.logoUrl} size={32} />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>PasteKing</span>
                </a>
              </div>

              <div style={{ padding: '8px 12px' }}>
                <a
                  href="/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ width: '100%', padding: '10px 16px', borderRadius: 8, fontSize: 13 }}
                >
                  <Icon d={icons.plus} size={16} /> New Paste
                </a>
              </div>

              <nav style={{ padding: '8px 12px', flex: 1 }}>
                <div style={{ marginBottom: 24 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '0 14px',
                      marginBottom: 6,
                    }}
                  >
                    Main
                  </p>
                  <a href="/" className="sidebar-link">
                    <Icon d={icons.home} size={16} /> Home
                  </a>
                  <a href="/dashboard" className="sidebar-link">
                    <Icon d={icons.paste} size={16} /> My Pastes
                  </a>
                  <a href="/search" className="sidebar-link">
                    <Icon d={icons.search} size={16} /> Search
                  </a>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '0 14px',
                      marginBottom: 6,
                    }}
                  >
                    Workspace
                  </p>
                  <a href="/workspaces" className="sidebar-link">
                    <Icon d={icons.workspace} size={16} /> Workspaces
                  </a>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '0 14px',
                      marginBottom: 6,
                    }}
                  >
                    Account
                  </p>
                  <a href="/tokens" className="sidebar-link">
                    <Icon d={icons.key} size={16} /> API Tokens
                  </a>
                  <a href="/profile" className="sidebar-link">
                    <Icon d={icons.workspace} size={16} /> Profile
                  </a>
                  <a href="/billing" className="sidebar-link">
                    <Icon d={icons.billing} size={16} /> Billing
                  </a>
                </div>

                {isAdmin && (
                  <div style={{ marginBottom: 24 }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '0 14px',
                        marginBottom: 6,
                      }}
                    >
                      Admin
                    </p>
                    <a href="/admin" className="sidebar-link" style={{ color: 'var(--accent)' }}>
                      <Icon d={icons.admin} size={16} /> Reports
                    </a>
                    <a
                      href="/admin/pastes"
                      className="sidebar-link"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Icon d={icons.paste} size={16} /> Manage Pastes
                    </a>
                    <a
                      href="/admin/users"
                      className="sidebar-link"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Icon d={icons.workspace} size={16} /> Manage Users
                    </a>
                    <a
                      href="/admin/flags"
                      className="sidebar-link"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Icon d={icons.search} size={16} /> Abuse Flags
                    </a>
                    <a
                      href="/admin/audit-logs"
                      className="sidebar-link"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Icon d={icons.key} size={16} /> Audit Logs
                    </a>
                    <a
                      href="/admin/settings"
                      className="sidebar-link"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Icon d={icons.billing} size={16} /> Settings
                    </a>
                  </div>
                )}
              </nav>

              {/* User footer */}
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--muted)',
                    }}
                  >
                    {username ? (username[0]?.toUpperCase() ?? '?') : '?'}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
                    {username || 'User'}
                  </span>
                </div>
                <form action="/api/logout" method="POST">
                  <button
                    type="submit"
                    className="btn-ghost"
                    style={{ padding: 6 }}
                    title="Sign out"
                  >
                    <Icon d={icons.logout} size={16} />
                  </button>
                </form>
              </div>
            </aside>

            {/* ── Main content ────────────────────────────────── */}
            <div className="app-main">
              <div className="app-content">{children}</div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  // ── Guest layout (no sidebar) ─────────────────────────────────────
  return (
    <html lang="en">
      <head>{branding.faviconUrl && <link rel="icon" href={branding.faviconUrl} />}</head>
      <body>
        <div className="app-full">
          <header style={{ borderBottom: '1px solid var(--border)', padding: '14px 24px' }}>
            <nav
              style={{
                maxWidth: 1200,
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <a
                href="/"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textDecoration: 'none',
                  color: 'var(--fg)',
                }}
              >
                <SiteLogo logoUrl={branding.logoUrl} size={32} />
                <span style={{ fontSize: 18, fontWeight: 700 }}>PasteKing</span>
              </a>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <a href="/search" className="btn-ghost">
                  Search
                </a>
                <a
                  href="/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ fontSize: 13 }}
                >
                  New Paste
                </a>
                <a href="/login" className="btn-primary" style={{ fontSize: 13 }}>
                  Sign In
                </a>
              </div>
            </nav>
          </header>
          <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: 24 }}>
            {children}
          </main>
          <footer
            style={{
              borderTop: '1px solid var(--border)',
              padding: '20px 24px',
              marginTop: 'auto',
            }}
          >
            <div
              style={{
                maxWidth: 1200,
                margin: '0 auto',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                fontSize: 12,
                color: 'var(--muted)',
              }}
            >
              <span>© {new Date().getFullYear()} PasteKing. All rights reserved.</span>
              <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <a href="/terms" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
                  Terms
                </a>
                <a href="/privacy" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
                  Privacy
                </a>
                <a href="/cookies" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
                  Cookies
                </a>
                <a href="/dmca" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
                  DMCA
                </a>
                <a href="/report-abuse" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
                  Report Abuse
                </a>
                <a href="/contact" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
                  Contact
                </a>
              </nav>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
