#!/usr/bin/env node
// gsd-hook-version: 1.0.0
// GSD Secrets Guard — PreToolUse hook
//
// Scans Write/Edit content for hardcoded secrets before the write reaches disk.
// This is the ONLY hook that blocks execution (process.exit(2)) when it finds
// a likely secret. The model will see stderr and the tool call will fail.
//
// Exceptions:
//   - .env and .env.* files are always allowed (legitimate secret stores)
//   - .test.ts, fixtures/, __mocks__/ are skipped (test data)
//   - .env.example is always allowed (documentation)

const path = require('path');

const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI API key' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, label: 'Google API key' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]{10,}/, label: 'JWT token' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, label: 'GitHub personal access token' },
  { pattern: /github_pat_[a-zA-Z0-9_]{82}/, label: 'GitHub fine-grained PAT' },
  { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key ID' },
  { pattern: /postgresql:\/\/[^:]+:[^@\s]+@/, label: 'PostgreSQL connection string with password' },
  { pattern: /mysql:\/\/[^:]+:[^@\s]+@/, label: 'MySQL connection string with password' },
  { pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@\s]+@/, label: 'MongoDB connection string with password' },
  { pattern: /password\s*[:=]\s*["'][^"']{8,}["']/i, label: 'hardcoded password assignment' },
  { pattern: /secret\s*[:=]\s*["'][a-zA-Z0-9+/=]{20,}["']/i, label: 'hardcoded secret assignment' },
  // Stripe (live + test)
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, label: 'Stripe live secret key' },
  { pattern: /sk_test_[a-zA-Z0-9]{24,}/, label: 'Stripe test secret key' },
  { pattern: /pk_live_[a-zA-Z0-9]{24,}/, label: 'Stripe live publishable key' },
  // Slack
  { pattern: /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, label: 'Slack bot token' },
  { pattern: /xoxp-[0-9]+-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, label: 'Slack user token' },
  { pattern: /xoxa-[0-9]+-[a-zA-Z0-9-]+/, label: 'Slack app token' },
  // UUID hardcodeado con contexto de asignacion (evita matchear
  // UUIDs inocentes en comentarios o docs). Solo dispara si el UUID esta
  // dentro de un literal string asignado a una variable con nombre
  // sospechoso (clientId, tenantId, secret, etc.) o junto a "Bearer".
  {
    pattern: /(?:clientId|tenantId|apiKey|secret|Bearer)[\s:=]+["']?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}["']?/i,
    label: 'UUID hardcodeado en contexto de secret (posible Azure AD client_id/tenant_id)',
  },
];

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name;

    if (toolName !== 'Write' && toolName !== 'Edit' && toolName !== 'MultiEdit') {
      process.exit(0);
    }

    const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');
    if (!filePath) {
      process.exit(0);
    }

    const basename = path.basename(filePath);
    const lower = filePath.toLowerCase();

    // Always allow .env files — they are legitimate secret stores
    if (basename === '.env' || /^\.env\./.test(basename)) {
      process.exit(0);
    }

    // Skip test/fixture/mocks directories
    if (
      /\.test\.(ts|tsx|js|jsx)$/.test(lower) ||
      /\.spec\.(ts|tsx|js|jsx)$/.test(lower) ||
      lower.includes('/fixtures/') ||
      lower.includes('/__mocks__/') ||
      lower.includes('/__tests__/')
    ) {
      process.exit(0);
    }

    // Extract content being written
    let content = '';
    if (toolName === 'Write') {
      content = data.tool_input?.content || '';
    } else if (toolName === 'Edit') {
      content = data.tool_input?.new_string || '';
    } else if (toolName === 'MultiEdit') {
      const edits = data.tool_input?.edits || [];
      content = edits.map((e) => e.new_string || '').join('\n');
    }

    if (!content) {
      process.exit(0);
    }

    const found = [];
    for (const { pattern, label } of SECRET_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        // Redact the matched value for the error message
        const redacted = match[0].slice(0, 8) + '...';
        found.push(`${label} (${redacted})`);
      }
    }

    if (found.length === 0) {
      process.exit(0);
    }

    // BLOCK the write — only hook that uses exit(2)
    const msg =
      `🚨 SECRETS GUARD: Se detectaron ${found.length} posibles secrets hardcoded en ${basename}:\n` +
      found.map((f) => `  - ${f}`).join('\n') +
      `\n\nMueve los secrets a variables de entorno (.env) y leelos via process.env.* o import.meta.env.*.`;

    process.stderr.write(msg + '\n');
    process.exit(2);
  } catch {
    // Silent fail on parse errors — don't block on our own bugs
    process.exit(0);
  }
});
