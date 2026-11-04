# CLAUDE.md — svgl-mcp

> Repo adoptado al ecosistema C:\dev via upgrade-repo -Adopt (perfil: ligero).
> Completar briefing tecnico del proyecto debajo de las secciones gestionadas.

<!-- ECO:BEGIN apertura -->
<!-- voz: tipo=normativo -->
## Perfil de gobierno y ritual de apertura

Este repo declara su perfil en `.claude/ecosystem.json` (`completo | dirigido | ligero | exento`) junto con sus **rutas críticas** (`criticalPaths`). Tocar una ruta crítica exige gate. También con un solo archivo. Lo detalla la rule `adoption-profiles.md`.

En los perfiles completo y dirigido, el hook `eco-session-start` imprime al abrir sesión el perfil, CURRENT_PROMPT, el HANDOFF pendiente y DECISIONES-ACTIVAS. Lo que aparezca ahí se atiende ANTES de empezar trabajo nuevo. Si el perfil lleva `.claude/state/` (completo y dirigido, porque ligero no tiene estado vivo), se completa a mano con dos archivos.

1. `.claude/state/CONTEXTO-OPERATIVO.md`, con lo que se está haciendo y el último prompt.
2. `.claude/state/BACKLOG-IDEAS.md`, que se menciona si tiene items del scope actual.
<!-- ECO:END apertura -->

<!-- ECO:BEGIN rules -->
## Estructura de rules

Las reglas viven en dos carpetas.

