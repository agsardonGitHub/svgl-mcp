#!/usr/bin/env node
/**
 * [0026·0028b] eco-plan-gate — hook PreToolUse (Edit|Write|MultiEdit|NotebookEdit).
 * Garante tecnico del gate (rule gates.md), con comportamiento POR PERFIL via
 * .claude/ecosystem.json:
 *
 *   estricto       → exige gate abierto para editar >UMBRAL archivos distintos
 *                    en la sesion, y SIEMPRE en criticalPaths
 *   rutas-criticas → exige gate SOLO al tocar criticalPaths (1 archivo basta)
 *   solo-criticos  → avisa (nunca bloquea) al tocar criticalPaths
 *   ninguno        → exit 0 inmediato
 *
 * [0028b] QUE CUENTA COMO "GATE ABIERTO" — segun ECO_GATE_MODE:
 *   ia    (DEFAULT) → .planning/CURRENT_PROMPT.md con EN_EJECUCION **Y** linea
 *                     `GATE: GO ... firma=<hmac>` VALIDA (firmada por
 *                     auto-gate.cjs: veredicto de Codex, fallback Claude tras 3
 *                     caidas, u OK del admin registrado). Una linea escrita a
 *                     mano NO abre el gate.
 *   admin           → comportamiento pre-0028: basta EN_EJECUCION (rollback en
 *                     una sola variable de entorno).
 *
 * CALIBRACION: bloquea (exit 2) solo si ECO_GATE_ENFORCE=1; sin ella, modo WARN.
 * Bypass puntual justificado: ECO_GATE_BYPASS=1 (declarar en el reporte).
 *
 * Exclusiones: archivos bajo .claude/, .planning/, prompts/, docs/ y *.md de
 * raiz no cuentan para el umbral (trabajo de gobierno/documentacion).
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const UMBRAL_ARCHIVOS = 3;
const GATE_MODE = (process.env.ECO_GATE_MODE || 'ia').toLowerCase();
const ECOSYSTEM_ROOT = process.env.ECOSYSTEM_ROOT || 'C:\\dev';

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch { /* sin stdin */ }
let data = {};
try { data = JSON.parse(input); } catch { /* hook llamado sin JSON */ }

const cwd = process.cwd();
const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.notebook_path)) || '';
if (!filePath) process.exit(0);

const rel = path.relative(cwd, filePath).replace(/\\/g, '/');
if (rel.startsWith('..')) process.exit(0); // fuera del repo: no es asunto de este gate

// [0028d] stripBom: PowerShell 5.1 escribe JSON con BOM UTF-8 y JSON.parse falla
// con el. Sin esto, ~20 manifiestos del ecosistema eran ilegibles y sus repos
// "completo" degradaban silenciosamente a "dirigido" (gate mas debil del real).
function readJsonSafe(p) {
  try {
    let t = fs.readFileSync(p, 'utf8');
    if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
    return JSON.parse(t);
  } catch { return null; }
}

const manifest = readJsonSafe(path.join(cwd, '.claude', 'ecosystem.json'));
const profile = (manifest && manifest.profile) || 'dirigido';
const criticalPaths = (manifest && manifest.criticalPaths) || [];
const mode = { completo: 'estricto', dirigido: 'rutas-criticas', ligero: 'solo-criticos', exento: 'ninguno' }[profile] || 'rutas-criticas';
if (mode === 'ninguno') process.exit(0);

// glob minimo: ** = cualquier subpath, * = un segmento
function matchGlob(glob, p) {
  const rx = new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*') + '$');
  return rx.test(p) || rx.test(p + '/');
}
const esCritico = criticalPaths.some(g => matchGlob(g, rel) || rel.startsWith(g.replace(/\/?\*\*$/, '') + '/'));

