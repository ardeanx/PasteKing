#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig, saveConfig, getConfigFilePath } from './config';
import { createClient } from './client';
import { output, outputError } from './output';
import type { OutputFormat } from './output';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { ApiError } from '@pasteking/sdk';

const MAX_CONTENT_SIZE = 500_000;

const program = new Command();

program
  .name('pasteking')
  .description('PasteKing CLI — create, retrieve, and manage pastes from the terminal')
  .version('0.0.0')
  .option('--json', 'Output in JSON format')
  .option('--api-url <url>', 'Override API URL');

function getFormat(opts: { json?: boolean }): OutputFormat {
  return opts.json ? 'json' : 'human';
}

function formatCliError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'QUOTA_EXCEEDED') {
      return `Quota exceeded: ${err.message}. Upgrade your plan at your PasteKing dashboard.`;
    }
    return `[${err.code}] ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const auth = program.command('auth').description('Manage authentication');

auth
  .command('set-token')
  .description('Store an API token for authenticated requests')
  .argument('<token>', 'API token (pk_...)')
  .action((token: string) => {
    const config = loadConfig();
    config.token = token;
    saveConfig(config);
    const format = getFormat(program.opts());
    output(
      format,
      { ok: true, configPath: getConfigFilePath() },
      `Token saved to ${getConfigFilePath()}`,
    );
  });

auth
  .command('set-url')
  .description('Set the API base URL')
  .argument('<url>', 'API base URL (e.g. https://pasteking.example.com)')
  .action((url: string) => {
    const config = loadConfig();
    config.apiUrl = url;
    saveConfig(config);
    const format = getFormat(program.opts());
    output(format, { ok: true, apiUrl: url }, `API URL set to ${url}`);
  });

auth
  .command('status')
  .description('Show current auth config (token is masked)')
  .action(() => {
    const config = loadConfig();
    const format = getFormat(program.opts());
    const masked = config.token ? config.token.slice(0, 8) + '...' : '(not set)';
    output(
      format,
      {
        apiUrl: config.apiUrl,
        token: masked,
        configPath: getConfigFilePath(),
      },
      [
        `API URL:  ${config.apiUrl}`,
        `Token:    ${masked}`,
        `Config:   ${getConfigFilePath()}`,
      ].join('\n'),
    );
  });

// ─── Paste ───────────────────────────────────────────────────────────────────

const paste = program.command('paste').description('Create, retrieve, and manage pastes');

function addPasteOpts(cmd: Command): Command {
  return cmd
    .option('-t, --title <title>', 'Paste title')
    .option('-m, --mode <mode>', 'Paste mode (TEXT, CODE, LOG, MARKDOWN)', 'TEXT')
    .option('-v, --visibility <vis>', 'Visibility (PUBLIC, UNLISTED, PRIVATE)', 'UNLISTED')
    .option('-l, --language <lang>', 'Programming language')
    .option('--burn', 'Burn after first read')
    .option('--expires <seconds>', 'Expiration in seconds');
}

addPasteOpts(
  paste
    .command('create')
    .description('Create a paste from inline text')
    .argument('<content>', 'Paste content'),
).action(async (content: string, opts) => {
  const format = getFormat(program.opts());
  const globalOpts = program.opts();
  try {
    const client = createClient(globalOpts.apiUrl);
    const res = await client.createPaste({
      content,
      title: opts.title,
      mode: opts.mode,
      visibility: opts.visibility,
      language: opts.language,
      burnAfterRead: !!opts.burn,
      expiresIn: opts.expires ? Number(opts.expires) : undefined,
    });
    const d = res.data;
    const shareUrl = `${loadConfig().apiUrl.replace(/\/+$/, '')}/p/${d.id}`;
    output(
      format,
      { ...d, shareUrl },
      [
        `Paste created: ${d.id}`,
        `URL:   ${shareUrl}`,
        d.deleteToken ? `Token: ${d.deleteToken}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  } catch (err) {
    outputError(format, formatCliError(err));
    process.exitCode = 1;
  }
});

