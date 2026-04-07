import Link from 'next/link';

export const metadata = { title: 'Terms of Service — PasteKing' };

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
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
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using PasteKing (&quot;the Service&quot;), you agree to be bound by
            these Terms of Service. If you do not agree, you may not use the Service. We reserve the
            right to modify these terms at any time, and continued use constitutes acceptance of
            updated terms.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            2. Description of Service
          </h2>
          <p>
            PasteKing is a platform for sharing code snippets, text, logs, and other content. The
            Service provides features including paste creation, workspaces, collaboration tools, and
            API access. We may modify, suspend, or discontinue any part of the Service at any time.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            3. User Accounts
          </h2>
          <p>
            You may create an account to access additional features. You are responsible for
            maintaining the confidentiality of your credentials and for all activities under your
            account. You must provide accurate information and promptly update it if it changes. You
            must be at least 13 years of age to use the Service.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            4. Acceptable Use
          </h2>
          <p>You agree not to use the Service to:</p>
          <ul style={{ paddingLeft: 24, marginTop: 8 }}>
            <li>
              Upload or share malware, phishing pages, or malicious code intended to harm others
            </li>
            <li>
              Store or distribute credentials, secrets, or API keys (automated scanning may flag
              such content)
            </li>
            <li>Post illegal, harmful, defamatory, obscene, or harassing content</li>
            <li>Infringe on intellectual property rights of others</li>
            <li>
              Engage in spam, automated abuse, or denial-of-service attacks against the Service
            </li>
            <li>
              Attempt to gain unauthorized access to the Service or other users&apos; accounts
            </li>
            <li>Use the Service for any purpose prohibited by applicable law</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            5. Content Ownership &amp; License
          </h2>
          <p>
            You retain ownership of content you upload. By posting content, you grant PasteKing a
            non-exclusive, worldwide, royalty-free license to store, display, and distribute your
            content as necessary to provide the Service. Public pastes may be indexed, cached, and
            shared by third parties.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            6. Content Moderation
          </h2>
          <p>
            We reserve the right to review, hide, disable, or remove any content that violates these
            terms or applicable law. Automated systems may flag content for review. Users may report
            content through the built-in reporting system. Moderation actions are logged and may
            include account restrictions or suspension.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            7. API Usage
          </h2>
          <p>
            API access is subject to rate limits and usage quotas based on your subscription plan.
            API tokens are your responsibility; do not share them. We may revoke API access for
            abuse or violations of these terms.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            8. Privacy
          </h2>
          <p>
            Your use of the Service is also governed by our{' '}
            <Link href="/privacy" style={{ color: 'var(--accent)' }}>
              Privacy Policy
            </Link>
            . Encrypted pastes are stored as ciphertext; PasteKing cannot read their plaintext
            content.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            9. Disclaimers
          </h2>
          <p>
            The Service is provided &quot;as is&quot; without warranties of any kind. We do not
            guarantee uptime, data preservation, or that the Service will meet your specific
            requirements. Use at your own risk.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            10. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, PasteKing shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising from your use of the
            Service, including but not limited to data loss, unauthorized access, or service
            interruptions.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            11. Termination
          </h2>
          <p>
            We may suspend or terminate your account at any time for violations of these terms. You
            may delete your account at any time. Upon termination, your right to use the Service
            ceases, but provisions regarding content licenses, disclaimers, and limitations of
            liability survive.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            12. Contact
          </h2>
          <p>
            For questions about these terms, please visit our{' '}
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
