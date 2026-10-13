/**
 * [0094] La contabilidad del ritual: rutas que son registros y no documentos para
 * leer. El marcador, el indice de prompts, los planes de prompts/in y todo
 * .claude/state. La usan eco-medir-voz (para no medirlas) y eco-session-start
 * (para no contarlas en la linea de salud de la voz), y vive aqui para que las
 * dos piezas no se separen.
 */
const ES_RITUAL = /[\\/](?:\.planning[\\/]CURRENT_PROMPT\.md|prompts[\\/]INDEX\.md|prompts[\\/]in[\\/][^\\/]+|\.claude[\\/]state[\\/][^\\/]+)$/i;

module.exports = { ES_RITUAL, esRitual: (ruta) => ES_RITUAL.test(String(ruta || '')) };
