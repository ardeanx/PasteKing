'use client';

import { useState } from 'react';

export function CopyLinkButton({ pasteId }: { pasteId: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = `${window.location.origin}/p/${pasteId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="btn-ghost"
      style={{ fontSize: 12, padding: '4px 10px' }}
    >
      {copied ? 'Copied!' : 'Copy Link'}
    </button>
  );
}
