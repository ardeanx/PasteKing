export const metadata = { title: 'DMCA Policy — PasteKing' };

export default function DmcaPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>DMCA Policy</h1>
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
            Overview
          </h2>
          <p>
            PasteKing respects the intellectual property rights of others and expects its users to
            do the same. In accordance with the Digital Millennium Copyright Act of 1998
            (&quot;DMCA&quot;), we will respond promptly to claims of copyright infringement
            committed using the Service.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            Filing a DMCA Notice
          </h2>
          <p>
            If you believe content hosted on PasteKing infringes your copyright, please submit a
            notice containing:
          </p>
          <ol style={{ paddingLeft: 24, marginTop: 8 }}>
            <li>A physical or electronic signature of the copyright owner or authorized agent</li>
            <li>Identification of the copyrighted work claimed to have been infringed</li>
            <li>
              Identification of the material to be removed, with enough detail to locate it (e.g.,
              the paste URL)
            </li>
            <li>Your contact information (name, address, phone number, email)</li>
            <li>
              A statement that you have a good faith belief that the use of the material is not
              authorized by the copyright owner
            </li>
            <li>
              A statement, under penalty of perjury, that the information in the notice is accurate
              and that you are the copyright owner or authorized to act on their behalf
            </li>
          </ol>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            How to Submit
          </h2>
          <p>
            Send your DMCA takedown notice through our{' '}
            <a href="/contact" style={{ color: 'var(--accent)' }}>
              Contact page
            </a>{' '}
            with the subject &quot;DMCA Takedown Request&quot;, or use the{' '}
            <a href="/report-abuse" style={{ color: 'var(--accent)' }}>
              Report Abuse
            </a>{' '}
            page and select &quot;Copyright / Sensitive Material&quot; as the reason.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            Our Response
          </h2>
          <p>Upon receiving a valid DMCA notice, we will:</p>
          <ul style={{ paddingLeft: 24, marginTop: 8 }}>
            <li>Remove or disable access to the allegedly infringing content</li>
            <li>Notify the content uploader of the takedown</li>
            <li>Provide the uploader with information about filing a counter-notification</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            Counter-Notification
          </h2>
          <p>
            If you believe your content was removed in error, you may file a counter-notification
            containing:
          </p>
          <ol style={{ paddingLeft: 24, marginTop: 8 }}>
            <li>Your physical or electronic signature</li>
            <li>Identification of the material that was removed and its former location</li>
            <li>
              A statement under penalty of perjury that you have a good faith belief the material
              was removed by mistake
            </li>
            <li>
              Your name, address, phone number, and a statement consenting to jurisdiction of the
              federal court in your district
            </li>
          </ol>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
            Repeat Infringers
          </h2>
          <p>
            PasteKing will terminate accounts of users who are determined to be repeat infringers.
            We may also restrict or suspend access at our discretion for users with multiple valid
            DMCA complaints.
          </p>
        </section>
      </div>
    </div>
  );
}