addPasteOpts(
  paste
    .command('file')
    .description('Upload a file as a paste')
    .argument('<path>', 'Path to the file'),
).action(async (filePath: string, opts) => {
  const format = getFormat(program.opts());
  const globalOpts = program.opts();
  try {
    if (!existsSync(filePath)) {
      outputError(format, `File not found: ${filePath}`);
      process.exitCode = 1;
      return;
    }
    const stat = statSync(filePath);
    if (stat.size > MAX_CONTENT_SIZE) {
      outputError(format, `File too large (${stat.size} bytes). Max: ${MAX_CONTENT_SIZE} bytes.`);
      process.exitCode = 1;
      return;
    }
    const content = readFileSync(filePath, 'utf-8');
    const client = createClient(globalOpts.apiUrl);
    const res = await client.createPaste({
      content,
      title: opts.title ?? filePath.split(/[\\/]/).pop(),
      mode: opts.mode,
      visibility: opts.visibility,
      language: opts.language,
      burnAfterRead: !!opts.burn,
      expiresIn: opts.expires ? Number(opts.expires) : undefined,
    });
    const d = res.data;
    const shareUrl = `${loadConfig().apiUrl.replace(/\/+$/, '')}/p/${d.id}`;
    output(
      format,
      { ...d, shareUrl },
      [
        `Paste created: ${d.id}`,
        `URL:   ${shareUrl}`,
        d.deleteToken ? `Token: ${d.deleteToken}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  } catch (err) {
    outputError(format, formatCliError(err));
    process.exitCode = 1;
  }
});

addPasteOpts(paste.command('stdin').description('Pipe content from stdin')).action(async (opts) => {
  const format = getFormat(program.opts());
  const globalOpts = program.opts();
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    if (!content) {
      outputError(format, 'No input received from stdin');
      process.exitCode = 1;
      return;
    }
    if (content.length > MAX_CONTENT_SIZE) {
      outputError(
        format,
        `Input too large (${content.length} bytes). Max: ${MAX_CONTENT_SIZE} bytes.`,
      );
      process.exitCode = 1;
      return;
    }
    const client = createClient(globalOpts.apiUrl);
    const res = await client.createPaste({
      content,
      title: opts.title,
      mode: opts.mode,
      visibility: opts.visibility,
      language: opts.language,
      burnAfterRead: !!opts.burn,
      expiresIn: opts.expires ? Number(opts.expires) : undefined,
    });
    const d = res.data;
    const shareUrl = `${loadConfig().apiUrl.replace(/\/+$/, '')}/p/${d.id}`;
    output(
      format,
      { ...d, shareUrl },
      [
        `Paste created: ${d.id}`,
        `URL:   ${shareUrl}`,
        d.deleteToken ? `Token: ${d.deleteToken}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  } catch (err) {
    outputError(format, formatCliError(err));
    process.exitCode = 1;
  }
});

paste
  .command('get')
  .description('Get paste metadata and content')
  .argument('<id>', 'Paste ID')
  .action(async (id: string) => {
    const format = getFormat(program.opts());
    const globalOpts = program.opts();
    try {
      const client = createClient(globalOpts.apiUrl);
      const res = await client.getPaste(id);
      const d = res.data;
      output(
        format,
        d,
        [
          `${d.title ?? 'Untitled'} (${d.id})`,
          `Mode:       ${d.mode}`,
          `Visibility: ${d.visibility}`,
          `Status:     ${d.status}`,
          `Encrypted:  ${d.encrypted}`,
          d.language ? `Language:   ${d.language}` : null,
          d.expiresAt ? `Expires:    ${d.expiresAt}` : null,
          `Created:    ${d.createdAt}`,
          '---',
          d.content,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    } catch (err) {
      outputError(format, formatCliError(err));
      process.exitCode = 1;
    }
  });

paste
  .command('delete')
  .description('Delete a paste (requires auth or delete token)')
  .argument('<id>', 'Paste ID')
  .option('--token <deleteToken>', 'Anonymous delete token')
  .action(async (id: string, opts: { token?: string }) => {
    const format = getFormat(program.opts());
    const globalOpts = program.opts();
    try {
      const client = createClient(globalOpts.apiUrl);
      await client.deletePaste(id, opts.token);
      output(format, { ok: true, id }, `Paste ${id} deleted.`);
    } catch (err) {
      outputError(format, formatCliError(err));
      process.exitCode = 1;
    }
  });

paste
  .command('url')
  .description('Print the share URL for a paste')
  .argument('<id>', 'Paste ID')
  .action((id: string) => {
    const config = loadConfig();
    const format = getFormat(program.opts());
    const url = `${config.apiUrl.replace(/\/+$/, '')}/p/${id}`;
    output(format, { url }, url);
  });

// ─── Search ──────────────────────────────────────────────────────────────────

program
  .command('search')
  .description('Search your pastes by keyword')
  .argument('<query>', 'Search query')
  .option('--limit <n>', 'Max results (default: 20)', '20')
  .option('--offset <n>', 'Offset for pagination', '0')
  .option('-l, --language <lang>', 'Filter by language')
  .option('-m, --mode <mode>', 'Filter by mode (TEXT, CODE, LOG, MARKDOWN)')
  .action(
    async (
      query: string,
      opts: { limit: string; offset: string; language?: string; mode?: string },
    ) => {
      const format = getFormat(program.opts());
      const globalOpts = program.opts();
      try {
        const client = createClient(globalOpts.apiUrl);
        const res = await client.searchMyPastes(query, {
          limit: Number(opts.limit),
          offset: Number(opts.offset),
          language: opts.language,
          mode: opts.mode,
        });
        const data = res.data;
        if (format === 'json') {
          output(format, data, '');
        } else {
          if (data.items.length === 0) {
            output(format, data, 'No results found.');
          } else {
            const lines = [
              `Found ${data.total} result(s) (showing ${data.offset + 1}–${data.offset + data.items.length}):`,
              '',
              ...data.items.map((item) =>
                [
                  `  ${item.title || 'Untitled'} (${item.id})`,
                  `    ${[item.mode.toLowerCase(), item.visibility.toLowerCase(), item.language].filter(Boolean).join(' · ')}`,
                  `    ${new Date(item.createdAt).toLocaleString()}`,
                ].join('\n'),
              ),
              '',
              data.hasMore ? `Use --offset ${data.offset + data.items.length} to see more.` : '',
            ].filter(Boolean);
            output(format, data, lines.join('\n'));
          }
        }
      } catch (err) {
        outputError(format, formatCliError(err));
        process.exitCode = 1;
      }
    },
  );

// ─── Plan / Billing ──────────────────────────────────────────────────────────

program
  .command('plan')
  .description('Show your current plan, usage, and limits')
  .action(async () => {
    const format = getFormat(program.opts());
    const globalOpts = program.opts();
    try {
      const client = createClient(globalOpts.apiUrl);
      const { data } = await client.getBillingStatus();
      const { subscription: sub, usage } = data;

      if (format === 'json') {
        output(format, data, '');
      } else {
        const fmtBytes = (b: number) => {
          if (b < 1024) return `${b} B`;
          if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
          if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
          return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        };
        const lines = [
          `Plan:     ${sub.planName} (${sub.subscriptionStatus})`,
          sub.currentPeriodEnd
            ? `Period:   until ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
            : null,
          sub.cancelAtPeriodEnd ? `⚠  Cancels at end of period` : null,
          '',
          'Usage:',
          `  Storage:    ${fmtBytes(usage.personalStorageBytes)} / ${fmtBytes(sub.entitlements.maxPersonalStorageBytes)}`,
          `  Pastes:     ${usage.personalActivePastes} / ${sub.entitlements.maxPersonalActivePastes}`,
          `  Tokens:     ${usage.activeApiTokens} / ${sub.entitlements.maxActiveApiTokens}`,
          `  Workspaces: ${usage.workspacesOwned} / ${sub.entitlements.maxWorkspacesOwned}`,
          '',
          'Limits:',
          `  Max paste:  ${fmtBytes(sub.entitlements.maxPasteSizeBytes)}`,
          `  Max raw:    ${fmtBytes(sub.entitlements.maxRawUploadSizeBytes)}`,
        ].filter(Boolean);
        output(format, data, lines.join('\n'));
      }
    } catch (err) {
      outputError(format, formatCliError(err));
      process.exitCode = 1;
    }
  });

program.parse();
