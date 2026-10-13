/**
 * [0112] ¿Donde esta la raiz del ecosistema? La usan los hooks eco-* y
 * lib/cierre-reciente.js para encontrar auto-gate.cjs, el medidor de la voz y
 * el estado comun.
 *
 * POR QUE EXISTE. Cada hook decia `process.env.ECOSYSTEM_ROOT || 'C:\\dev'`. En
 * una maquina con la raiz en otra parte, o en un hijo sin la variable en su
 * settings, el hook buscaba auto-gate.cjs donde no estaba: la firma del gate
 * se daba por invalida y los candados del cierre dejaban de actuar (0109).
 *
 * LA REGLA. Una carpeta es raiz valida si tiene `.claude/rules` (carpeta o
 * junction, aunque este colgante) y `Tools/PlantillaRepos/scripts/utils/auto-gate.cjs`.
 *   1. ECOSYSTEM_ROOT, si es raiz valida.
 *   2. La primera raiz valida subiendo hasta 6 niveles desde la carpeta que
 *      contiene el repo de `desde` (o desde `desde`, si no esta en un repo). Un
 *      repo nunca es su propia raiz: si lo fuera, bastaria con crear dentro un
 *      `Tools/PlantillaRepos/scripts/utils/auto-gate.cjs` falso para que el gate
 *      firmara cualquier cosa (revision de Codex del 0112).
 *   3. ECOSYSTEM_ROOT tal cual, si esta definida y la carpeta existe: lo que los
 *      hooks hacian antes del 0112. Lo necesitan los laboratorios que montan una
 *      raiz parcial (solo auto-gate.cjs, solo el lector del transcript); sin este
 *      paso sus hooks escribirian en el estado de la raiz real.
 *   4. 'C:\\dev'.
 * El resultado se guarda por proceso, por pareja variable y punto de partida.
 *
 * CommonJS y sin dependencias: la cargan hooks que corren en cualquier hijo.
 */
const fs = require('node:fs');
const path = require('node:path');

const NIVELES = 6;
const POR_DEFECTO = 'C:\\dev';
const cache = new Map();

function esRaizValida(dir) {
  if (!dir) return false;
  try {
    const reglas = fs.lstatSync(path.join(dir, '.claude', 'rules'));
    if (!reglas.isDirectory() && !reglas.isSymbolicLink()) return false;
    return fs.statSync(path.join(dir, 'Tools', 'PlantillaRepos', 'scripts', 'utils', 'auto-gate.cjs')).isFile();
  } catch {
    return false;
  }
}

// La carpeta del repo git que contiene `dir` (la que tiene `.git`, carpeta o archivo).
function repoQueContiene(dir) {
  let d = dir;
  for (;;) {
    try { fs.lstatSync(path.join(d, '.git')); return d; } catch { /* sigue subiendo */ }
    const padre = path.dirname(d);
    if (padre === d) return null;
    d = padre;
  }
}

function esCarpeta(dir) {
  try { return fs.statSync(dir).isDirectory(); } catch { return false; }
}

function raizEcosistema(desde = process.cwd()) {
  const variable = process.env.ECOSYSTEM_ROOT || '';
  const clave = `${variable}|${desde}`;
  if (cache.has(clave)) return cache.get(clave);

  let raiz = null;
  if (variable && esRaizValida(variable)) raiz = path.resolve(variable);
  if (!raiz && desde) {
    const inicio = path.resolve(String(desde));
    const repo = repoQueContiene(inicio);
    let dir = repo ? path.dirname(repo) : inicio;
    for (let i = 0; i <= NIVELES; i++) {
      if (esRaizValida(dir)) { raiz = dir; break; }
      const padre = path.dirname(dir);
      if (padre === dir) break;
      dir = padre;
    }
  }
  if (!raiz && variable && esCarpeta(variable)) raiz = path.resolve(variable);
  if (!raiz) raiz = POR_DEFECTO;

  cache.set(clave, raiz);
  return raiz;
}

module.exports = { raizEcosistema, esRaizValida, NIVELES };
