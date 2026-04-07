'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'MALWARE_OR_PHISHING', label: 'Malware / Phishing' },
  { value: 'CREDENTIAL_OR_SECRET_EXPOSURE', label: 'Credential / Secret Exposure' },
  { value: 'ILLEGAL_OR_HARMFUL_CONTENT', label: 'Illegal or Harmful Content' },
  { value: 'HARASSMENT_OR_ABUSE', label: 'Harassment / Abuse' },
  { value: 'COPYRIGHT_OR_SENSITIVE_MATERIAL', label: 'Copyright / Sensitive Material' },
  { value: 'OTHER', label: 'Other' },
];

export function ReportButton({ pasteId }: { pasteId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('SPAM');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pasteId, reason, description: description || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to submit report');
      }
      setResult('success');
      setOpen(false);
    } catch (err: unknown) {
      setResult('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (result === 'success') {
    return <span style={{ fontSize: 12, color: 'var(--success)' }}>Report submitted</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="btn-ghost"
        style={{ fontSize: 13, padding: '6px 12px', color: 'var(--muted)' }}
      >
        Report
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}
        >
          <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Report Paste</h3>

            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: 6,
                  color: 'var(--fg-secondary)',
                }}
              >
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input"
                style={{ fontSize: 13 }}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: 6,
                  color: 'var(--fg-secondary)',
                }}
              >
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                className="input"
                style={{ fontSize: 13, resize: 'vertical' }}
                placeholder="Additional details..."
              />
            </div>

            {result === 'error' && (
              <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 12 }}>{errorMsg}</p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary"
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-danger" style={{ fontSize: 13 }}>
                {busy ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
