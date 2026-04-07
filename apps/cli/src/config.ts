import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * CLI config is stored at:
 * - Linux/macOS: ~/.config/pasteking/config.json
 * - Windows:     %APPDATA%/pasteking/config.json
 */

export interface CliConfig {
  apiUrl: string;
  token?: string;
}

const DEFAULT_API_URL = 'http://localhost:4000';

function getConfigDir(): string {
  const appData = process.env['APPDATA'];
  if (appData) return join(appData, 'pasteking');
  const xdgConfig = process.env['XDG_CONFIG_HOME'];
  if (xdgConfig) return join(xdgConfig, 'pasteking');
  return join(homedir(), '.config', 'pasteking');
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export function loadConfig(): CliConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { apiUrl: DEFAULT_API_URL };
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CliConfig>;
    return { apiUrl: parsed.apiUrl ?? DEFAULT_API_URL, token: parsed.token };
  } catch {
    return { apiUrl: DEFAULT_API_URL };
  }
}

export function saveConfig(config: CliConfig): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function getConfigFilePath(): string {
  return getConfigPath();
}
