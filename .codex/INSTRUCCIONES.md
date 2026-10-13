# INSTRUCCIONES — Codex en svgl-mcp

Este archivo adapta la configuracion comun a Codex CLI. La fuente comun sigue siendo `CLAUDE.md`, `.claude/rules/` (heredadas del ecosistema vía junction), `.claude/rules-domain/` (locales del proyecto), `.claude/skills/`, `prompts/` y la documentacion del repo, más `.claude/state/` si el perfil lo lleva (completo y dirigido).

## Ritual de arranque

1. Confirmar la ruta del repo.
2. Leer `AGENTS.md` y `CLAUDE.md`.
3. Leer estas instrucciones Codex.
4. Si el perfil lleva estado (completo y dirigido), revisar `.claude/state/CONTEXTO-OPERATIVO.md`, `DECISIONES-ACTIVAS.md` y `HANDOFF.md`.
5. Leer las reglas aplicables en `.claude/rules/` (ecosistema) Y `.claude/rules-domain/` (locales) según el scope.
6. Revisar `git status --short` y no revertir cambios ajenos.
7. Para prompts formales, revisar `prompts/INDEX.md`, el prompt de entrada y los reportes recientes relacionados.

## Modo de trabajo

- Trabajar con plan explicito cuando la tarea sea multiarchivo, de arquitectura, seguridad, prompts formales o cambios de workflow.
- En plan mode no mutar archivos: explorar, preguntar lo imprescindible y cerrar con un plan decision-complete.
- Para tareas formales usar `prompts/in/NNNN_prompt_*.md` y cerrar con `prompts/out/NNNN_resultado_*.md`.
- Para fixes pequenos se puede trabajar directo, pero registrar si cambia comportamiento visible, reglas operativas o trazabilidad.
- Mantener Markdown, reportes y decisiones en espanol.

## Reglas criticas del repo

Aplica TODAS las rules cargadas dinamicamente desde `.claude/rules/` (heredadas del ecosistema) Y `.claude/rules-domain/` (locales del proyecto) segun el scope:

Heredadas del ecosistema (`.claude/rules/`):
- `secrets.md` — usar una credencial es libre y filtrarla esta bloqueado: ningun valor en archivos versionados, logs ni linea de ordenes.
- `prompt-lifecycle.md` — 3 tiers de autonomia + topes anti-runaway.
- `multi-agent.md` — protocolo Claude + Codex (Gemini retirado en 0053); este runtime puede ser el revisor Codex.
- `windows.md` — convenciones Windows-first si el proyecto vive en Windows.

Locales del proyecto (`.claude/rules-domain/`):
- `commits.md` — conventional commits + skip ci + prettier + fetch.
- `typescript.md` — strict, SOLID, si el stack usa TypeScript.
- `prisma.md` — adapter-pg + tenantId, si el stack usa Prisma.

## Verificacion al cierre

Ejecutar los comandos de la seccion Comandos del `CLAUDE.md` que correspondan al scope (compilar, tipos, lint, pruebas) y documentar cualquier limitacion.

## Cierre obligatorio

Antes de cerrar una tarea significativa:

1. Ejecutar la verificacion razonable.
2. Actualizar `prompts/INDEX.md` si hubo prompt formal.
3. Actualizar `prompts/out/NNNN_resultado_*.md` con estado, verificaciones y riesgos restantes.
4. Si el perfil lleva estado (completo y dirigido), actualizar `.claude/state/CONTEXTO-OPERATIVO.md` cuando cambie el estado vivo.
5. Informar al usuario de archivos cambiados, verificaciones ejecutadas y limites.
