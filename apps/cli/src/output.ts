import type { CliConfig } from './config';

export type OutputFormat = 'human' | 'json';

export interface CliContext {
  config: CliConfig;
  format: OutputFormat;
}

export function output(format: OutputFormat, data: unknown, humanText: string): void {
  if (format === 'json') {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    process.stdout.write(humanText + '\n');
  }
}

export function outputError(format: OutputFormat, message: string, code?: string): void {
  if (format === 'json') {
    process.stderr.write(JSON.stringify({ error: { code: code ?? 'ERROR', message } }) + '\n');
  } else {
    process.stderr.write(`Error: ${message}\n`);
  }
}
