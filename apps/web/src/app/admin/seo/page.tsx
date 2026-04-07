'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface SeoSettings {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoAuthor: string;
  seoCanonicalUrl: string;
  ogImageUrl: string;
  twitterHandle: string;
  facebookAppId: string;
  siteSchemaType: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
}

const defaults: SeoSettings = {
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  seoAuthor: '',
  seoCanonicalUrl: '',
  ogImageUrl: '',
  twitterHandle: '',
  facebookAppId: '',
  siteSchemaType: 'WebApplication',
  robotsIndex: true,
  robotsFollow: true,
};

function OgImageDropZone({
  currentUrl,
  onUpload,
}: {
  currentUrl: string;
  onUpload: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => onUpload(reader.result as string);
      reader.readAsDataURL(file);
    },
    [onUpload],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 8,
          padding: 20,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
          background: dragOver ? 'rgba(99,102,241,0.05)' : 'transparent',
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt="OG Image Preview"
            style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }}
          />
        ) : (
          <span style={{ fontSize: 28, lineHeight: 1, color: 'var(--muted)' }}>+</span>
        )}
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          {currentUrl ? 'Click or drop to replace' : 'Upload OG image (1200×630 recommended)'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {currentUrl && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpload('');
          }}
          className="btn-ghost"
          style={{ fontSize: 11, padding: '4px 8px', marginTop: 6, color: 'var(--error)' }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

export default function AdminSeoPage() {
  const [settings, setSettings] = useState<SeoSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`${API}/v1/admin/settings`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load settings');
        return r.json();
      })
      .then((body) => {
        const d = body.data ?? {};
        setSettings({
          seoTitle: d.seoTitle ?? '',
          seoDescription: d.seoDescription ?? '',
          seoKeywords: d.seoKeywords ?? '',
          seoAuthor: d.seoAuthor ?? '',
          seoCanonicalUrl: d.seoCanonicalUrl ?? '',
          ogImageUrl: d.ogImageUrl ?? '',
          twitterHandle: d.twitterHandle ?? '',
          facebookAppId: d.facebookAppId ?? '',
          siteSchemaType: d.siteSchemaType ?? 'WebApplication',
          robotsIndex: d.robotsIndex ?? true,
          robotsFollow: d.robotsFollow ?? true,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: Record<string, unknown> = {
        seoTitle: settings.seoTitle || null,
        seoDescription: settings.seoDescription || null,
        seoKeywords: settings.seoKeywords || null,
        seoAuthor: settings.seoAuthor || null,
        seoCanonicalUrl: settings.seoCanonicalUrl || null,
        ogImageUrl: settings.ogImageUrl || null,
        twitterHandle: settings.twitterHandle || null,
        facebookAppId: settings.facebookAppId || null,
        siteSchemaType: settings.siteSchemaType,
        robotsIndex: settings.robotsIndex,
        robotsFollow: settings.robotsFollow,
      };
      const res = await fetch(`${API}/v1/admin/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Save failed');
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
        Loading SEO settings…
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>SEO Settings</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Configure search engine optimization, social media cards, and structured data. Changes
          take effect on the next page load.
        </p>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--error)',
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--success)',
          }}
        >
          SEO settings saved successfully.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Basic SEO */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Basic SEO</h3>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
            Title, description, and keywords shown in search engine results.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Site Title
              </label>
              <input
                type="text"
                className="input"
                placeholder="PasteKing — Share code & text instantly"
                value={settings.seoTitle}
                onChange={(e) => setSettings((s) => ({ ...s, seoTitle: e.target.value }))}
                maxLength={200}
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Used as the default &lt;title&gt; tag and og:title ({settings.seoTitle.length}/200)
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Meta Description
              </label>
              <textarea
                className="input"
                placeholder="Fast, minimal paste-sharing for developers. Syntax highlighting, encryption, and team workspaces."
                value={settings.seoDescription}
                onChange={(e) => setSettings((s) => ({ ...s, seoDescription: e.target.value }))}
                rows={3}
                maxLength={500}
                style={{ resize: 'vertical' }}
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Shown in search results and social shares ({settings.seoDescription.length}/500)
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Keywords
              </label>
              <input
                type="text"
                className="input"
                placeholder="pastebin, code sharing, snippets, developer tools"
                value={settings.seoKeywords}
                onChange={(e) => setSettings((s) => ({ ...s, seoKeywords: e.target.value }))}
                maxLength={1000}
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Comma-separated keywords for the meta keywords tag
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Author
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="PasteKing"
                  value={settings.seoAuthor}
                  onChange={(e) => setSettings((s) => ({ ...s, seoAuthor: e.target.value }))}
                  maxLength={200}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Canonical URL
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="https://pasteking.com"
                  value={settings.seoCanonicalUrl}
                  onChange={(e) => setSettings((s) => ({ ...s, seoCanonicalUrl: e.target.value }))}
                  maxLength={500}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Open Graph & Social Media */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
            Open Graph &amp; Social Media
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
            Controls how links appear when shared on X (Twitter), Facebook, LinkedIn, etc.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                OG Image
              </label>
              <OgImageDropZone
                currentUrl={settings.ogImageUrl}
                onUpload={(url) => setSettings((s) => ({ ...s, ogImageUrl: url }))}
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Default image for social shares. Recommended size: 1200×630px.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  X (Twitter) Handle
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="@pasteking"
                  value={settings.twitterHandle}
                  onChange={(e) => setSettings((s) => ({ ...s, twitterHandle: e.target.value }))}
                  maxLength={100}
                />
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Used for twitter:site and twitter:creator tags
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Facebook App ID
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Optional"
                  value={settings.facebookAppId}
                  onChange={(e) => setSettings((s) => ({ ...s, facebookAppId: e.target.value }))}
                  maxLength={100}
                />
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Enables Facebook domain insights (optional)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Structured Data */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Structured Data</h3>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
            JSON-LD schema type used for the site&apos;s structured data.
          </p>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
              Schema Type
            </label>
            <select
              className="input"
              value={settings.siteSchemaType}
              onChange={(e) => setSettings((s) => ({ ...s, siteSchemaType: e.target.value }))}
              style={{ maxWidth: 300 }}
            >
              <option value="WebApplication">WebApplication</option>
              <option value="WebSite">WebSite</option>
              <option value="SoftwareApplication">SoftwareApplication</option>
            </select>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              The @type value in the JSON-LD structured data block
            </p>
          </div>
        </div>

        {/* Crawling & Indexing */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
            Crawling &amp; Indexing
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
            Controls how search engines interact with your site. Changes affect robots.txt and meta
            robots tags.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <div className="switch">
                <input
                  type="checkbox"
                  checked={settings.robotsIndex}
                  onChange={(e) => setSettings((s) => ({ ...s, robotsIndex: e.target.checked }))}
                />
                <span className="switch-slider" />
              </div>
              <div>
                <span style={{ fontWeight: 500 }}>Allow indexing</span>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  When enabled, search engines can index your pages (robots: index)
                </p>
              </div>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <div className="switch">
                <input
                  type="checkbox"
                  checked={settings.robotsFollow}
                  onChange={(e) => setSettings((s) => ({ ...s, robotsFollow: e.target.checked }))}
                />
                <span className="switch-slider" />
              </div>
              <div>
                <span style={{ fontWeight: 500 }}>Allow link following</span>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  When enabled, search engines can follow links on your pages (robots: follow)
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Search Result Preview</h3>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
            Approximate preview of how your site appears in search results.
          </p>
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: 16,
              maxWidth: 600,
            }}
          >
            <div style={{ fontSize: 11, color: '#202124', marginBottom: 4 }}>
              {settings.seoCanonicalUrl || 'https://pasteking.com'}
            </div>
            <div style={{ fontSize: 20, color: '#1a0dab', fontWeight: 400, marginBottom: 4 }}>
              {settings.seoTitle || 'PasteKing'}
            </div>
            <div style={{ fontSize: 14, color: '#545454', lineHeight: 1.5 }}>
              {settings.seoDescription || 'Share code snippets, text, and logs with ease.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ fontSize: 13, padding: '10px 24px' }}
          >
            {saving ? 'Saving…' : 'Save SEO Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
