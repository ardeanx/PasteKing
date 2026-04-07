'use client';

import { useRef } from 'react';
import type { Value } from 'platejs';
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  BlockquotePlugin,
} from '@platejs/basic-nodes/react';
import { ListPlugin } from '@platejs/list/react';
import { toggleList } from '@platejs/list';
import {
  Plate,
  PlateContent,
  PlateElement,
  PlateLeaf,
  usePlateEditor,
  type PlateElementProps,
  type PlateLeafProps,
} from 'platejs/react';

/* ── Element components ─────────────────────────────────────────────── */

function H1Elem(props: PlateElementProps) {
  return (
    <PlateElement
      as="h1"
      style={{ fontSize: 28, fontWeight: 700, margin: '16px 0 8px' }}
      {...props}
    />
  );
}
function H2Elem(props: PlateElementProps) {
  return (
    <PlateElement
      as="h2"
      style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 6px' }}
      {...props}
    />
  );
}
function H3Elem(props: PlateElementProps) {
  return (
    <PlateElement
      as="h3"
      style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 4px' }}
      {...props}
    />
  );
}
function BqElem(props: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      style={{
        borderLeft: '3px solid var(--accent)',
        paddingLeft: 16,
        color: 'var(--fg-secondary)',
        fontStyle: 'italic',
        margin: '8px 0',
      }}
      {...props}
    />
  );
}
function CodeLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      as="code"
      style={{
        background: 'var(--bg)',
        padding: '2px 6px',
        borderRadius: 4,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: '0.9em',
      }}
      {...props}
    />
  );
}

/* ── Toolbar button ─────────────────────────────────────────────────── */

function TBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        padding: '4px 8px',
        borderRadius: 4,
        border: 'none',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--fg-secondary)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1,
        minWidth: 28,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */

interface RichTextEditorProps {
  /** Called with serialised HTML string whenever the editor value changes */
  onChange?: (html: string) => void;
  minHeight?: number;
}

export function RichTextEditor({ onChange, minHeight = 350 }: RichTextEditorProps) {
  const htmlRef = useRef('');

  const editor = usePlateEditor({
    plugins: [
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      StrikethroughPlugin,
      CodePlugin.withComponent(CodeLeaf),
      H1Plugin.withComponent(H1Elem),
      H2Plugin.withComponent(H2Elem),
      H3Plugin.withComponent(H3Elem),
      BlockquotePlugin.withComponent(BqElem),
      ListPlugin,
    ],
  });

  function serialise(value: Value): string {
    // Convert Plate value → simple HTML for storage
    const lines: string[] = [];
    for (const node of value) {
      const n = node as Record<string, unknown>;
      const children = (n.children as Record<string, unknown>[]) ?? [];
      const inner = children
        .map((c) => {
          let t = (c.text as string) ?? '';
          // Escape HTML
          t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          if (c.bold) t = `<strong>${t}</strong>`;
          if (c.italic) t = `<em>${t}</em>`;
          if (c.underline) t = `<u>${t}</u>`;
          if (c.strikethrough) t = `<s>${t}</s>`;
          if (c.code) t = `<code>${t}</code>`;
          return t;
        })
        .join('');

      switch (n.type) {
        case 'h1':
          lines.push(`<h1>${inner}</h1>`);
          break;
        case 'h2':
          lines.push(`<h2>${inner}</h2>`);
          break;
        case 'h3':
          lines.push(`<h3>${inner}</h3>`);
          break;
        case 'blockquote':
          lines.push(`<blockquote>${inner}</blockquote>`);
          break;
        case 'ul':
        case 'ol': {
          const tag = n.type;
          const items = (n.children as Record<string, unknown>[])
            .map((li) => {
              const liInner = ((li.children as Record<string, unknown>[]) ?? [])
                .map((c) => {
                  let t = (c.text as string) ?? '';
                  t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  if (c.bold) t = `<strong>${t}</strong>`;
                  if (c.italic) t = `<em>${t}</em>`;
                  if (c.underline) t = `<u>${t}</u>`;
                  if (c.strikethrough) t = `<s>${t}</s>`;
                  if (c.code) t = `<code>${t}</code>`;
                  return t;
                })
                .join('');
              return `<li>${liInner}</li>`;
            })
            .join('');
          lines.push(`<${tag}>${items}</${tag}>`);
          break;
        }
        default:
          lines.push(`<p>${inner}</p>`);
      }
    }
    return lines.join('\n');
  }

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        const html = serialise(value);
        htmlRef.current = html;
        onChange?.(html);
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <TBtn title="Bold (Ctrl+B)" onClick={() => editor.tf.bold?.toggle()}>
          B
        </TBtn>
        <TBtn title="Italic (Ctrl+I)" onClick={() => editor.tf.italic?.toggle()}>
          <span style={{ fontStyle: 'italic' }}>I</span>
        </TBtn>
        <TBtn title="Underline (Ctrl+U)" onClick={() => editor.tf.underline?.toggle()}>
          <span style={{ textDecoration: 'underline' }}>U</span>
        </TBtn>
        <TBtn title="Strikethrough" onClick={() => editor.tf.strikethrough?.toggle()}>
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </TBtn>
        <TBtn title="Code" onClick={() => editor.tf.code?.toggle()}>
          {'</>'}
        </TBtn>

        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />

        <TBtn title="Heading 1" onClick={() => editor.tf.h1?.toggle()}>
          H1
        </TBtn>
        <TBtn title="Heading 2" onClick={() => editor.tf.h2?.toggle()}>
          H2
        </TBtn>
        <TBtn title="Heading 3" onClick={() => editor.tf.h3?.toggle()}>
          H3
        </TBtn>
        <TBtn title="Quote" onClick={() => editor.tf.blockquote?.toggle()}>
          ❝
        </TBtn>

        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />

        <TBtn title="Bullet list" onClick={() => toggleList(editor, { listStyleType: 'disc' })}>
          • List
        </TBtn>
        <TBtn
          title="Numbered list"
          onClick={() => toggleList(editor, { listStyleType: 'decimal' })}
        >
          1. List
        </TBtn>
      </div>

      {/* Editor area */}
      <PlateContent
        style={{
          padding: 16,
          minHeight,
          color: 'var(--fg)',
          fontSize: 14,
          lineHeight: '1.6',
          outline: 'none',
          fontFamily: 'inherit',
        }}
        placeholder="Write your formatted content here..."
      />
    </Plate>
  );
}
