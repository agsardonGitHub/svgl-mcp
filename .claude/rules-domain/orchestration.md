# Orquestación — mapa tarea → agente (genérico del ecosistema)

> Sembrada por el template. Los agentes del kit llevan `autoInvoke: true` con sus triggers en el frontmatter; este mapa es la referencia humana/IA de quién hace qué. Adaptar libremente al proyecto.

## Mapa canónico

| Situación | Agente | Cuándo se dispara solo |
|---|---|---|
| Implementación terminada (>3 archivos) o ruta crítica tocada | `@code-reviewer` | autoInvoke al cerrar el cambio, antes del commit final |
| Auth, sesiones, tokens, dinero real, datos personales | `@security-reviewer` | autoInvoke al tocar esas zonas |
| `tsc`/build/CI en rojo | `@build-doctor` | autoInvoke al fallar |
| Textos visibles / archivos de traducciones | `@i18n-guardian` | autoInvoke al tocar i18n |
| `prisma/schema.prisma` o errores Prisma P10xx/P20xx | `@prisma-sync` | autoInvoke al tocar schema o antes de db push |
| Prompt formal numerado | `@prompt-composer` | manual (delegar siempre) |
| Documentación desactualizada tras cambios | `@doc-auditor` / `@doc-writer` | manual o al cierre de prompt |
| Planificación GSD (fases, roadmap, ejecución) | agentes `gsd-*` vía comandos `/gsd:*` | según workflow GSD |

## Reglas

1. **Los revisores no se saltan**: si autoInvoke no disparó (sesión degradada), invocarlos manualmente antes del commit final. `code-reviewer` >3 archivos; `security-reviewer` en auth/dinero SIEMPRE.
2. **El gate IA va antes que todo**: plan formal → `auto-gate.cjs` → GO firmado → ejecutar (rule `gates.md`).
3. **Un agente por especialidad**: no pedir revisión de seguridad al code-reviewer genérico.
4. Los agentes ejecutan con su `model:` del frontmatter (rule `mode-router.md`) — no forzar modelo desde fuera.
