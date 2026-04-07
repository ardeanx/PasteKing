export interface SecretWarning {
  type: string;
  description: string;
  line: number;
}

const PATTERNS: { type: string; description: string; regex: RegExp }[] = [
  {
    type: 'aws_access_key',
    description: 'Possible AWS Access Key ID',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    type: 'github_token',
    description: 'Possible GitHub token',
    regex: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/,
  },
  {
    type: 'github_fine_grained',
    description: 'Possible GitHub fine-grained token',
    regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
  },
  {
    type: 'private_key',
    description: 'Private key block detected',
    regex: /-----BEGIN\s+(RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/,
  },
  {
    type: 'env_secret',
    description: 'Possible secret in environment variable',
    regex: /^(?:API[_-]?KEY|SECRET[_-]?KEY|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|PRIVATE[_-]?KEY|DATABASE[_-]?URL|REDIS[_-]?URL|SESSION[_-]?SECRET|JWT[_-]?SECRET|ENCRYPTION[_-]?KEY)\s*=/i,
  },
  {
    type: 'generic_secret_assignment',
    description: 'Possible secret assignment',
    regex: /(?:password|secret|token|api_key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  },
  {
    type: 'bearer_token',
    description: 'Possible Bearer token',
    regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/,
  },
  {
    type: 'jwt',
    description: 'Possible JSON Web Token',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    type: 'slack_token',
    description: 'Possible Slack token',
    regex: /\bxox[bpars]-[0-9]+-[0-9]+-[A-Za-z0-9]+\b/,
  },
  {
    type: 'stripe_key',
    description: 'Possible Stripe key',
    regex: /\b[sr]k_(live|test)_[A-Za-z0-9]{20,}\b/,
  },
];

/**
 * Scan plaintext content for common secret/token patterns.
 * Returns an array of warnings (empty = no secrets detected).
 *
 * Limitations:
 * - Pattern-based heuristic only; false positives are possible
 * - Only detects common patterns; not a comprehensive secret scanner
 * - Does NOT scan encrypted paste content (server never sees plaintext)
 */
export function scanForSecrets(content: string): SecretWarning[] {
  const warnings: SecretWarning[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        warnings.push({
          type: pattern.type,
          description: pattern.description,
          line: i + 1,
        });
      }
    }
  }

  return warnings;
}
