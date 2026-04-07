'use client';

import { useEffect, useRef } from 'react';
import hljs from 'highlight.js';

interface SyntaxHighlightProps {
  code: string;
  language?: string | null;
}

export function SyntaxHighlightedCode({ code, language }: SyntaxHighlightProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      // Reset any previous highlight
      codeRef.current.removeAttribute('data-highlighted');
      if (language && hljs.getLanguage(language)) {
        codeRef.current.className = `language-${language}`;
      } else {
        codeRef.current.className = '';
      }
      hljs.highlightElement(codeRef.current);
    }
  }, [code, language]);

  return (
    <pre
      className="card"
      style={{
        overflow: 'auto',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
      }}
    >
      <code ref={codeRef}>{code}</code>
    </pre>
  );
}
