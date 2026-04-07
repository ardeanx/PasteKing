import Link from 'next/link';

export const metadata = { title: 'Privacy Policy — PasteKing' };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
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
            1. Information We Collect
          </h2>
          <p>
            <strong>Account data:</strong> When you register, we collect your email address,
            username, and hashed password. If you use OAuth, we receive your provider ID and public
            profile info.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Content:</strong> Pastes you create, including titles, code, text, and metadata
            (language, visibility, mode). Encrypted pastes are stored as ciphertext — we cannot read
            the plaintext.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Usage data:</strong> We collect anonymized analytics including page views (with
            hashed IP addresses for privacy), paste creation timestamps, and API usage metrics.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Session data:</strong> We use session cookies to authenticate your requests. No
            third-party tracking cookies are used.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            2. How We Use Your Information
          </h2>
          <ul style={{ paddingLeft: 24 }}>
            <li>Provide, maintain, and improve the Service</li>
            <li>Authenticate your identity and manage sessions</li>
            <li>Enforce our Terms of Service and prevent abuse</li>
            <li>Send important service notifications (account security, policy changes)</li>
            <li>Generate aggregated, anonymized usage statistics</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            3. Data Storage &amp; Security
          </h2>
          <p>
            Your data is stored in PostgreSQL databases with encryption at rest. Passwords are
            hashed using bcrypt with appropriate work factors. API tokens are SHA-256 hashed;
            plaintext tokens are never stored. Session cookies use HttpOnly and Secure flags.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            4. Data Sharing
          </h2>
          <p>We do not sell your personal data. We may share data only in these circumstances:</p>
          <ul style={{ paddingLeft: 24, marginTop: 8 }}>
            <li>
              <strong>Public content:</strong> Pastes marked as PUBLIC are visible to anyone and may
              be indexed by search engines
            </li>
            <li>
              <strong>Legal requirements:</strong> If required by law, subpoena, or court order
            </li>
            <li>
              <strong>Service providers:</strong> Third-party services that help us operate (e.g.,
              payment processing via Stripe)
            </li>
            <li>
              <strong>Business transfers:</strong> In connection with a merger, acquisition, or sale
              of assets
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            5. Data Retention
          </h2>
          <p>
            Active pastes are retained until deleted by the author or removed by moderation.
            Burned-after-read pastes are permanently destroyed after first view. Expired pastes are
            cleaned up automatically. Account data is retained until you delete your account. Audit
            logs are retained for compliance purposes.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            6. Your Rights
          </h2>
          <p>You have the right to:</p>
          <ul style={{ paddingLeft: 24, marginTop: 8 }}>
            <li>Access your personal data through your profile and dashboard</li>
            <li>Update or correct your information</li>
            <li>Delete your pastes and account</li>
            <li>Export your data</li>
            <li>Object to processing of your data</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            7. Cookies
          </h2>
          <p>
            We use essential cookies only for session management. See our{' '}
            <Link href="/cookies" style={{ color: 'var(--accent)' }}>
              Cookie Policy
            </Link>{' '}
            for details.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            8. Children&apos;s Privacy
          </h2>
          <p>
            The Service is not intended for children under 13. We do not knowingly collect personal
            information from children under 13. If you believe a child has provided us personal
            information, please contact us.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            9. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify users of material
            changes via the Service or email. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            10. Contact
          </h2>
          <p>
            For privacy-related inquiries, please visit our{' '}
            <Link href="/contact" style={{ color: 'var(--accent)' }}>
              Contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
