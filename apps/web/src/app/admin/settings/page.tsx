'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface SiteSettings {
  logoUrl: string | null;
  faviconUrl: string | null;
  secretScanThreshold: number;
  excessivePasteRateWindowMs: number;
  excessivePasteRateMax: number;
  repeatedReportThreshold: number;
}

const defaults: SiteSettings = {
  logoUrl: null,
  faviconUrl: null,
  secretScanThreshold: 3,
  excessivePasteRateWindowMs: 300000,
  excessivePasteRateMax: 30,
  repeatedReportThreshold: 5,
};

function DropZone({
  label,
  currentUrl,
  onUpload,
}: {
  label: string;
  currentUrl: string | null;
  onUpload: (dataUrl: string | null) => void;
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
    <div style={{ flex: 1, minWidth: 200 }}>
      <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{label}</p>
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
          minHeight: 100,
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
            alt={label}
            style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 28, lineHeight: 1, color: 'var(--muted)' }}>+</span>
        )}
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          {currentUrl ? 'Click or drop to replace' : 'Click or drag image here'}
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
            onUpload(null);
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

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(defaults);
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
      .then((body) => setSettings({ ...defaults, ...body.data }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API}/v1/admin/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Save failed');
      }
      const body = await res.json();
      setSettings({ ...defaults, ...body.data });
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
        Loading settings…
      </div>
    );
  }

  const referenceSections = [
    {
      title: 'Platform Roles',
      items: [
        { label: 'USER', value: 'Standard access', note: 'Create, edit, delete own pastes' },
        { label: 'ADMIN', value: 'Full access', note: 'All user capabilities plus moderation' },
      ],
    },
    {
      title: 'User Status Levels',
      items: [
        { label: 'ACTIVE', value: 'Normal access', note: 'No restrictions' },
        { label: 'RESTRICTED', value: 'Limited access', note: 'No public/unlisted pastes' },
        { label: 'SUSPENDED', value: 'No access', note: 'Fully locked out' },
      ],
    },
    {
      title: 'Moderation Actions',
      items: [
        { label: 'NO_ACTION', value: 'Dismiss', note: 'Resolved with no changes' },
        { label: 'HIDE_CONTENT', value: 'Hide', note: 'Hidden from public view' },
        { label: 'DISABLE_ACCESS', value: 'Disable', note: 'Returns 403' },
        { label: 'DELETE_CONTENT', value: 'Delete', note: 'Content permanently removed' },
      ],
    },
    {
      title: 'Paste Visibility Options',
      items: [
        { label: 'PUBLIC', value: 'Visible to everyone', note: 'Listed in search' },
        { label: 'UNLISTED', value: 'Accessible via link', note: 'Not listed publicly' },
        { label: 'PRIVATE', value: 'Author only', note: 'Requires auth' },
        { label: 'WORKSPACE', value: 'Workspace members', note: 'Scoped to workspace' },
      ],
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Platform Settings</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Configure branding and abuse detection thresholds.
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
          Settings saved successfully.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Branding */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Branding</h3>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
            Upload a logo and favicon to apply across the entire platform.
          </p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <DropZone
              label="Logo"
              currentUrl={settings.logoUrl}
              onUpload={(url) => setSettings((s) => ({ ...s, logoUrl: url }))}
            />
            <DropZone
              label="Favicon"
              currentUrl={settings.faviconUrl}
              onUpload={(url) => setSettings((s) => ({ ...s, faviconUrl: url }))}
            />
          </div>
        </div>

        {/* Abuse Detection Thresholds */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
            Abuse Detection Thresholds
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
            Configure automated abuse detection limits. Changes take effect immediately.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Secret Scan Threshold
              </label>
              <input
                type="number"
                min={1}
                className="input"
                style={{ width: '100%', fontSize: 13 }}
                value={settings.secretScanThreshold}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    secretScanThreshold: parseInt(e.target.value) || 1,
                  }))
                }
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Flags pastes with this many secret-like patterns
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Rate Window (ms)
              </label>
              <input
                type="number"
                min={1000}
                step={1000}
                className="input"
                style={{ width: '100%', fontSize: 13 }}
                value={settings.excessivePasteRateWindowMs}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    excessivePasteRateWindowMs: parseInt(e.target.value) || 60000,
                  }))
                }
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Rolling window for paste rate limiting (
                {Math.round(settings.excessivePasteRateWindowMs / 60000)} min)
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Max Pastes per Window
              </label>
              <input
                type="number"
                min={1}
                className="input"
                style={{ width: '100%', fontSize: 13 }}
                value={settings.excessivePasteRateMax}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    excessivePasteRateMax: parseInt(e.target.value) || 10,
                  }))
                }
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Triggers rate-limit flag when exceeded
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Report Threshold
              </label>
              <input
                type="number"
                min={1}
                className="input"
                style={{ width: '100%', fontSize: 13 }}
                value={settings.repeatedReportThreshold}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    repeatedReportThreshold: parseInt(e.target.value) || 3,
                  }))
                }
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Auto-flags content after this many reports
              </p>
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
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>

        {/* Reference sections (read-only) */}
        {referenceSections.map((section) => (
          <div key={section.title} className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{section.title}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
              Read-only reference
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      color: 'var(--muted)',
                      fontWeight: 500,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Setting
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      color: 'var(--muted)',
                      fontWeight: 500,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Value
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      color: 'var(--muted)',
                      fontWeight: 500,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => (
                  <tr key={item.label} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td
                      style={{
                        padding: '8px',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 12,
                      }}
                    >
                      {item.label}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 500 }}>{item.value}</td>
                    <td style={{ padding: '8px', color: 'var(--muted)' }}>{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
