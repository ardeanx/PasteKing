'use client';

import { useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const reasons = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'MALWARE_OR_PHISHING', label: 'Malware or Phishing' },
  { value: 'CREDENTIAL_OR_SECRET_EXPOSURE', label: 'Credential / Secret Exposure' },
  { value: 'ILLEGAL_OR_HARMFUL_CONTENT', label: 'Illegal or Harmful Content' },
  { value: 'HARASSMENT_OR_ABUSE', label: 'Harassment or Abuse' },
  { value: 'COPYRIGHT_OR_SENSITIVE_MATERIAL', label: 'Copyright / Sensitive Material' },
  { value: 'OTHER', label: 'Other' },
];

export default function ReportAbusePage() {
  const [pasteUrl, setPasteUrl] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    // Extract paste ID from URL or use as-is
    let pasteId = pasteUrl.trim();
    const match = pasteId.match(/\/p\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) pasteId = match[1];

    if (!pasteId || !reason) {
      setErrorMsg('Please provide a paste URL and select a reason.');
      setStatus('error');
      return;
    }

    try {
      const res = await fetch(`${API}/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pasteId, reason, description: description || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Error ${res.status}`);
      }
      setStatus('success');
      setPasteUrl('');
      setReason('');
      setDescription('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit report');
      setStatus('error');
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Report Abuse</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        If you&apos;ve found content on PasteKing that violates our{' '}
        <Link href="/terms" style={{ color: 'var(--accent)' }}>
          Terms of Service
        </Link>
        , please report it below. You must be logged in to submit a report.
      </p>

      {status === 'success' ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>
            Report submitted successfully
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Thank you for helping keep PasteKing safe. Our team will review your report.
          </p>
          <button
            onClick={() => setStatus('idle')}
            className="btn-secondary"
            style={{ marginTop: 16, fontSize: 13 }}
          >
            Submit another report
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Paste URL or ID <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <input
              type="text"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="https://pasteking.com/p/abc123 or abc123"
              className="input"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Reason <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
              style={{ width: '100%' }}
              required
            >
              <option value="">Select a reason…</option>
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Additional details
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context or details about the issue…"
              className="input"
              rows={4}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {status === 'error' && (
            <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 12 }}>{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="btn-primary"
            style={{ width: '100%', padding: '10px 16px' }}
          >
            {status === 'loading' ? 'Submitting…' : 'Submit Report'}
          </button>
        </form>
      )}

      <div style={{ marginTop: 24, fontSize: 13, color: 'var(--muted)' }}>
        <p>
          For DMCA takedown requests, please see our{' '}
          <Link href="/dmca" style={{ color: 'var(--accent)' }}>
            DMCA Policy
          </Link>
          .
        </p>
        <p style={{ marginTop: 4 }}>
          For other inquiries, visit our{' '}
          <Link href="/contact" style={{ color: 'var(--accent)' }}>
            Contact page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
