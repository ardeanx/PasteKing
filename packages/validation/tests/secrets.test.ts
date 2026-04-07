import { describe, it, expect } from 'vitest';
import { scanForSecrets } from '../src/secrets';

describe('scanForSecrets', () => {
  it('returns empty array for safe content', () => {
    expect(scanForSecrets('Hello world\nThis is safe')).toEqual([]);
  });

  it('detects AWS access keys', () => {
    const warnings = scanForSecrets('aws_key = AKIAIOSFODNN7EXAMPLE');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe('aws_access_key');
    expect(warnings[0]!.line).toBe(1);
  });

  it('detects GitHub tokens', () => {
    const warnings = scanForSecrets('token: ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    expect(warnings.some((w) => w.type === 'github_token')).toBe(true);
  });

  it('detects GitHub fine-grained tokens', () => {
    const warnings = scanForSecrets('github_pat_1234567890abcdefghijklmn');
    expect(warnings.some((w) => w.type === 'github_fine_grained')).toBe(true);
  });

  it('detects private key blocks', () => {
    const warnings = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----');
    expect(warnings.some((w) => w.type === 'private_key')).toBe(true);
    expect(warnings[0]!.line).toBe(1);
  });

  it('detects env secret assignments', () => {
    const warnings = scanForSecrets('API_KEY=sk-1234567890abcdefghij');
    expect(warnings.some((w) => w.type === 'env_secret')).toBe(true);
  });

  it('detects generic secret assignments', () => {
    const warnings = scanForSecrets('password: "my_super_secret_password"');
    expect(warnings.some((w) => w.type === 'generic_secret_assignment')).toBe(true);
  });

  it('detects bearer tokens', () => {
    const warnings = scanForSecrets('Authorization: Bearer eyJhbGciOiJIUz');
    expect(warnings.some((w) => w.type === 'bearer_token')).toBe(true);
  });

  it('detects JWTs', () => {
    const warnings = scanForSecrets('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456ghi');
    expect(warnings.some((w) => w.type === 'jwt')).toBe(true);
  });

  it('detects Slack tokens', () => {
    const warnings = scanForSecrets('xoxb-123-456-abcdef');
    expect(warnings.some((w) => w.type === 'slack_token')).toBe(true);
  });

  it('detects Stripe keys', () => {
    const warnings = scanForSecrets('sk_live_12345678901234567890ab');
    expect(warnings.some((w) => w.type === 'stripe_key')).toBe(true);
  });

  it('reports correct line numbers for multiple secrets', () => {
    const content = [
      'line 1 is safe',
      'AKIAIOSFODNN7EXAMPLE',
      'line 3 is safe',
      'password: "hunter2_long_password"',
    ].join('\n');
    const warnings = scanForSecrets(content);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(warnings.find((w) => w.type === 'aws_access_key')?.line).toBe(2);
    expect(warnings.find((w) => w.type === 'generic_secret_assignment')?.line).toBe(4);
  });

  it('handles empty content', () => {
    expect(scanForSecrets('')).toEqual([]);
  });

  it('does not false-positive on short similar strings', () => {
    // "password: "ab"" is < 8 chars so should not trigger
    const warnings = scanForSecrets('password: "ab"');
    expect(warnings.filter((w) => w.type === 'generic_secret_assignment')).toHaveLength(0);
  });
});
