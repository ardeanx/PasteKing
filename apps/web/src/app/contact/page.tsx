'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production, this would send to an API endpoint or email service
    setStatus('success');
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Contact Us</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        Have a question, feedback, or need to report an issue? Fill out the form below and
        we&apos;ll get back to you.
      </p>

      {status === 'success' ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>
            Message sent!
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Thank you for reaching out. We&apos;ll respond as soon as possible.
          </p>
          <button
            onClick={() => setStatus('idle')}
            className="btn-secondary"
            style={{ marginTop: 16, fontSize: 13 }}
          >
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 24 }}>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Name <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                style={{ width: '100%' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Email <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                style={{ width: '100%' }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Subject <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input"
              style={{ width: '100%' }}
              required
            >
              <option value="">Select a topic…</option>
              <option value="general">General Inquiry</option>
              <option value="support">Technical Support</option>
              <option value="abuse">Abuse Report</option>
              <option value="dmca">DMCA Takedown</option>
              <option value="billing">Billing Question</option>
              <option value="feature">Feature Request</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Message <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input"
              rows={6}
              style={{ width: '100%', resize: 'vertical' }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '10px 16px' }}
          >
            Send Message
          </button>
        </form>
      )}

      <div style={{ marginTop: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Quick Links</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <a href="/report-abuse" style={{ color: 'var(--accent)' }}>
              Report abusive content →
            </a>
            <a href="/dmca" style={{ color: 'var(--accent)' }}>
              DMCA takedown requests →
            </a>
            <a href="/terms" style={{ color: 'var(--accent)' }}>
              Terms of Service →
            </a>
            <a href="/privacy" style={{ color: 'var(--accent)' }}>
              Privacy Policy →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
