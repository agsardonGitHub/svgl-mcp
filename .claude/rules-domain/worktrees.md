# Worktrees — politica del ecosistema

> Esta regla se carga automaticamente por Claude Code. Vigente desde prompt 0643 (2026-05-06).

## Resumen

Este repo opera en **single working tree** sobre `main` en `<raiz-del-repo>`. **No se usan git worktrees** ni mecanismos del SDK que los crean automaticamente. Esta politica es resultado de una auditoria del ecosistema (2026-05-06) que detecto 1.6 GB acumulados en `.claude/worktrees/` (8 dirs · 6 huerfanos creados todos en una sesion crashada · 1 branch zombi pusheada en origin) sin que el flujo lo necesitara.

## Origen — auditoria 2026-05-06

El paquete GSD `.claude/get-shit-done/` activa por defecto `workflow.use_worktrees: true`, y el modo Coordinator (`CLAUDE_CODE_COORDINATOR_MODE: "1"`) creaba un worktree por sesion de Claude Code en `.claude/worktrees/<adjetivo-cientifico-hex>/`. Cada uno instalaba sus propios `node_modules` (~1.3 GB) y, si la sesion no terminaba ordenadamente, dejaba la carpeta + branch + registro git como zombi. Cuando una sesion crasheaba antes de completar `git worktree add`, dejaba carpetas vacias sin link git.

Para el flujo del CEO (1 desarrollador, prompts secuenciales, 3 PCs no simultaneos, OneDrive como segundo eje de sincronizacion ya operativo), los worktrees aportaban **aislamiento que no se necesitaba** y **complejidad que si costaba**.

## Que NO hacer

1. **No invocar `git worktree add` desde codigo, hooks, scripts ni Bash interactivo.**
2. **No invocar el `Agent` tool con `isolation: "worktree"`** ni equivalentes del SDK Claude Code.
3. **No activar `workflow.use_worktrees: true`** en `.planning/config.json`.
4. **No re-introducir** `CLAUDE_CODE_COORDINATOR_MODE: "1"` en `.claude/settings.local.json` sin documentar la decision en un ADR + actualizar esta regla.

## Excepciones legitimas (requieren confirmacion explicita del admin)

| Caso                                                                                      | Justificacion                                                   | Cleanup obligatorio                                                                                                 |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Trabajo paralelo simultaneo en 2+ sesiones que tocan los mismos archivos y se molestarian | Ejemplo: refactor masivo + bugfix urgente sobre el mismo modulo | Tras merge a main: `git worktree remove ... --force`, `git branch -D claude/...`, `rm -rf .claude/worktrees/<name>` |
| Refactor experimental que necesita rollback facil sin afectar main                        | Ejemplo: migracion de framework, prueba de schema alternativo   | Igual                                                                                                               |
| Repo "sandbox" para reproducir bug aislado                                                | Ejemplo: bisect manual con multiples checkouts simultaneos      | Igual                                                                                                               |

En cualquiera de estos casos: **documentar en `.claude/state/BACKLOG-IDEAS.md` con prefijo `[NNNN]`**, crear el worktree manualmente, ejecutar el cleanup explicito al terminar.

## Defensas activas

1. **`.gitignore`** cubre `.claude/worktrees/` — ningun worktree accidental puede acabar en git.
2. **`.planning/config.json`** fija `workflow.use_worktrees: false` — los workflows GSD (`/gsd-quick`, `/gsd-execute-phase`, `/gsd-debug`) ejecutan secuencialmente sobre el working tree principal.
3. **Hook bloqueante `gsd-no-worktree.js`** (PreToolUse Bash) aborta ejecuciones que contengan `git worktree add` con exit code 2.
4. **Esta regla** se carga en SessionStart y aparece como contexto constante para Claude Code.

## Cleanup manual cuando aparece un worktree zombi

```bash
cd <raiz-del-repo>

# 1. Inspeccionar estado
git worktree list
ls .claude/worktrees/
git branch --list 'claude/*'

# 2. Si hay trabajo en flight no commiteado, preservarlo:
cd .claude/worktrees/<name>
git status
git add . && git commit --no-verify -m "wip(NNNN): preservar antes de cleanup [skip ci]"
cd <raiz-del-repo>

# 3. Crear tag salvage para no perder commits utiles
git tag -a salvage/<descripcion> claude/<name> -m "Trabajo preservado: <que es>"

# 4. Quitar registro git del worktree (libera node_modules)
git worktree remove .claude/worktrees/<name> --force

# 5. Quitar dir fisico si quedo (Windows long-path)
node -e "require('fs').rmSync('.claude/worktrees/<name>',{recursive:true,force:true,maxRetries:3})"

# 6. Si la branch claude/* tiene SOLO trabajo redundante con main, borrar:
git branch -D claude/<name>

# 7. Borrar branch remota si existe:
git push origin --delete claude/<name>

# 8. Limpiar registros internos de git
git worktree prune --verbose
```

## Estado post-0643 (referencia)

- 2 branches `claude/*` locales preservadas con tag salvage:
  - `claude/tender-brattain-aa3b2c` → tag `salvage/0642c-adminsigntab-wip` (4 commits cleanup AdminSignTab no merged a main)
  - `claude/strange-proskuriakova-224623` (30/abr) — analisis preliminar dice trabajo redundante con main por rebase, pero diff residual de 510 archivos requiere validacion del CEO antes de borrar
- Branches remotas `origin/claude/*`: ninguna
- Dirs fisicos: solo `brave-sanderson-fb1817/` (sesion 0643). El admin destruira tras cerrar Claude Code

## Troubleshooting

| Sintoma                                                | Causa                                                  | Fix                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `Filename too long` al borrar worktree                 | node_modules con path Windows >260 chars               | `node -e "require('fs').rmSync(..., {recursive:true,force:true,maxRetries:3})"`                                                   |
| `EPERM Permission denied` al borrar worktree           | Handles abiertos (VSCode, indexador, watchers)         | Cerrar editores + reintentar; si persiste, usar `Remove-Item -LiteralPath '\\?\C:\path'` desde PowerShell tras cerrar Claude Code |
| Hook `gsd-no-worktree.js` bloquea un Bash legitimo     | Falso positivo en lectura                              | Excepcion documentada arriba: justificar en BACKLOG, ejecutar manualmente sin Code                                                |
| `.claude/worktrees/` aparece de nuevo tras un `/gsd-*` | `workflow.use_worktrees` se sobreescribio en otra rama | Verificar `.planning/config.json` actual + revisar diff                                                                           |

## Referencias

- Auditoria origen: prompt 0643 (2026-05-06) seccion 6 "Modelo B"
- Reporte: `prompts/out/0643_resultado_volver_single_repo_main_eliminar_worktrees.md`
- Hook: `.claude/hooks/gsd-no-worktree.js`
- GSD config: `.planning/config.json`
- SDK Claude Code `Agent` tool con `isolation: "worktree"` documentado en system prompt nativo (no editable)
