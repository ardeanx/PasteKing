'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PasteMode, PasteVisibility } from '@pasteking/types';
import hljs from 'highlight.js';
import { LANGUAGES } from './languages';
import { RichTextEditor } from './rich-text-editor';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function HomePasteForm({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState('');
  const [syntaxHighlight, setSyntaxHighlight] = useState(false);
  const [formattedText, setFormattedText] = useState(false);
  const [content, setContent] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lineNumberRef = useRef<HTMLDivElement>(null);
  const richContentRef = useRef('');

  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
    if (textareaRef.current && lineNumberRef.current) {
      lineNumberRef.current.scrollTop = textareaRef.current.scrollTop;
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
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      title: (form.get('title') as string) || undefined,
      content: formattedText ? richContentRef.current : content,
      mode: form.get('mode') as string,
      visibility: form.get('visibility') as string,
      language: language || undefined,
    };

    if (!content.trim()) {
      setError('Content is required');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${API}/v1/pastes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? 'Failed to create paste');
        setSubmitting(false);
        return;
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setResult({ id: body.data.id, url: `${origin}/p/${body.data.id}` });
    } catch {
      setError('Failed to connect to server');
    }
    setSubmitting(false);
  }

  if (result) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Paste Created!</div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <code
            style={{
              background: 'var(--bg)',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              border: '1px solid var(--border)',
              flex: 1,
              maxWidth: 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.url}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(result.url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="btn-secondary"
            style={{ fontSize: 13, padding: '8px 14px' }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href={`/p/${result.id}`} className="btn-primary">
            View Paste
          </Link>
          <button onClick={() => setResult(null)} className="btn-secondary">
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center',
          }}
        >
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
              fontSize: 14,
              fontWeight: 500,
            }}
          />
        </div>

        {/* Content: rich text editor OR textarea with line numbers */}
        {formattedText ? (
          <RichTextEditor
            minHeight={isLoggedIn ? 300 : 220}
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
                rows={isLoggedIn ? 14 : 10}
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
                  minHeight: isLoggedIn ? 300 : 220,
                  position: 'relative',
                  zIndex: 2,
                }}
              />
            </div>
          </div>
        )}

        {/* Footer controls */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <select
            name="mode"
            defaultValue={PasteMode.TEXT}
            className="input"
            style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
          >
            <option value={PasteMode.TEXT}>Text</option>
            <option value={PasteMode.CODE}>Code</option>
            <option value={PasteMode.LOG}>Log</option>
            <option value={PasteMode.MARKDOWN}>Markdown</option>
          </select>

          <select
            name="visibility"
            defaultValue={PasteVisibility.PUBLIC}
            className="input"
            style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
          >
            <option value={PasteVisibility.PUBLIC}>Public</option>
            <option value={PasteVisibility.UNLISTED}>Unlisted</option>
            <option value={PasteVisibility.PRIVATE}>Private</option>
          </select>

          <select
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="input"
            style={{ width: 'auto', fontSize: 12, padding: '6px 10px', maxWidth: 150 }}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <span className="switch" style={{ transform: 'scale(0.85)' }}>
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
            <span>Formatted</span>
          </label>

          {!formattedText && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <span className="switch" style={{ transform: 'scale(0.85)' }}>
                <input
                  type="checkbox"
                  checked={syntaxHighlight}
                  onChange={(e) => setSyntaxHighlight(e.target.checked)}
                />
                <span className="switch-slider" />
              </span>
              <span>Highlight</span>
            </label>
          )}

          <div style={{ flex: 1 }} />

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ fontSize: 13 }}
          >
            {submitting ? 'Creating...' : 'Create Paste'}
          </button>
        </div>
      </div>

      {!isLoggedIn && (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
          <Link href="/login">Sign in</Link> for encryption, burn-after-read, expiration, private
          pastes, and more.
        </p>
      )}
    </form>
  );
}
