#!/usr/bin/env node
/**
 * [0026·0028b·0136] eco-plan-gate — hook PreToolUse (Edit|Write|MultiEdit|NotebookEdit).
 * Garante tecnico del gate (rule gates.md), con comportamiento POR PERFIL via
 * .claude/ecosystem.json:
 *
 *   estricto       → exige gate abierto para editar >UMBRAL archivos distintos
 *                    en la sesion, y SIEMPRE en criticalPaths
 *   rutas-criticas → exige gate SOLO al tocar criticalPaths (1 archivo basta)
 *   solo-criticos  → avisa (nunca bloquea) al tocar criticalPaths
 *   ninguno        → exit 0 inmediato
 *
 * [0136] RUTAS PROTEGIDAS (A3 en vivo · ADR-ECO-002). Los archivos de plano de
 * control rigen en cuanto se guardan, y CLAUDE.md, AGENTS.md y MEMORIA.md de la
 * raiz no pasan nunca por un commit. Por eso, antes que cualquier otra regla, cada
 * escritura se clasifica con clasificarRutas() de auto-gate.cjs: plano de control,
 * globos `zonaRoja` del manifiesto de cada repo y silo de secretos (nunca la lista
 * de respaldo; los archivos del ritual, fuera). Una ruta protegida exige el
 * marcador del repo git que contiene el archivo (el de la raiz si no hay repo) con
 * EN_EJECUCION, firma valida con revisor `codex` o `admin` y la ruta declarada,
 * literal, en el plan firmado. Si falta algo, sale con 2 SIN depender de
 * ECO_GATE_ENFORCE, de ECO_GATE_MODE ni de ECO_GATE_BYPASS. Sin auto-gate.cjs (o
 * ilegible), bloquea solo lo que case con los globos fijos copiados aqui; si la
 * comprobacion de la firma lanza, bloquea. No ve lo que se escribe desde la
 * consola: eso lo para despues el pre-commit donde hay git (R15).
 *
 * [0136][seguridad] Antes de clasificar: una ruta con flujo alternativo de NTFS
 * (`:` despues de la unidad) se bloquea; el punto y el espacio finales de cada
 * nombre se quitan (Windows los ignora); y se clasifica tambien la ruta real
 * (realpathSync.native expande los nombres cortos 8.3, `CLAUDE~1` = `.claude`).
 *
 * [0028b] QUE CUENTA COMO "GATE ABIERTO" para el resto — segun ECO_GATE_MODE:
 *   ia    (DEFAULT) → .planning/CURRENT_PROMPT.md con EN_EJECUCION **Y** linea
 *                     `GATE: GO ... firma=<hmac>` VALIDA (firmada por
 *                     auto-gate.cjs: veredicto de Codex, fallback Claude en
 *                     trabajo normal, o si del CEO firmado `revisor=admin` con su
 *                     cita). Una linea escrita a mano NO abre el gate.
 *   admin           → comportamiento pre-0028: basta EN_EJECUCION (rollback en
 *                     una sola variable de entorno). No abre rutas protegidas.
 *
 * CALIBRACION: fuera de las rutas protegidas, bloquea (exit 2) solo si
 * ECO_GATE_ENFORCE=1; sin ella, modo WARN.
 * Bypass puntual justificado: ECO_GATE_BYPASS=1 (declarar en el reporte); no
 * abre rutas protegidas.
 *
 * Exclusiones: archivos bajo .claude/, .planning/, prompts/, docs/ y *.md de
 * raiz no cuentan para el umbral (trabajo de gobierno/documentacion) —
 * SALVO que sean criticalPaths declarados del repo, que siempre exigen gate
 * (candado del 0031a, repuesto en 0066 tras perderse en la sincronizacion 0052),
 * o rutas protegidas del 0136, que se comprueban antes.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// [0112] Sin la lib (un hijo a medio actualizar), lo de antes: el gate no puede
// romperse por eso, porque un hook que lanza deja pasar la edicion.
let raizEcosistema;
try { ({ raizEcosistema } = require('./lib/raiz-ecosistema.js')); } catch { raizEcosistema = () => process.env.ECOSYSTEM_ROOT || 'C:\\dev'; }

const UMBRAL_ARCHIVOS = 3;
const GATE_MODE = (process.env.ECO_GATE_MODE || 'ia').toLowerCase();

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch { /* sin stdin */ }
let data = {};
try { data = JSON.parse(input); } catch { /* hook llamado sin JSON */ }

const filePathRecibida = (data.tool_input && (data.tool_input.file_path || data.tool_input.notebook_path)) || '';
if (!filePathRecibida) process.exit(0);

function bloquear(ruta, tipo, motivo) {
  process.stderr.write(
    `[eco-plan-gate BLOQUEO] "${ruta}" es ${tipo}: ${motivo}.\n` +
      'Plano de control y zona roja exigen el marcador EN_EJECUCION con firma codex o admin ' +
      'de un plan que declare esta ruta, aunque sea un solo archivo. Sin Codex, el plan espera ' +
      'encolado a Codex o al CEO (gates.md, ADR-ECO-002). Ni ECO_GATE_BYPASS ni ECO_GATE_MODE lo abren.\n',
  );
  process.exit(2);
}

