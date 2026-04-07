import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We test the config module by mocking the env to point to a temp directory
describe('config', () => {
  let tempDir: string;
  let originalAppData: string | undefined;
  let originalXdgConfig: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'pk-cli-test-'));
    originalAppData = process.env['APPDATA'];
    originalXdgConfig = process.env['XDG_CONFIG_HOME'];
    // Point config to temp dir
    process.env['APPDATA'] = tempDir;
    delete process.env['XDG_CONFIG_HOME'];
  });

  afterEach(() => {
    if (originalAppData !== undefined) {
      process.env['APPDATA'] = originalAppData;
    } else {
      delete process.env['APPDATA'];
    }
    if (originalXdgConfig !== undefined) {
      process.env['XDG_CONFIG_HOME'] = originalXdgConfig;
    }
    rmSync(tempDir, { recursive: true, force: true });
    // Reset module cache for fresh imports
    vi.resetModules();
  });

  it('returns default config when no file exists', async () => {
    const { loadConfig } = await import('./config');
    const config = loadConfig();
    expect(config.apiUrl).toBe('http://localhost:4000');
    expect(config.token).toBeUndefined();
  });

  it('saves and loads config', async () => {
    const { loadConfig, saveConfig } = await import('./config');
    saveConfig({ apiUrl: 'https://api.example.com', token: 'test-token' });
    const config = loadConfig();
    expect(config.apiUrl).toBe('https://api.example.com');
    expect(config.token).toBe('test-token');
  });

  it('handles corrupted config file gracefully', async () => {
    const { mkdirSync, existsSync } = await import('node:fs');
    const configDir = join(tempDir, 'pasteking');
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.json'), 'not valid json', 'utf-8');
    const { loadConfig } = await import('./config');
    const config = loadConfig();
    expect(config.apiUrl).toBe('http://localhost:4000');
  });
});
