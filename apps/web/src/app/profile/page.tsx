'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface OAuthAccount {
  provider: string;
  providerId: string;
  connectedAt: string;
}

interface Profile {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  platformRole: string;
  status: string;
  hasPassword: boolean;
  oauthAccounts: OAuthAccount[];
  createdAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/v1/auth/profile`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load profile');
        return r.json();
      })
      .then((body) => {
        const p = body.data;
        setProfile(p);
        setUsername(p.username);
        setEmail(p.email);
        setAvatarUrl(p.avatarUrl ?? '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = {};
      if (username !== profile?.username) body.username = username;
      if (email !== profile?.email) body.email = email;
      if (avatarUrl !== (profile?.avatarUrl ?? '')) body.avatarUrl = avatarUrl || '';

      if (Object.keys(body).length === 0) {
        setSaveMsg('No changes to save.');
        setSaving(false);
        return;
      }

      const res = await fetch(`${API}/v1/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const rb = await res.json().catch(() => ({}));
        throw new Error(rb.message ?? 'Update failed');
      }
      const result = await res.json();
      setProfile((p) => (p ? { ...p, ...result.data } : p));
      setSaveMsg('Profile updated.');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Update failed');
    }
    setSaving(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwMsg(null);

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }

    setChangingPw(true);
    try {
      const res = await fetch(`${API}/v1/auth/profile/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const rb = await res.json().catch(() => ({}));
        throw new Error(rb.message ?? 'Password change failed');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg('Password changed successfully.');
      setTimeout(() => setPwMsg(null), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Password change failed');
    }
    setChangingPw(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
        Loading profile…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--error)' }}>
        {error ?? 'Failed to load profile.'}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Profile</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Manage your account settings and connected accounts.
      </p>

      {/* Profile info card */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Account Information</h2>
        <form onSubmit={handleSaveProfile}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Username
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%', fontSize: 13 }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Email
              </label>
              <input
                type="email"
                className="input"
                style={{ width: '100%', fontSize: 13 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Avatar URL
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%', fontSize: 13 }}
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
              />
              {avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    marginTop: 8,
                    border: '1px solid var(--border)',
                  }}
                />
              )}
            </div>
          </div>

          {saveError && (
            <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 10 }}>{saveError}</p>
          )}
          {saveMsg && (
            <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>{saveMsg}</p>
          )}

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ fontSize: 13, padding: '8px 20px' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Password section */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Change Password</h2>
        {!profile.hasPassword ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Your account uses OAuth login only. Password change is not available.
          </p>
        ) : (
          <form onSubmit={handleChangePassword}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Current Password
                </label>
                <input
                  type="password"
                  className="input"
                  style={{ width: '100%', fontSize: 13 }}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  New Password
                </label>
                <input
                  type="password"
                  className="input"
                  style={{ width: '100%', fontSize: 13 }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  className="input"
                  style={{ width: '100%', fontSize: 13 }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {pwError && (
              <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 10 }}>{pwError}</p>
            )}
            {pwMsg && (
              <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>{pwMsg}</p>
            )}

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={changingPw}
                className="btn-primary"
                style={{ fontSize: 13, padding: '8px 20px' }}
              >
                {changingPw ? 'Changing…' : 'Change Password'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* OAuth connections */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Connected Accounts</h2>
        {profile.oauthAccounts.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No OAuth accounts connected.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profile.oauthAccounts.map((acct) => (
              <div
                key={`${acct.provider}-${acct.providerId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      fontSize: 13,
                    }}
                  >
                    {acct.provider.toLowerCase()}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>ID: {acct.providerId}</span>
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Connected {new Date(acct.connectedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account metadata */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Account Details</h2>
        <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>Role</span>
            <span className="badge-default">{profile.platformRole}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>Status</span>
            <span className={profile.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}>
              {profile.status}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>Account created</span>
            <span>{new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