// [0031a] ORDEN CORREGIDO (auditoria 0031, hueco H5): las exclusiones de
// gobierno/doc se evaluaban ANTES que criticalPaths, asi que un repo que declara
// `.claude/hooks/**` como ruta critica (governance lo hace) nunca escalaba: el
// hook salia por la exclusion. Ahora una ruta critica declarada SIEMPRE manda.
if (!esCritico && (/^(\.claude|\.planning|prompts|docs)\//.test(rel) || /^[^/]+\.md$/.test(rel))) {
  process.exit(0);
}

const currentPrompt = (() => {
  try { return fs.readFileSync(path.join(cwd, '.planning', 'CURRENT_PROMPT.md'), 'utf8'); } catch { return ''; }
})();
const enEjecucion = /EN_EJECUCION/.test(currentPrompt);

// [0028b] Validacion de la firma del gate. Se carga auto-gate.cjs (mismo
// ecosistema) solo para reutilizar verifyGateLine; si no esta disponible, se
// degrada a "falta firma" (fail-closed en modo ia) y se avisa.
function gateFirmado() {
  const modPath = path.join(ECOSYSTEM_ROOT, 'Tools', 'PlantillaRepos', 'scripts', 'utils', 'auto-gate.cjs');
  try {
    const { verifyGateLine } = require(modPath);
    // [0031a] Anti-replay: caducidad 72h + atado al numero del marcador.
    // Degradacion segura: sin numero legible se omite ese check (no bloquea).
    const num = (currentPrompt.match(/\*\*N[úu]mero:\*\*\s*(\S+)/) || [])[1];
    const opts = { maxAgeHours: 72 };
    if (num) opts.expectedPromptNumero = num;
    return verifyGateLine(currentPrompt, opts);
  } catch (e) {
    return { ok: false, reason: `auto_gate_unavailable: ${e.message}` };
  }
}

let gateAbierto;
let motivoGate = '';
if (GATE_MODE === 'admin') {
  gateAbierto = enEjecucion;
  motivoGate = enEjecucion ? '' : 'CURRENT_PROMPT.md sin EN_EJECUCION';
} else {
  const firma = enEjecucion ? gateFirmado() : { ok: false, reason: 'sin EN_EJECUCION' };
  gateAbierto = enEjecucion && firma.ok;
  if (!gateAbierto) {
    motivoGate = enEjecucion
      ? `gate sin firma valida (${firma.reason}) — abrelo con auto-gate.cjs`
      : 'CURRENT_PROMPT.md sin EN_EJECUCION';
  }
}

// contador de archivos distintos editados por sesion (persistido en temp)
const sessionId = data.session_id || 'nosession';
const trackFile = path.join(os.tmpdir(), `eco-gate-${sessionId}.json`);
let tocados = [];
try { tocados = JSON.parse(fs.readFileSync(trackFile, 'utf8')); } catch { /* primera vez */ }
if (!tocados.includes(rel)) { tocados.push(rel); try { fs.writeFileSync(trackFile, JSON.stringify(tocados)); } catch { /* ignore */ } }

let violacion = null;
if (esCritico && !gateAbierto && (mode === 'estricto' || mode === 'rutas-criticas')) {
  violacion = `RUTA CRITICA "${rel}" sin gate abierto (${motivoGate}). ` +
    `Cualquier cambio en criticalPaths exige Tier 2 minimo con gate aprobado, aunque sea 1 archivo.`;
} else if (mode === 'estricto' && !gateAbierto && tocados.length > UMBRAL_ARCHIVOS) {
  violacion = `${tocados.length} archivos editados en esta sesion sin gate abierto (${motivoGate}; ` +
    `umbral perfil completo: ${UMBRAL_ARCHIVOS}). Crear prompt NNNN + gate antes de seguir.`;
} else if (esCritico && mode === 'solo-criticos') {
  process.stderr.write(`[eco-plan-gate AVISO] "${rel}" es RUTA CRITICA de este repo. ` +
    `Recomendado: plan inline corto (que vas a cambiar + riesgo + verificacion) antes de continuar.\n`);
  process.exit(0);
}

if (violacion) {
  const enforce = process.env.ECO_GATE_ENFORCE === '1';
  process.stderr.write(`[eco-plan-gate ${enforce ? 'BLOQUEO' : 'WARN (rodaje)'}] ${violacion}\n` +
    `Abrir gate: node ${ECOSYSTEM_ROOT}\\Tools\\PlantillaRepos\\scripts\\utils\\auto-gate.cjs --plan <plan.md> --prompt-numero NNNN\n` +
    `Bypass puntual justificado: ECO_GATE_BYPASS=1 (declarar en el reporte).\n`);
  if (enforce && process.env.ECO_GATE_BYPASS !== '1') process.exit(2);
}
process.exit(0);