- **`.claude/rules/`** son las reglas heredadas del ecosistema, por una junction a `<raíz>\.claude\rules`. `<raíz>` es la raíz del ecosistema, la carpeta que contiene `.claude\` y la que nombra `ECOSYSTEM_ROOT`. La junction la crean la app VALOR·IA Digital o `upgrade-repo` al fabricar el repo. Son <!-- inv:reglas.n -->13<!-- /inv --> rules, y la cifra y la lista salen del inventario (<!-- inv:reglas.lista -->adoption-profiles · autonomia · communication · conventions · ecosystem · gates · mode-router · multi-agent · operacion-autonoma · prompt-lifecycle · redaccion-humanizada · secrets · windows<!-- /inv -->). **Se cargan TODAS automáticamente en cada sesión**, unos 23 KB, y el detalle extendido se lee bajo demanda en `<raíz>\.claude\docs\detalle\`. Aquí no se editan. Se cambian en el ecosistema raíz con un prompt numerado.
- **`.claude/rules-domain/`** guarda las reglas locales del proyecto, es decir, las sembradas para este stack (las comunes del ecosistema y las que pide su preset) y las de dominio o de flujo de trabajo que añada el proyecto. Se editan libremente. ⚠️ No se cargan solas, así que se citan desde este CLAUDE.md o se invocan al trabajar el área.

Si el repo se generó sin ecosistema padre (modo standalone), `.claude/rules/` contiene rules locales y no una junction.

En un clon nuevo faltan la junction y el pre-commit, porque git no los versiona. Se recrean desde la raíz con estas dos órdenes.

```powershell
pwsh <raíz>/Tools/PlantillaRepos/scripts/verify-ecosystem.ps1 -Root <raíz> -Repo <ruta-del-repo> -Repair -Yes
pwsh <raíz>/Tools/PlantillaRepos/scripts/install-git-hooks.ps1 -RepoPath <ruta-del-repo>
```

Sin PowerShell 7 vale `powershell -NoProfile -File` con los mismos argumentos. El pre-commit solo actúa en los perfiles completo y dirigido. Git tampoco versiona `.claude/settings.local.json`, y mientras falte, `ECOSYSTEM_ROOT` no está definida y en las órdenes de abajo se escribe la ruta de la raíz en su lugar.

## Prompt del plan y modo plan (0136)

Las peticiones del chat **ya no entran solas en modo plan**, porque la app exige allí una aprobación humana
que el CEO ya no da. Una petición Tier 2-3 va primero al prompt del plan, en
`.planning/drafts/NNNN-prompt-del-plan.md`, que Codex revisa con `review-plan` (ITERA tres veces como mucho, y el
veredicto en `.revision-*.md`). Después el plan formal pasa por `auto-gate.cjs`. La regla 0091, la del modo plan
sin consola, vale cuando el CEO activa el modo plan a mano.

Cada uno a lo suyo. **El CEO decide el diseño** y **Codex aprueba el plan y los pasos** con el gate firmado.

## Gates obligatorios (resumen operativo · ADR-ECO-001)

- **Gate IA Tier 2-3.** El plan formal se pasa por `node "$ECOSYSTEM_ROOT/Tools/PlantillaRepos/scripts/utils/auto-gate.cjs" --plan <plan.md> --prompt-numero NNNN`. El kit define `ECOSYSTEM_ROOT` en `.claude/settings.local.json` y la consola de la sesión la recibe (en PowerShell, `$env:ECOSYSTEM_ROOT`). Codex emite GO, ITERA o NOGO, y el GO se firma en `CURRENT_PROMPT.md`. **No se pide OK al CEO**, que no aprueba planes ni fases.
- **Ejecución sin paradas** en completo y dirigido. El hook Stop `eco-stop-continue` impide terminar con el plan a medias, con un máximo de <!-- inv:umbral.continuaciones -->12<!-- /inv --> continuaciones por sesión y el escape `**Estado:** BLOQUEADO`. Solo retiene a la sesión que nombra la línea `**Sesión:**` del marcador, que escribe `auto-gate` al firmar.
- **Rutas críticas.** Tocar un glob de `criticalPaths` es Tier 2 como mínimo y lleva gate, aunque sea un archivo.
- **Plano de control y zona roja.** El plano de control son rules, hooks, settings, presets, wrapper, workflows, manifiestos, CLAUDE.md y AGENTS.md; la zona roja, los globos `zonaRoja` del manifiesto, con dinero real, accesos, datos clínicos o secretos. Los dos piden doble GO de Codex. `eco-plan-gate` bloquea la escritura y el `pre-commit` el commit, aunque sea de un archivo, si no hay firma `codex` o `admin` de un plan que los declare. Sin Codex, el plano de control también se abre con la firma `claude-doble`, la de dos veredictos Claude unánimes (0141). No vale para la zona roja ni para el núcleo del gate, que son auto-gate, ganchos, ajustes, manifiestos, instaladores y lanzadores del kit, workflows y cuatro reglas, con la lista en `gates.md`.
- **Líneas rojas del CEO**, en la cola de la raíz (`<raíz>\.claude\state\PLANES-PENDIENTES.md`). Son los destructivos irreversibles, los secretos, el dinero real y los accesos.
- **Modelo por tarea.** Los agents del kit llevan su modelo asignado (`mode-router.md`).
- **Revisores** (`multi-agent.md`). Codex es el único revisor externo. Si cae <!-- inv:umbral.fallos_normal -->1<!-- /inv --> vez en trabajo normal, revisa un subagente Claude de contexto limpio y se continúa. En plano de control revisan dos subagentes Claude independientes y hace falta unanimidad (`--verdict-file` y `--verdict-file2`, ADR-ECO-003). En zona roja y núcleo del gate Claude no aprueba nunca, y el plan espera encolado a Codex o a un sí del CEO en el chat, firmado `revisor=admin` con su cita.
- **Consumo del revisor** (0084). Cada invocación deja modelo, esfuerzo (`medium`, o el de `ECO_CODEX_EFFORT`) y tokens en `<raíz>\.claude\state\external-agents.log`, y el veredicto los hereda. El resumen sale de `node "$ECOSYSTEM_ROOT/Tools/PlantillaRepos/scripts/utils/resumen-consumo.cjs" --desde <fecha>`.

## Rules de dominio del stack

Son las de `.claude/rules-domain/`, sembradas para este stack según su preset, y la carpeta las lista todas. Antes de tocar un área se leen las suyas.
<!-- ECO:END rules -->

<!-- ECO:BEGIN ritual -->
## Observabilidad del prompt, OBLIGATORIA en los perfiles completo y dirigido

Al iniciar cada prompt numerado, antes de cualquier otra acción, se hacen cuatro cosas.

1. Imprimir un banner cian en consola con el número, el título, la hora de inicio, el número de tareas y la duración estimada.
2. Escribir `.planning/CURRENT_PROMPT.md` con estado `EN_EJECUCION`, el inicio, el PC y la tarea actual.
3. Al completar cada tarea, imprimir `✅ T-N completada · HH:MM:SS · +XmYs desde inicio`.
4. Al cerrar, imprimir un banner verde y pasar el marcador a `COMPLETADO` con `Fin:` y `Duracion:`.

Los bloques PowerShell canónicos están en `<raíz>\.claude\docs\detalle\observability.md`, y la rule `prompt-lifecycle.md` solo los cita.

`Set-PromptTitle` y el archivo `current-prompt-title` de la carpeta personal de Claude no se usan. Es un mecanismo retirado.

---

## Cierre de prompt, OBLIGATORIO tras cada prompt numerado

### 1. Resolver fallos

- Los fallos se corrigen ANTES de cerrar, y no se deja ninguno pendiente.
- Se ejecuta el check del stack que diga la sección Comandos de este CLAUDE.md (compilar, tipos, pruebas), con 0 errores obligatorio.
- Si un fallo no se puede resolver, se documenta en el reporte con su razón y se propaga al backlog.

### 2. Modelo de 3 tiers para oportunidades

Lo de Tier 1 se resuelve en el momento. Siempre. Cubre fallos, oportunidades de menos de cinco minutos y refactors locales reversibles, siempre en tres archivos como mucho y sin cambiar la API pública, el schema ni las claves i18n.

Lo de Tier 2 pasa el gate IA y se ejecuta hasta el final, en un commit separado que se puede revertir. Entran los refactors medianos de menos de media hora, los tests que faltan en el scope y la cobertura de tipos, siempre en ocho archivos como mucho y sin cambiar schema, API pública ni comportamiento observable.

Para el Tier 3 hace falta gate IA reforzado. Lleva tabla de riesgos. Son las decisiones de arquitectura, los refactors de más de media hora o de más de ocho archivos y los cambios que rompen la API pública.

Las líneas rojas del CEO se encolan en `<raíz>\.claude\state\PLANES-PENDIENTES.md`, la cola de la raíz, sin bloquear la sesión. Son los destructivos irreversibles (DROP o ALTER, borrado masivo, force push), los secretos, el dinero real y los accesos. Naming y marca son diseño, y los decide él. Codex aprueba con doble GO el plano de control, que son rules, hooks, settings, presets, wrapper, workflows y manifiestos; sin Codex lo aprueban dos subagentes Claude unánimes, salvo el núcleo del gate y la zona roja, que esperan a Codex o al CEO.

Detalle completo en `.claude/rules/prompt-lifecycle.md`.

### 3. Topes anti-runaway (obligatorios)

| Tope | Valor | Accion al exceder |
|---|---|---|
| Iteraciones detectar+resolver oportunidades | max **5** por prompt | Parar, propagar resto al backlog |
| Wall-clock vs estimacion inicial | max **2x** | Parar, propagar resto al backlog |
| Archivos tocados vs scope inicial | max **2x** | Parar, propagar resto al backlog |
| Commits dentro del prompt | max **5** | Parar, ultimo commit final |

### 4. Tabla-resumen obligatoria

| Milestone | Resultado |
|---|---|
| M1 Nombre | ✅ / ❌ + detalle |
| M2 Nombre | ✅ / ❌ + detalle |

Debajo de la tabla van estas líneas.

- El prompt ejecutado, `NNNN · Titulo`.
- El estado, COMPLETADO, PARCIAL o FALLIDO.
- Los fallos encontrados, o «ninguno».
- ✅ Las oportunidades resueltas en Tier 1.
- ✅ Las resueltas por autonomía extendida en Tier 2, cada una revertible con `git revert <sha>`.
- ⏳ Las pendientes de decisión en Tier 3, propagadas al backlog.
- ⚠️ Si se disparó algún tope anti-runaway, y cuál.

### 5. Actualizar trazabilidad

- En `prompts/INDEX.md` se añade o actualiza la fila del prompt con su estado y su fecha.
- Si el repo tiene roadmap (docs/ROADMAP.md), se marca en él el prompt como COMPLETADO.
- Si el proyecto tiene BD con tabla `prompts_registro`, se actualizan el estado y el hashCommit.

### 6. Propagar oportunidades Tier 3 al backlog (si el perfil lleva `.claude/state/`, en completo y dirigido)

- Se lee la sección «Oportunidades pendientes» del reporte.
- Cada item va a `.claude/state/BACKLOG-IDEAS.md` con el prefijo `[NNNN]`.
- Se clasifica en fallos latentes, técnicas, producto u operativa.
- No se duplica. Si ya existe, se añade el prompt nuevo al prefijo (`[NNNN][MMMM]`).

### 7. Actualizar estado operativo (si el perfil lo lleva, en completo y dirigido)

- Se actualiza `.claude/state/CONTEXTO-OPERATIVO.md` con el último prompt y su estado.
- Las decisiones abiertas que hayan surgido van a `.claude/state/DECISIONES-ACTIVAS.md`.
- Si se cierra a mitad de tarea, se rellena `.claude/state/HANDOFF.md`.

### 8. Sincronía antes del push (OBLIGATORIA y automática)

Antes del commit final conventional se ejecuta esta orden.

```bash
git pull --rebase --autostash origin main
```

Es automática y silenciosa, y **no se consulta al admin** (`windows.md`, apartado de sincronía con el remoto). El bot de release y el CI adelantan `main` por su cuenta, y sin esto el push final falla con `non-fast-forward`.

### 9. Commit, push verificado y CI verde

- Commit atómico con conventional commits, y NUNCA `Co-Authored-By`.
- Los commits intermedios llevan `[skip ci]`, y en completo y dirigido los hace el hook `gsd-auto-commit`.
- El commit final conventional va **sin** `[skip ci]`, para que dispare el CI y el push real.
- Tras el commit final, `git push origin main` explícito, sin fiarse solo del hook.
- Si el repo tiene CI, se comprueba en verde con `gh run list --limit 1` antes de declarar COMPLETADO.
- El pre-commit del gate (completo y dirigido) rechaza todo commit de más de dos archivos sin gate firmado en `.planning/CURRENT_PROMPT.md`, dentro o fuera de las rutas críticas. Solo se libra el commit de cierre que lleva únicamente el informe, el índice y el marcador. En ligero no hay pre-commit, y si falta en un clon se reinstala con la orden de «En un clon nuevo».

### 10. Generar reporte

El reporte va a `prompts/out/NNNN_resultado_descripcion.md`.

- Lleva todas las secciones de arriba.
- Lleva el hash del commit final, el resultado del push y el estado del CI.
- Lleva el inicio, el fin y la duración total (`Xh Ym Zs`).

> En el perfil **ligero** este ritual completo NO aplica. Bastan secrets-guard, el check verde de cierre, conventional commits y el gate en línea en las rutas críticas (`adoption-profiles.md`).
<!-- ECO:END ritual -->
