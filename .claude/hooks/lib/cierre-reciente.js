/**
 * [0096] ¿Es reciente el cierre de este marcador? La usan los dos candados del
 * cierre: el del reporte en eco-stop-continue y el de la voz en eco-medir-voz.
 *
 * POR QUE EXISTE. Los dos exigian la linea GATE con la firma vigente para no
 * retener sesiones ajenas con un marcador cerrado hace semanas. Pero
 * `cerrarMarcador`, la orden canonica de auto-gate.cjs para cerrar un encargo,
 * quita esa linea. Resultado medido en el 0095: todo encargo cerrado con la orden
 * canonica esquivaba los dos candados.
 *
 * LA REGLA.
 *   - ECO_GATE_MODE=admin: cuenta como reciente, como antes.
 *   - Con linea GATE: manda la firma, vigente 72 h y atada al numero del
 *     marcador. Una linea caducada o de otro encargo NO cuenta (prueba c2-viejo).
 *   - Sin linea GATE: cuenta si el marcador se modifico hace menos de 72 h, que
 *     es el mismo plazo que la firma.
 *
 * Solo sirve a los candados del CIERRE. La continuacion de un plan EN_EJECUCION
 * sigue exigiendo la firma y no usa esta funcion.
 */
const fs = require('node:fs');
const path = require('node:path');
let raizEcosistema;
try { ({ raizEcosistema } = require('./raiz-ecosistema.js')); } catch { raizEcosistema = () => process.env.ECOSYSTEM_ROOT || 'C:\\dev'; }

const HORAS = 72;

function cierreReciente({ marker, markerPath, numero, root }) {
  if ((process.env.ECO_GATE_MODE || 'ia').toLowerCase() === 'admin') return true;
  if (/^GATE:/m.test(marker || '')) {
    try {
      const { verifyGateLine } = require(path.join(
        root || raizEcosistema(), 'Tools', 'PlantillaRepos', 'scripts', 'utils', 'auto-gate.cjs'));
      const opts = { maxAgeHours: HORAS };
      if (numero) opts.expectedPromptNumero = numero;
      return verifyGateLine(marker, opts).ok;
    } catch {
      return false;
    }
  }
  try {
    return (Date.now() - fs.statSync(markerPath).mtimeMs) < HORAS * 3600 * 1000;
  } catch {
    return false;
  }
}

module.exports = { cierreReciente, HORAS };
