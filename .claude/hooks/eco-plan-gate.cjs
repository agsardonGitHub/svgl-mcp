#!/usr/bin/env node
/**
 * [0026] eco-plan-gate — hook PreToolUse (Edit|Write|MultiEdit|NotebookEdit).
 * Garante tecnico del gate Plan Mode (plan-mode.md / prompt-bloqueo.md), con
 * comportamiento POR PERFIL via .claude/ecosystem.json:
 *
 *   estricto       → exige CURRENT_PROMPT EN_EJECUCION para editar >UMBRAL
 *                    archivos distintos en la sesion, y SIEMPRE en criticalPaths
 *   rutas-criticas → exige gate SOLO al tocar criticalPaths (1 archivo basta)
 *   solo-criticos  → avisa (nunca bloquea) al tocar criticalPaths
 *   ninguno        → exit 0 inmediato
 *
 * CALIBRACION: bloquea (exit 2) solo si ECO_GATE_ENFORCE=1. Sin esa env var,
 * opera en modo WARN (stderr + exit 0) — primera semana de rodaje.
 *
 * Exclusiones: archivos bajo .claude/, .planning/, prompts/, docs/ y *.md de
 * raiz no cuentan para el umbral (trabajo de gobierno/documentacion).
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const UMBRAL_ARCHIVOS = 3;

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch { /* sin stdin */ }
let data = {};
try { data = JSON.parse(input); } catch { /* hook llamado sin JSON */ }

const cwd = process.cwd();
const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.notebook_path)) || '';
if (!filePath) process.exit(0);

const rel = path.relative(cwd, filePath).replace(/\\/g, '/');
if (rel.startsWith('..')) process.exit(0); // fuera del repo: no es asunto de este gate

// Exclusiones de gobierno/doc
if (/^(\.claude|\.planning|prompts|docs)\//.test(rel) || /^[^/]+\.md$/.test(rel)) process.exit(0);

const manifest = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'ecosystem.json'), 'utf8')); } catch { return null; }
})();
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

const currentPrompt = (() => {
  try { return fs.readFileSync(path.join(cwd, '.planning', 'CURRENT_PROMPT.md'), 'utf8'); } catch { return ''; }
})();
const gateAbierto = /EN_EJECUCION/.test(currentPrompt);

// contador de archivos distintos editados por sesion (persistido en temp)
const sessionId = data.session_id || 'nosession';
const trackFile = path.join(os.tmpdir(), `eco-gate-${sessionId}.json`);
let tocados = [];
try { tocados = JSON.parse(fs.readFileSync(trackFile, 'utf8')); } catch { /* primera vez */ }
if (!tocados.includes(rel)) { tocados.push(rel); try { fs.writeFileSync(trackFile, JSON.stringify(tocados)); } catch { /* ignore */ } }

let violacion = null;
if (esCritico && !gateAbierto && (mode === 'estricto' || mode === 'rutas-criticas')) {
  violacion = `RUTA CRITICA "${rel}" sin gate abierto (.planning/CURRENT_PROMPT.md sin EN_EJECUCION). ` +
    `Cualquier cambio en criticalPaths exige Tier 2 minimo con Plan Mode aprobado, aunque sea 1 archivo.`;
} else if (mode === 'estricto' && !gateAbierto && tocados.length > UMBRAL_ARCHIVOS) {
  violacion = `${tocados.length} archivos editados en esta sesion sin prompt formal EN_EJECUCION ` +
    `(umbral perfil completo: ${UMBRAL_ARCHIVOS}). Crear prompt NNNN + Plan Mode antes de seguir.`;
} else if (esCritico && mode === 'solo-criticos') {
  process.stderr.write(`[eco-plan-gate AVISO] "${rel}" es RUTA CRITICA de este repo. ` +
    `Recomendado: plan inline corto (que vas a cambiar + riesgo + verificacion) y OK del admin antes de continuar.\n`);
  process.exit(0);
}

if (violacion) {
  const enforce = process.env.ECO_GATE_ENFORCE === '1';
  process.stderr.write(`[eco-plan-gate ${enforce ? 'BLOQUEO' : 'WARN (rodaje)'}] ${violacion}\n` +
    `Bypass puntual justificado: ECO_GATE_BYPASS=1 (declarar en el reporte).\n`);
  if (enforce && process.env.ECO_GATE_BYPASS !== '1') process.exit(2);
}
process.exit(0);