// [0136][seguridad 2] Flujo alternativo de NTFS: se bloquea siempre.
if (String(filePathRecibida).replace(/^\\\\[?.]\\/, '').replace(/^[A-Za-z]:/, '').includes(':')) {
  bloquear(String(filePathRecibida), 'una ruta con flujo alternativo de NTFS', "':' despues de la unidad; no se escribe nunca por aqui");
}

// [0136][seguridad 2] Windows ignora el punto y el espacio finales de cada nombre.
function sinPuntosFinales(p) {
  const abs = path.resolve(String(p || ''));
  const vol = path.parse(abs).root;
  const resto = abs.slice(vol.length).split(/[\\/]+/).filter(Boolean).map((seg) => {
    if (seg === '.' || seg === '..') return seg;
    const s = seg.replace(/[. ]+$/, '');
    return s || seg;
  });
  return path.join(vol, ...resto);
}

// [0136][seguridad 1] La ruta real: la carpeta existente mas honda con
// realpathSync.native (expande 8.3 y junctions) mas el resto.
function rutaReal(p) {
  let actual = path.resolve(String(p || ''));
  const resto = [];
  for (let i = 0; i < 64; i++) {
    try {
      return path.join(fs.realpathSync.native(actual), ...resto);
    } catch {
      const padre = path.dirname(actual);
      if (padre === actual) break;
      resto.unshift(path.basename(actual));
      actual = padre;
    }
  }
  return path.resolve(String(p || ''));
}

const filePath = sinPuntosFinales(filePathRecibida);
const filePathReal = rutaReal(filePath);

// [0050] El repo lo manda el ARCHIVO EDITADO, no el directorio de la sesion.
// Antes todo salia de process.cwd(): trabajar en un subrepo desde C:\dev leia el
// manifiesto y el marcador de la RAIZ, asi que (a) un gate firmado en el hijo se
// daba por inexistente y obligaba a ECO_GATE_BYPASS, (b) sus criticalPaths nunca
// casaban porque `rel` venia prefijado, y (c) podia proteger de MENOS, aplicando
// el modo de un repo `ligero` a un archivo critico de uno `dirigido`.
// Es la misma correccion que 0041 hizo en auto-gate.cjs, en el otro extremo.
function findRepoRoot(startFile, raizProvisional) {
  const home = os.homedir();
  let dir = path.dirname(path.resolve(startFile));
  const tope = path.resolve(raizProvisional);
  for (let i = 0; i < 40; i++) {
    // Dos falsos positivos que hay que saltar:
    //  - ~/.claude: es la config global de Claude Code, no un repo (trampa de 0041)
    //  - cualquier .claude/: eco-core ES un repo git, pero sus archivos deben
    //    seguir gobernados por el repo que lo contiene, o se pierde la exclusion
    //    de gobierno de la linea de abajo (que espera un `rel` con .claude/ delante)
    if (path.resolve(dir) !== path.resolve(home) && path.basename(dir) !== '.claude') {
      const marcas = [
        path.join(dir, '.claude', 'ecosystem.json'),
        path.join(dir, '.planning'),
        path.join(dir, '.git'),
      ];
      if (marcas.some((m) => fs.existsSync(m))) return dir;
    }
    const padre = path.dirname(dir);
    if (padre === dir || path.resolve(dir) === tope) break;
    dir = padre;
  }
  return null;
}

// Sin raiz identificable se cae a cwd: degradacion segura, nunca excepcion.
// [0112] La raiz del ecosistema sale del repo del archivo editado (lib/raiz-ecosistema.js),
// no de una ruta fija: primero una provisional desde la carpeta del archivo, que
// solo sirve de tope a la subida, y despues la definitiva desde el repo encontrado.
const cwd = findRepoRoot(filePath, raizEcosistema(path.dirname(path.resolve(filePath)))) || process.cwd();
const ECOSYSTEM_ROOT = raizEcosistema(cwd);

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

const MOD_AUTO_GATE = path.join(ECOSYSTEM_ROOT, 'Tools', 'PlantillaRepos', 'scripts', 'utils', 'auto-gate.cjs');

// ─── [0136] Rutas protegidas: antes de la exclusion de gobierno (nota D) ──────
// Globos fijos para cuando auto-gate.cjs falta o no se puede leer: los de
// CONTROL_PLANE_DENY, los briefings y ZONA_ROJA_FIJA. La lista de respaldo nunca.
const FIJOS_PROTEGIDOS = [
  '**/.claude/rules/**', '**/.claude/hooks/**', '**/.claude/settings.json', '**/.claude/settings.local.json',
  '**/scripts/presets/**', '**/scripts/git-hooks/**', '**/scripts/utils/invoke-external-agent.cjs',
  '**/scripts/utils/auto-gate.cjs', '**/scripts/utils/gate-allowlist.json', '**/.github/workflows/**',
  '**/.claude/ecosystem.json', '**/CLAUDE.md', '**/AGENTS.md', '**/MEMORIA.md',
  '**/.claude/agents/**', '**/.claude/commands/**', '**/.claude/state/tareas/**',
  '**/.secrets/**', '**/*.kdbx', '**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/id_rsa*', '**/id_ed25519*',
];
const EXCEPCIONES_ENV = new Set(['.env.example', '.env.template', '.env.sample', '.env.test']);

