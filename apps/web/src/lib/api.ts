import { PasteKingClient } from '@pasteking/sdk';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export const api = new PasteKingClient(API_URL);

export function createServerApi(cookie?: string) {
  return new PasteKingClient(API_URL, { cookie });
}
