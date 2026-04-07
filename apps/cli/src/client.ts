import { PasteKingClient } from '@pasteking/sdk';
import { loadConfig } from './config';

export function createClient(apiUrlOverride?: string): PasteKingClient {
  const config = loadConfig();
  const apiUrl = apiUrlOverride ?? config.apiUrl;
  return new PasteKingClient(apiUrl, config.token ? { token: config.token } : undefined);
}
