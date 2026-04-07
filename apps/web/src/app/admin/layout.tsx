import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');

  if (!session?.value) {
    redirect('/login');
  }

  // Verify admin role
  const api = createServerApi(`pasteking_session=${session.value}`);
  try {
    const { data: user } = await api.getMe();
    if (user.platformRole !== 'ADMIN') {
      redirect('/dashboard');
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 14,
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Admin</h1>
        <nav style={{ display: 'flex', gap: 6 }}>
          {[
            { href: '/admin', label: 'Reports' },
            { href: '/admin/pastes', label: 'Pastes' },
            { href: '/admin/users', label: 'Users' },
            { href: '/admin/flags', label: 'Abuse Flags' },
            { href: '/admin/audit-logs', label: 'Audit Logs' },
            { href: '/admin/settings', label: 'Settings' },
            { href: '/admin/seo', label: 'SEO' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn-ghost"
              style={{ fontSize: 13, textDecoration: 'none', padding: '4px 10px' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
