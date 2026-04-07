export const metadata = { title: 'Cookie Policy — PasteKing' };

export default function CookiesPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Cookie Policy</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
        Last updated: April 7, 2026
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--fg-secondary)',
        }}
      >
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            What Are Cookies?
          </h2>
          <p>
            Cookies are small text files stored on your device by your web browser. They help
            websites remember information about your visit, like your login status and preferences.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            Cookies We Use
          </h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>
                    Cookie
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>
                    Purpose
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>
                    pasteking_session
                  </td>
                  <td style={{ padding: '10px 12px' }}>Essential</td>
                  <td style={{ padding: '10px 12px' }}>
                    Maintains your login session and authenticates API requests
                  </td>
                  <td style={{ padding: '10px 12px' }}>Session (configurable, default 72 hours)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            Third-Party Cookies
          </h2>
          <p>
            PasteKing does not use third-party tracking cookies, advertising cookies, or analytics
            cookies from external providers. We do not participate in ad networks or cross-site
            tracking.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            Cookie Security
          </h2>
          <p>Our session cookie is configured with:</p>
          <ul style={{ paddingLeft: 24, marginTop: 8 }}>
            <li>
              <strong>HttpOnly:</strong> Cannot be accessed by JavaScript, protecting against XSS
              attacks
            </li>
            <li>
              <strong>Secure:</strong> Only sent over HTTPS connections (in production)
            </li>
            <li>
              <strong>SameSite:</strong> Restricted to same-site requests to prevent CSRF attacks
            </li>
            <li>
              <strong>Path:</strong> Limited to the root path of the application
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            Managing Cookies
          </h2>
          <p>
            Since we only use essential cookies required for the Service to function, disabling them
            will prevent you from logging in. You can manage cookies through your browser settings.
            Logging out will invalidate your session cookie.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            Contact
          </h2>
          <p>
            For questions about our cookie practices, please visit our{' '}
            <a href="/contact" style={{ color: 'var(--accent)' }}>
              Contact page
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
