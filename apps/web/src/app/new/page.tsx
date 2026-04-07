'use client';

import { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createPasteSchema, scanForSecrets } from '@pasteking/validation';
import type { SecretWarning } from '@pasteking/types';
import { PasteMode, PasteVisibility } from '@pasteking/types';
import { generatePasteKey, exportKeyToFragment, encryptContent } from '@pasteking/crypto/browser';
import hljs from 'highlight.js';
import { LANGUAGES } from '../languages';
import { RichTextEditor } from '../rich-text-editor';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function NewPastePage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspaceId');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [secretWarnings, setSecretWarnings] = useState<SecretWarning[]>([]);
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [language, setLanguage] = useState('');
  const [syntaxHighlight, setSyntaxHighlight] = useState(false);
  const [content, setContent] = useState('');
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [encrypted, setEncrypted] = useState(false);
  const [formattedText, setFormattedText] = useState(false);
  const richContentRef = useRef('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lineNumberRef = useRef<HTMLDivElement>(null);

  // Sync scroll between textarea, highlight overlay, and line numbers
  const syncScroll = useCallback(() => {
    if (textareaRef.current) {
      if (overlayRef.current) {
        overlayRef.current.scrollTop = textareaRef.current.scrollTop;
        overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
      if (lineNumberRef.current) {
        lineNumberRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    }
  }, []);

  const lineCount = content ? content.split('\n').length : 1;

  const highlightedHtml = (() => {
    if (!syntaxHighlight || !content) return '';
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(content, { language }).value;
      }
      return hljs.highlightAuto(content).value;
    } catch {
      return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  })();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSecretWarnings([]);
    setPendingSubmit(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const expiresInRaw = form.get('expiresIn') as string;
    const isEncrypted = encrypted;
    const plaintextContent = formattedText ? richContentRef.current : content;

    // Client-side secret scanning for non-encrypted pastes
    if (!isEncrypted) {
      const warnings = scanForSecrets(plaintextContent);
      if (warnings.length > 0) {
        setSecretWarnings(warnings);
        setPendingSubmit(() => () => doSubmit(form, plaintextContent, isEncrypted, expiresInRaw));
        setSubmitting(false);
        return;
      }
    }

    await doSubmit(form, plaintextContent, isEncrypted, expiresInRaw);
  }

  async function doSubmit(
    form: FormData,
    plaintextContent: string,
    isEncrypted: boolean,
    expiresInRaw: string,
  ) {
    setSubmitting(true);
    setSecretWarnings([]);
    setPendingSubmit(null);

    let contentToSend = plaintextContent;
    let encryptionIv: string | undefined;
    let encryptionVersion: number | undefined;
    let keyFragment: string | undefined;

    if (isEncrypted) {
      try {
        const key = await generatePasteKey();
        keyFragment = await exportKeyToFragment(key);
        const encrypted = await encryptContent(plaintextContent, key);
        contentToSend = encrypted.ciphertext;
        encryptionIv = encrypted.iv;
        encryptionVersion = encrypted.version;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Encryption failed');
        setSubmitting(false);
        return;
      }
    }

    const raw = {
      title: (form.get('title') as string) || undefined,
      content: contentToSend,
      mode: form.get('mode') as string,
      visibility: form.get('visibility') as string,
      language: language || undefined,
      burnAfterRead,
      expiresIn: expiresInRaw ? Number(expiresInRaw) : undefined,
      encrypted: isEncrypted,
      ...(isEncrypted ? { encryptionIv, encryptionVersion } : {}),
    };

    const parsed = createPasteSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      setError(firstError ? firstError.message : 'Validation failed');
      setSubmitting(false);
      return;
    }

    try {
      const url = workspaceId
        ? `${API}/v1/workspaces/${encodeURIComponent(workspaceId)}/pastes`
        : `${API}/v1/pastes`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? 'Failed to create paste');
        setSubmitting(false);
        return;
      }
      const pasteId = body.data.id;
      const fragment = keyFragment ? `#${keyFragment}` : '';
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setShareUrl(`${origin}/p/${pasteId}${fragment}`);
      if (!isEncrypted) {
        setRawUrl(`${API}/v1/pastes/${pasteId}/raw`);
      }
      if (body.data.deleteToken) {
        setDeleteToken(body.data.deleteToken);
      }
      setCreatedId(pasteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create paste');
      setSubmitting(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (createdId) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Paste Created</h1>
        <div className="card" style={{ marginBottom: 20 }}>
          {shareUrl && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                Share URL
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <code
                  style={{
                    flex: 1,
                    background: 'var(--bg)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    border: '1px solid var(--border)',
                    wordBreak: 'break-all',
                  }}
                >
                  {shareUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(shareUrl, 'share')}
                  className="btn-secondary"
                  style={{ fontSize: 12, flexShrink: 0 }}
                >
                  {copied === 'share' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
          {rawUrl && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                Raw URL
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <code
                  style={{
                    flex: 1,
                    background: 'var(--bg)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    border: '1px solid var(--border)',
                    wordBreak: 'break-all',
                  }}
                >
                  {rawUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(rawUrl, 'raw')}
                  className="btn-secondary"
                  style={{ fontSize: 12, flexShrink: 0 }}
                >
                  {copied === 'raw' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
          {deleteToken && (
            <div>
              <p
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--warning)', marginBottom: 6 }}
              >
                Delete Token — save this, it won&apos;t be shown again
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <code
                  style={{
                    flex: 1,
                    background: 'var(--bg)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    border: '1px solid var(--border)',
                    wordBreak: 'break-all',
                  }}
                >
                  {deleteToken}
                </code>
                <button
                  onClick={() => copyToClipboard(deleteToken, 'token')}
                  className="btn-secondary"
                  style={{ fontSize: 12, flexShrink: 0 }}
                >
                  {copied === 'token' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href={`/p/${createdId}`} className="btn-primary">
            View Paste
          </a>
          <a href="/new" className="btn-secondary">
            Create Another
          </a>
        </div>
      </div>
    );
  }

  if (secretWarnings.length > 0 && pendingSubmit) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Secret Warning</h1>
        <div className="card" style={{ borderColor: 'var(--warning)', marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--warning)', marginBottom: 12 }}>
            Potential secrets detected in your paste:
          </p>
          <ul style={{ fontSize: 13, paddingLeft: 20, listStyle: 'disc' }}>
            {secretWarnings.map((w, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{w.description}</span>
                <span style={{ color: 'var(--muted)' }}> (line {w.line})</span>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            Consider encrypting this paste or removing sensitive data before sharing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              setSecretWarnings([]);
              setPendingSubmit(null);
            }}
            className="btn-secondary"
          >
            Go Back &amp; Edit
          </button>
          <button
            onClick={pendingSubmit}
            className="btn-primary"
            style={{ background: 'var(--warning)', color: '#000' }}
          >
            Publish Anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>New Paste</h1>
          {workspaceId && (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Creating in workspace{' '}
              <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{workspaceId}</span>
            </p>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--error) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: 'var(--error)',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <input
              name="title"
              type="text"
              maxLength={200}
              placeholder="Paste title (optional)"
              className="input"
              style={{
                border: 'none',
                background: 'transparent',
                padding: '4px 0',
                fontSize: 15,
                fontWeight: 500,
              }}
            />
          </div>
          {/* Content: rich text editor OR textarea with line numbers */}
          {formattedText ? (
            <RichTextEditor
              minHeight={350}
              onChange={(html) => {
                richContentRef.current = html;
              }}
            />
          ) : (
            <div style={{ display: 'flex', position: 'relative' }}>
              {/* Line numbers */}
              <div
                ref={lineNumberRef}
                aria-hidden
                style={{
                  padding: '16px 0',
                  minWidth: 48,
                  textAlign: 'right',
                  userSelect: 'none',
                  borderRight: '1px solid var(--border)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0 10px',
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      lineHeight: '1.5',
                      color: 'var(--muted)',
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Syntax highlight overlay */}
              <div style={{ flex: 1, position: 'relative' }}>
                {syntaxHighlight && content && (
                  <div
                    ref={overlayRef}
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      padding: 16,
                      overflow: 'auto',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontSize: 13,
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        background: 'transparent',
                      }}
                    >
                      <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                    </pre>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  name="content"
                  required
                  rows={16}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onScroll={syncScroll}
                  placeholder="Paste your content here..."
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: 16,
                    color: syntaxHighlight && content ? 'transparent' : 'var(--fg)',
                    caretColor: 'var(--fg)',
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    lineHeight: '1.5',
                    resize: 'vertical',
                    outline: 'none',
                    minHeight: 350,
                    position: 'relative',
                    zIndex: 2,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Options grid */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 14,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: 6,
                  color: 'var(--fg-secondary)',
                }}
              >
                Mode
              </label>
              <select
                name="mode"
                defaultValue={PasteMode.TEXT}
                className="input"
                style={{ fontSize: 13 }}
              >
                <option value={PasteMode.TEXT}>Text</option>
                <option value={PasteMode.CODE}>Code</option>
                <option value={PasteMode.LOG}>Log</option>
                <option value={PasteMode.MARKDOWN}>Markdown</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: 6,
                  color: 'var(--fg-secondary)',
                }}
              >
                Visibility
              </label>
              <select
                name="visibility"
                defaultValue={PasteVisibility.PUBLIC}
                className="input"
                style={{ fontSize: 13 }}
              >
                <option value={PasteVisibility.PUBLIC}>Public</option>
                <option value={PasteVisibility.UNLISTED}>Unlisted</option>
                <option value={PasteVisibility.PRIVATE}>Private</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: 6,
                  color: 'var(--fg-secondary)',
                }}
              >
                Language
              </label>
              <select
                name="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input"
                style={{ fontSize: 13 }}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: 6,
                  color: 'var(--fg-secondary)',
                }}
              >
                Expires
              </label>
              <select name="expiresIn" defaultValue="" className="input" style={{ fontSize: 13 }}>
                <option value="">Never</option>
                <option value="600">10 minutes</option>
                <option value="3600">1 hour</option>
                <option value="86400">1 day</option>
                <option value="604800">1 week</option>
                <option value="2592000">30 days</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <span className="switch">
                <input
                  type="checkbox"
                  checked={formattedText}
                  onChange={(e) => {
                    setFormattedText(e.target.checked);
                    if (e.target.checked) setSyntaxHighlight(false);
                  }}
                />
                <span className="switch-slider" />
              </span>
              <span>Formatted text</span>
              <span className="tooltip-wrap" onClick={(e) => e.preventDefault()}>
                <span className="tooltip-icon">i</span>
                <span className="tooltip-bubble">
                  Switch to a rich text editor with formatting toolbar
                </span>
              </span>
              {formattedText && (
                <span style={{ fontSize: 11, color: 'var(--accent)' }}>Rich Text Editor</span>
              )}
            </label>
            {!formattedText && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={syntaxHighlight}
                    onChange={(e) => setSyntaxHighlight(e.target.checked)}
                  />
                  <span className="switch-slider" />
                </span>
                <span>Syntax Highlighting</span>
                <span className="tooltip-wrap" onClick={(e) => e.preventDefault()}>
                  <span className="tooltip-icon">i</span>
                  <span className="tooltip-bubble">
                    Highlight code syntax based on the selected language
                  </span>
                </span>
                {syntaxHighlight && (
                  <span style={{ fontSize: 11, color: 'var(--accent)' }}>
                    {language ? LANGUAGES.find((l) => l.value === language)?.label : 'Auto-detect'}
                  </span>
                )}
              </label>
            )}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <span className="switch">
                <input
                  type="checkbox"
                  checked={burnAfterRead}
                  onChange={(e) => setBurnAfterRead(e.target.checked)}
                />
                <span
                  className="switch-slider"
                  style={burnAfterRead ? { background: 'var(--error)' } : undefined}
                />
              </span>
              <span>Burn after read</span>
              <span className="tooltip-wrap" onClick={(e) => e.preventDefault()}>
                <span className="tooltip-icon">i</span>
                <span className="tooltip-bubble">
                  Automatically delete this paste after it has been viewed once
                </span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                — deleted after first view
              </span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <span className="switch">
                <input
                  type="checkbox"
                  checked={encrypted}
                  onChange={(e) => setEncrypted(e.target.checked)}
                />
                <span className="switch-slider" />
              </span>
              <span>End-to-end encrypt</span>
              <span className="tooltip-wrap" onClick={(e) => e.preventDefault()}>
                <span className="tooltip-icon">i</span>
                <span className="tooltip-bubble">
                  Encrypt content so only people with the link can read it — the key never leaves
                  your browser
                </span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>— key stays in URL only</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary"
          style={{ fontSize: 14, padding: '10px 24px' }}
        >
          {submitting ? 'Creating...' : 'Create Paste'}
        </button>
      </form>
    </div>
  );
}
