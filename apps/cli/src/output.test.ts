import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { output, outputError } from './output';

describe('output', () => {
  let stdoutChunks: string[];
  let stderrChunks: string[];

  beforeEach(() => {
    stdoutChunks = [];
    stderrChunks = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdoutChunks.push(chunk.toString());
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderrChunks.push(chunk.toString());
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs JSON format', () => {
    output('json', { id: '123' }, 'human text');
    expect(stdoutChunks[0]).toContain('"id": "123"');
  });

  it('outputs human format', () => {
    output('human', { id: '123' }, 'Paste created: 123');
    expect(stdoutChunks[0]).toBe('Paste created: 123\n');
  });

  it('outputs error in JSON format', () => {
    outputError('json', 'Not found', 'NOT_FOUND');
    expect(stderrChunks[0]).toContain('"NOT_FOUND"');
  });

  it('outputs error in human format', () => {
    outputError('human', 'Something went wrong');
    expect(stderrChunks[0]).toBe('Error: Something went wrong\n');
  });
});
