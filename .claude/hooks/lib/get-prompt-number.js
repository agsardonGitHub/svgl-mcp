// get-prompt-number.js — utilidad pura para resolver el numero de prompt activo.
//
// Orden de prioridad (documentado en .claude/rules/commits.md y en el hook):
//   1. `.planning/CURRENT_PROMPT.md`
//       - Regex acepta `**Número:**` y `**Numero:**` (con y sin tilde)
//       - Tolera BOM UTF-8 y espacios/tabs entre `**Numero:**` y el valor
//   2. env `CURRENT_PROMPT_NUM` (CI / scripts)
//   3. max `NNNN[.X[a-z]]` en `prompts/in/` (filesystem fallback)
//   4. `~/.claude/current-prompt-title` (DEPRECADO — retrocompat)
//   5. `'unknown'`

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROMPT_REGEX = /\*\*N(?:ú|u)mero:\*\*[\s\t]+(\d{4}(?:\.\d+[a-z]?)?)/;

function stripBom(str) {
  if (!str) return str;
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
}

function fromCurrentPromptFile(cwd) {
  try {
    const file = path.join(cwd, '.planning', 'CURRENT_PROMPT.md');
    if (!fs.existsSync(file)) return null;
    const content = stripBom(fs.readFileSync(file, 'utf8'));
    const m = content.match(PROMPT_REGEX);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function fromEnv(env) {
  const v = (env || process.env).CURRENT_PROMPT_NUM;
  return v ? v.trim() : null;
}

function fromPromptsIn(cwd) {
  try {
    const dir = path.join(cwd, 'prompts', 'in');
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    let maxNum = 0;
    let maxSuffix = '';
    for (const f of files) {
      const m = f.match(/^(\d{4})(\.\d+[a-z]?)?/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      const suffix = m[2] || '';
      if (n > maxNum || (n === maxNum && suffix > maxSuffix)) {
        maxNum = n;
        maxSuffix = suffix;
      }
    }
    return maxNum > 0 ? String(maxNum).padStart(4, '0') + maxSuffix : null;
  } catch {
    return null;
  }
}

function fromTitleFile(homeDir) {
  try {
    const file = path.join(homeDir || os.homedir(), '.claude', 'current-prompt-title');
    if (!fs.existsSync(file)) return null;
    const content = stripBom(fs.readFileSync(file, 'utf8')).trim();
    const m = content.match(/^(\d{4}(?:\.\d+[a-z]?)?)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function getPromptNumber(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const env = opts.env || process.env;
  const homeDir = opts.homeDir || os.homedir();

  return (
    fromCurrentPromptFile(cwd) ||
    fromEnv(env) ||
    fromPromptsIn(cwd) ||
    fromTitleFile(homeDir) ||
    'unknown'
  );
}

module.exports = {
  getPromptNumber,
  fromCurrentPromptFile,
  fromEnv,
  fromPromptsIn,
  fromTitleFile,
  PROMPT_REGEX,
};