function globARegex(glob) {
  const norm = glob.replace(/\\/g, '/');
  let re = '';
  for (let i = 0; i < norm.length; i++) {
    const c = norm[i];
    if (c === '*') {
      if (norm[i + 1] === '*') {
        i++;
        if (norm[i + 1] === '/') { re += '(?:.*/)?'; i++; } else { re += '.*'; }
      } else {
        re += '[^/]*';
      }
    } else if ('.+?^${}()|[]'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('(^|/)' + re + '$', 'i');
}

// Respaldo sin auto-gate.cjs: una forma de la ruta, medida contra su propio repo.
function protegidaSinAutoGate(forma) {
  const base = findRepoRoot(forma, ECOSYSTEM_ROOT) || cwd;
  const r = path.relative(base, forma).replace(/\\/g, '/');
  if (!/^\.claude\/state\/tareas\//i.test(r) && /^(prompts\/(in|out)\/|prompts\/INDEX\.md$|\.planning\/|\.claude\/state\/)/i.test(r)) return null;
  if (EXCEPCIONES_ENV.has(path.basename(forma).toLowerCase())) return null;
  const abs = path.resolve(forma).replace(/\\/g, '/');
  return FIJOS_PROTEGIDOS.some((g) => globARegex(g).test(abs)) ? 'plano de control o secretos' : null;
}
function protegidaSinAutoGateAlguna() {
  return protegidaSinAutoGate(filePath) || protegidaSinAutoGate(filePathReal);
}

function comprobarProtegida() {
  let g = null;
  try {
    // auto-gate fija su raiz al cargarse: que sea la misma que la de este gancho.
    if (!process.env.ECOSYSTEM_ROOT) process.env.ECOSYSTEM_ROOT = ECOSYSTEM_ROOT;
    g = require(MOD_AUTO_GATE);
  } catch { g = null; }
  if (!g || typeof g.clasificarRutas !== 'function' || typeof g.verificarRutaProtegida !== 'function') {
    const tipo = protegidaSinAutoGateAlguna();
    return tipo ? { tipo, motivo: 'auto-gate.cjs no disponible o ilegible; fallo cerrado con los globos fijos' } : null;
  }
  let c;
  try {
    // clasificarRutas mide la forma recibida (sin punto final) y la real.
    c = g.clasificarRutas([filePath, filePathReal], { raiz: ECOSYSTEM_ROOT });
  } catch (e) {
    const tipo = protegidaSinAutoGateAlguna();
    return tipo ? { tipo, motivo: `no se pudo clasificar (${String(e.message).slice(0, 120)}); fallo cerrado con los globos fijos` } : null;
  }
  if (!c.control.length && !c.roja.length) return null;
  const tipo = c.control.length ? 'plano de control' : `zona roja (${c.roja[0].motivo})`;
  // [0136][seguridad 9] Si la comprobacion de la firma lanza, se bloquea.
  try {
    const v = g.verificarRutaProtegida(filePath, { raiz: ECOSYSTEM_ROOT });
    return v && v.ok ? null : { tipo, motivo: (v && v.motivo) || 'comprobacion sin resultado' };
  } catch (e) {
    return { tipo, motivo: `la comprobacion de la firma fallo (${String(e.message).slice(0, 120)}); fallo cerrado` };
  }
}

const protegida = comprobarProtegida();
if (protegida) bloquear(rel, protegida.tipo, protegida.motivo);

// glob minimo: ** = cualquier subpath, * = un segmento
function matchGlob(glob, p) {
  const rx = new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*') + '$');
  return rx.test(p) || rx.test(p + '/');
}
const esCritico = criticalPaths.some(g => matchGlob(g, rel) || rel.startsWith(g.replace(/\/?\*\*$/, '') + '/'));

// [0031a·repuesto 0066] ORDEN: las rutas criticas se evaluan ANTES que las
// exclusiones de gobierno/doc. Al reves —como quedo tras la sincronizacion de
// hooks del 0052— un repo que declara `.claude/hooks/**` o `.claude/rules/**`
// como ruta critica NUNCA escalaba a gate: la exclusion documental salia antes
// y devolvia exit 0. Es el hueco H5 de la auditoria 0031.
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
  try {
    const { verifyGateLine } = require(MOD_AUTO_GATE);
    // [0031a·repuesto 0066] Anti-replay: la firma caduca a las 72 h y queda
    // atada al numero del marcador. Sin estas dos opciones, una linea GATE
    // legitima de hace semanas seguia abriendo el gate indefinidamente.
    const numeroMarcador = (currentPrompt.match(/\*\*N[úu]mero:\*\*\s*(\S+)/) || [])[1];
    const opts = { maxAgeHours: 72 };
    if (numeroMarcador) opts.expectedPromptNumero = numeroMarcador;
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
