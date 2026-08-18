#!/usr/bin/env node
// gsd-hook-version: 2.0.0
// GSD Secrets Guard — PreToolUse hook (raiz del ecosistema)
//
// [0036] Version 2: cubre ademas de Write/Edit/MultiEdit los comandos de
// terminal (Bash), que era el hueco detectado en la auditoria del 2026-08-03.
//
// FILOSOFIA (rule secrets.md, politica 0036):
//   USAR una credencial es LIBRE y no se pregunta. Lo que se bloquea es que
//   SALGA hacia un sitio publicable: un archivo versionado, la pantalla, un log
//   o el historial de la shell.
//
//   Por eso este hook NO mira si se lee el silo (leerlo es legitimo y no se
//   pregunta). Mira si un VALOR con forma de credencial viaja hacia una salida
//   publicable.
//
// Bloquea con exit(2). Ante duda, PERMITE: un falso positivo cuesta mas que el
// caso raro que se escape, porque hay dos capas mas debajo (.gitignore y el
// pre-commit).
//
// Escape declarado: ECO_SECRETS_GUARD=0

const path = require('path');

if (process.env.ECO_SECRETS_GUARD === '0') process.exit(0);

// ---------------------------------------------------------------------------
// Patrones de VALOR de credencial. Todos exigen un valor real con su prefijo y
// longitud: la mera palabra "token" o "password" NO dispara nada (ese fue el
// falso positivo que bloqueo dos veces el propio plan 0036 en el wrapper).
// ---------------------------------------------------------------------------
const VALOR_CREDENCIAL = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/, label: 'clave de OpenAI' },
  { pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/, label: 'clave de Anthropic' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, label: 'clave de Google' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]{10,}/, label: 'JWT' },
  { pattern: /gh[pousr]_[a-zA-Z0-9]{30,}/, label: 'credencial de GitHub' },
  { pattern: /github_pat_[a-zA-Z0-9_]{60,}/, label: 'credencial de GitHub (fine-grained)' },
  { pattern: /sbp_[a-f0-9]{40,}/, label: 'credencial de Supabase' },
  { pattern: /AKIA[0-9A-Z]{16}/, label: 'clave de AWS' },
  { pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/, label: 'credencial de Slack' },
  { pattern: /sk_(?:live|test)_[a-zA-Z0-9]{24,}/, label: 'clave de Stripe' },
  { pattern: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]{6,}@/, label: 'cadena de conexion PostgreSQL con contrasena' },
  { pattern: /mysql:\/\/[^:\s]+:[^@\s]{6,}@/, label: 'cadena de conexion MySQL con contrasena' },
  { pattern: /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]{6,}@/, label: 'cadena de conexion MongoDB con contrasena' },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'clave privada' },
  // Asignacion con valor largo: cubre credenciales sin prefijo reconocible.
  { pattern: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][^"'\s]{12,}["']/i, label: 'credencial asignada en claro' },
];

function buscarCredencial(texto) {
  if (!texto) return [];
  const hallazgos = [];
  for (const { pattern, label } of VALOR_CREDENCIAL) {
    const m = texto.match(pattern);
    if (m) hallazgos.push({ label, muestra: m[0].slice(0, 6) + '…' });
  }
  return hallazgos;
}

function bloquear(titulo, hallazgos, consejo) {
  const msg =
    `SECRETS GUARD — ${titulo}\n` +
    hallazgos.map((h) => `  - ${h.label} (${h.muestra})`).join('\n') +
    `\n\n${consejo}\n` +
    `Recuerda: USAR credenciales es libre y no requiere permiso. Lo que no puede ` +
    `es quedar escrito donde se publique o salir por pantalla.\n` +
    `Escape declarado (justificar en el reporte): ECO_SECRETS_GUARD=0\n`;
  process.stderr.write(msg);
  process.exit(2);
}

// ---------------------------------------------------------------------------
let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const tool = data.tool_name;

    if (tool === 'Bash') return revisarBash(data);
    if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') return revisarEscritura(tool, data);
    process.exit(0);
  } catch {
    // Nunca bloquear por un fallo propio.
    process.exit(0);
  }
});

