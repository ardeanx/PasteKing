'use client';

import { useEffect, useState } from 'react';
import { importKeyFromFragment, decryptContent } from '@pasteking/crypto/browser';

interface EncryptedContentProps {
  ciphertext: string;
  iv: string;
  version: number;
}

export function EncryptedContent({ ciphertext, iv, version }: EncryptedContentProps) {
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function decrypt() {
      try {
        const fragment = window.location.hash.slice(1); // remove leading #
        if (!fragment) {
          setError(
            'No decryption key found in URL. The key is required to view this encrypted paste.',
          );
          setLoading(false);
          return;
        }

        const key = await importKeyFromFragment(fragment);
        const decrypted = await decryptContent({ ciphertext, iv, version }, key);
        setPlaintext(decrypted);
      } catch {
        setError('Failed to decrypt. The key may be incorrect or the data may be corrupted.');
      } finally {
        setLoading(false);
      }
    }

    decrypt();
  }, [ciphertext, iv, version]);

  if (loading) {
    return (
      <div className="card" style={{ fontSize: 13, color: 'var(--muted)' }}>
        Decrypting…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: 'color-mix(in srgb, var(--error) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
          borderRadius: 10,
          padding: 16,
          fontSize: 13,
          color: 'var(--error)',
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <pre
      className="card"
      style={{
        overflow: 'auto',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      <code>{plaintext}</code>
    </pre>
  );
}
