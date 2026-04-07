import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '80px 20px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 64, fontWeight: 800, color: 'var(--accent)' }}>404</h1>
      <p style={{ fontSize: 16, color: 'var(--muted)' }}>
        This paste doesn&apos;t exist or has expired.
      </p>
      <Link href="/" className="btn-primary" style={{ textDecoration: 'none', marginTop: 6 }}>
        Go Home
      </Link>
    </div>
  );
}
