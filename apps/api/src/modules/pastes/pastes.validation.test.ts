import { describe, it, expect } from 'vitest';
import { createPasteSchema, updatePasteSchema } from '@pasteking/validation';

describe('createPasteSchema', () => {
  it('accepts valid input', () => {
    const result = createPasteSchema.safeParse({
      content: 'console.log("hello")',
      mode: 'CODE',
      visibility: 'PUBLIC',
      language: 'javascript',
      burnAfterRead: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts minimal input with defaults', () => {
    const result = createPasteSchema.safeParse({
      content: 'hello world',
      mode: 'TEXT',
      visibility: 'PUBLIC',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.burnAfterRead).toBe(false);
    }
  });

  it('rejects empty content', () => {
    const result = createPasteSchema.safeParse({
      content: '',
      mode: 'TEXT',
      visibility: 'PUBLIC',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid mode', () => {
    const result = createPasteSchema.safeParse({
      content: 'hello',
      mode: 'INVALID',
      visibility: 'PUBLIC',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid visibility', () => {
    const result = createPasteSchema.safeParse({
      content: 'hello',
      mode: 'TEXT',
      visibility: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional title', () => {
    const result = createPasteSchema.safeParse({
      title: 'My Paste',
      content: 'hello',
      mode: 'TEXT',
      visibility: 'PUBLIC',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My Paste');
    }
  });

  it('rejects title over 200 chars', () => {
    const result = createPasteSchema.safeParse({
      title: 'x'.repeat(201),
      content: 'hello',
      mode: 'TEXT',
      visibility: 'PUBLIC',
    });
    expect(result.success).toBe(false);
  });

  it('accepts expiresIn', () => {
    const result = createPasteSchema.safeParse({
      content: 'hello',
      mode: 'TEXT',
      visibility: 'PUBLIC',
      expiresIn: 3600,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative expiresIn', () => {
    const result = createPasteSchema.safeParse({
      content: 'hello',
      mode: 'TEXT',
      visibility: 'PUBLIC',
      expiresIn: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts burnAfterRead flag', () => {
    const result = createPasteSchema.safeParse({
      content: 'secret',
      mode: 'TEXT',
      visibility: 'UNLISTED',
      burnAfterRead: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.burnAfterRead).toBe(true);
    }
  });

  it('rejects expiresIn over 1 year', () => {
    const result = createPasteSchema.safeParse({
      content: 'hello',
      mode: 'TEXT',
      visibility: 'PUBLIC',
      expiresIn: 60 * 60 * 24 * 366,
    });
    expect(result.success).toBe(false);
  });

  it('accepts all visibility modes', () => {
    for (const vis of ['PUBLIC', 'UNLISTED', 'PRIVATE']) {
      const result = createPasteSchema.safeParse({
        content: 'hello',
        mode: 'TEXT',
        visibility: vis,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('updatePasteSchema', () => {
  it('accepts valid update input', () => {
    const result = updatePasteSchema.safeParse({
      content: 'updated content',
    });
    expect(result.success).toBe(true);
  });

  it('accepts update with title and language', () => {
    const result = updatePasteSchema.safeParse({
      title: 'Updated Title',
      content: 'updated content',
      language: 'python',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Updated Title');
      expect(result.data.language).toBe('python');
    }
  });

  it('rejects empty content on update', () => {
    const result = updatePasteSchema.safeParse({
      content: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects update title over 200 chars', () => {
    const result = updatePasteSchema.safeParse({
      title: 'x'.repeat(201),
      content: 'hello',
    });
    expect(result.success).toBe(false);
  });

  it('rejects update language over 50 chars', () => {
    const result = updatePasteSchema.safeParse({
      content: 'hello',
      language: 'x'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('allows optional title to be omitted', () => {
    const result = updatePasteSchema.safeParse({
      content: 'just content',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBeUndefined();
    }
  });
});