// ---------------------------------------------------------------------------
// ESCRITURA DE ARCHIVOS
// ---------------------------------------------------------------------------
function revisarEscritura(tool, data) {
  const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');
  if (!filePath) process.exit(0);

  const basename = path.basename(filePath);
  const lower = filePath.toLowerCase();

  // Destinos legitimos de credenciales: NUNCA se bloquean.
  if (basename === '.env' || /^\.env\./.test(basename)) process.exit(0);
  if (/(^|\/)\.?secrets\//.test(lower)) process.exit(0);

  // Datos de prueba: fixtures, mocks y tests.
  if (
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(lower) ||
    lower.includes('/fixtures/') ||
    lower.includes('/__mocks__/') ||
    lower.includes('/__tests__/')
  ) {
    process.exit(0);
  }

  let content = '';
  if (tool === 'Write') content = data.tool_input?.content || '';
  else if (tool === 'Edit') content = data.tool_input?.new_string || '';
  else if (tool === 'MultiEdit') content = (data.tool_input?.edits || []).map((e) => e.new_string || '').join('\n');

  const hallazgos = buscarCredencial(content);
  if (hallazgos.length) {
    bloquear(
      `${hallazgos.length} credencial(es) a punto de escribirse en ${basename}`,
      hallazgos,
      `Mueve el valor a .env o al silo .secrets/ y leelo por variable de entorno.`,
    );
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// COMANDOS DE TERMINAL
// ---------------------------------------------------------------------------
// Solo interesa el caso en que un VALOR de credencial literal viaja hacia una
// salida publicable. Leer el silo, exportar variables o autenticar una CLI son
// operaciones legitimas y pasan sin ruido.
// ---------------------------------------------------------------------------

// Lista blanca: formas conocidas de USAR credenciales correctamente.
const USO_LEGITIMO = [
  /\b(?:cat|type|Get-Content|head|tail|less|more)\b[^|;]*\.secrets[/\\]/i, // leer el silo
  /\bexport\s+[A-Z_][A-Z0-9_]*=/,                                          // exportar a entorno
  /\$env:[A-Za-z_][A-Za-z0-9_]*\s*=/,                                      // idem en PowerShell
  /\bSetEnvironmentVariable\b/,                                            // idem via .NET
  /\b(?:gh|vercel|supabase|npm|docker|aws|gcloud|az)\s+(?:auth|login|whoami|token)\b/i,
  /\bsource\s+[^|;]*\.env\b/,                                              // cargar un .env
  /\bcargar-credenciales\.ps1\b/,                                          // el script del ecosistema
];

// Sumideros publicables: donde un valor NO puede acabar.
const SUMIDERO_PUBLICABLE = [
  /\b(?:echo|printf|Write-Host|Write-Output|console\.log)\b/i,
  /\btee\b/,
  />>?\s*(?!\/dev\/null)/,       // redireccion a archivo (salvo /dev/null)
  /\|\s*(?:tee|clip|pbcopy)\b/,
  /\bcurl\b[^|;]*\b-d\b/,        // envio a un endpoint
];

function revisarBash(data) {
  const cmd = data.tool_input?.command || '';
  if (!cmd) process.exit(0);

  const hallazgos = buscarCredencial(cmd);
  if (!hallazgos.length) process.exit(0); // sin valor literal: nada que vigilar

  // Hay un valor de credencial en el comando. ¿Es un uso legitimo conocido?
  if (USO_LEGITIMO.some((re) => re.test(cmd))) process.exit(0);

  // ¿Va hacia una salida publicable?
  if (SUMIDERO_PUBLICABLE.some((re) => re.test(cmd))) {
    bloquear(
      `${hallazgos.length} credencial(es) en un comando que las expone`,
      hallazgos,
      `Pasa el valor por variable de entorno o por entrada estandar, nunca en el ` +
        `texto del comando (queda en el historial de la shell) ni hacia pantalla o archivo.`,
    );
  }

  // Valor literal como argumento visible: queda en el historial aunque no se
  // imprima. Se avisa sin bloquear — es mal habito, no fuga inmediata.
  process.stderr.write(
    `[gsd-secrets-guard AVISO] El comando lleva un valor de credencial en claro ` +
      `(${hallazgos.map((h) => h.label).join(', ')}). Queda en el historial de la shell. ` +
      `Prefiere variable de entorno.\n`,
  );
  process.exit(0);
}
