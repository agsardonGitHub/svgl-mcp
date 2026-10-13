# CLAUDE.md — svgl-mcp

> Repo adoptado al ecosistema C:\dev via upgrade-repo -Adopt (perfil: ligero).
> Completar briefing tecnico del proyecto debajo de las secciones gestionadas.

<!-- ECO:BEGIN apertura -->
## Perfil de gobierno y ritual de apertura

Este repo declara su perfil en `.claude/ecosystem.json` (`completo | dirigido | ligero | exento`) con sus **rutas críticas** (`criticalPaths`). Tocar una ruta crítica exige gate Plan Mode aunque sea 1 archivo. Ver rule `adoption-profiles.md`.

En los perfiles completo y dirigido, el hook `eco-session-start` imprime al abrir sesión el perfil, CURRENT_PROMPT, HANDOFF pendiente y DECISIONES-ACTIVAS. Si algo aparece ahí, atiéndelo ANTES de empezar trabajo nuevo. Complemento manual, con los archivos de `.claude/state/` si el perfil lo lleva (completo y dirigido; ligero no tiene estado vivo):

1. `.claude/state/CONTEXTO-OPERATIVO.md` — qué hacemos, último prompt.
2. `.claude/state/BACKLOG-IDEAS.md` — si tiene items del scope actual, mencionarlos.
<!-- ECO:END apertura -->

<!-- ECO:BEGIN rules -->
## Estructura de rules

Las reglas viven en DOS carpetas:

- **`.claude/rules/`** — reglas heredadas del ecosistema vía junction a `<raíz>\.claude\rules`, donde `<raíz>` es la raíz del ecosistema (la carpeta que contiene `.claude\`, la que nombra `ECOSYSTEM_ROOT`). La crean la app VALOR·IA Digital o `upgrade-repo` al fabricar el repo. Las <!-- inv:reglas.n -->13<!-- /inv --> rules del ecosistema (la cifra y la lista salen del inventario): <!-- inv:reglas.lista -->adoption-profiles · autonomia · communication · conventions · ecosystem · gates · mode-router · multi-agent · operacion-autonoma · prompt-lifecycle · redaccion-humanizada · secrets · windows<!-- /inv -->. **Se cargan TODAS automáticamente en cada sesión** (~23 KB). Detalle extendido bajo demanda: `<raíz>\.claude\docs\detalle\`. NO editar — modificar el ecosistema raíz vía prompt numerado.
- **`.claude/rules-domain/`** — reglas locales del proyecto: las sembradas para este stack (las comunes del ecosistema y las que pide su preset) y las de dominio o de flujo de trabajo que añada el proyecto. Editar libremente. ⚠️ NO se cargan automáticamente: referéncialas desde este CLAUDE.md o invócalas al trabajar el área.

Si el repo se generó SIN ecosistema padre (modo standalone), `.claude/rules/` contiene rules locales (no junction).

**En un clon nuevo** faltan la junction y el pre-commit, porque git no los versiona. Se recrean desde la raíz:

```powershell
pwsh <raíz>/Tools/PlantillaRepos/scripts/verify-ecosystem.ps1 -Root <raíz> -Repo <ruta-del-repo> -Repair -Yes
pwsh <raíz>/Tools/PlantillaRepos/scripts/install-git-hooks.ps1 -RepoPath <ruta-del-repo>
```

Sin PowerShell 7, `powershell -NoProfile -File` con los mismos argumentos. El pre-commit solo actúa en los perfiles completo y dirigido. Git tampoco versiona `.claude/settings.local.json`: mientras falte, `ECOSYSTEM_ROOT` no está definida y en las órdenes de abajo se escribe la ruta de la raíz en su lugar.

## Modo plan AUTOMATICO (0034e — no esperar a que el admin lo pulse)

**Peticion NUEVA del admin que sea Tier 2-3** (toca >3 archivos, esquema, arquitectura, plano de
control, o abre un programa de varios pasos) → **entrar SOLO en modo plan** (`EnterPlanMode`),
disenar y presentarlo con `ExitPlanMode`. No hay que esperar a que el admin lo active.

**NO aplica** (van directas, sin modo plan):
- Sub-prompts de un plan YA aprobado → directos al gate de Codex (`auto-gate.cjs`).
- Tier 1 trivial (≤3 archivos reversibles, sin criterio nuevo).
- Conversacion, preguntas, diagnostico sin cambios.

La division es esta y no se mezcla: **el admin aprueba EL PLAN** (modo plan automatico) y
**Codex aprueba los pasos** (gate firmado). Ni una aprobacion de mas, ni una de menos.

## Gates obligatorios (resumen operativo · ADR-ECO-001)

- **Gate IA Tier 2-3**: plan formal → `node "$ECOSYSTEM_ROOT/Tools/PlantillaRepos/scripts/utils/auto-gate.cjs" --plan <plan.md> --prompt-numero NNNN`. El kit define `ECOSYSTEM_ROOT` en `.claude/settings.local.json` y la consola de la sesión la recibe (en PowerShell, `$env:ECOSYSTEM_ROOT`). Codex emite GO/ITERA/NOGO y el GO se firma en `CURRENT_PROMPT.md`. **NO pedir OK al admin**: aprobó el plan, no las fases.
- **Ejecución sin paradas** (completo y dirigido): el hook Stop `eco-stop-continue` impide terminar con el plan a medias (máx <!-- inv:umbral.continuaciones -->12<!-- /inv --> continuaciones por sesión; escape `**Estado:** BLOQUEADO`). Solo retiene a la sesión que nombra la línea `**Sesión:**` del marcador, que escribe `auto-gate` al firmar.
- **Rutas críticas**: tocar un glob de `criticalPaths` = Tier 2 mínimo con gate, aunque sea 1 archivo.
- **Líneas rojas del admin** (auto-rechazo del gate + cola en `<raíz>\.claude\state\PLANES-PENDIENTES.md`, la de la raíz): plano de control (rules/hooks/settings/presets/wrapper/workflows/manifiestos), destructivos irreversibles, secretos, dinero real y auth.
- **Modelo por tarea**: los agents del kit llevan su modelo asignado (`mode-router.md`).
- **Revisores** (`multi-agent.md`): Codex es el único revisor externo; si cae <!-- inv:umbral.fallos_normal -->1<!-- /inv --> vez en trabajo normal (<!-- inv:umbral.fallos_control -->3<!-- /inv --> en plano de control) revisa un subagente Claude de contexto limpio y se continúa.
- **Consumo del revisor** (0084): cada invocación deja modelo, esfuerzo (`medium`; `ECO_CODEX_EFFORT`) y tokens en `<raíz>\.claude\state\external-agents.log`, y el veredicto los hereda. Resumen: `node "$ECOSYSTEM_ROOT/Tools/PlantillaRepos/scripts/utils/resumen-consumo.cjs" --desde <fecha>`.

## Rules de dominio del stack

Las de `.claude/rules-domain/`, sembradas para este stack según su preset: se listan en la carpeta, y antes de tocar un área se leen las suyas.
<!-- ECO:END rules -->

<!-- ECO:BEGIN ritual -->
## Observabilidad del prompt — OBLIGATORIO (perfiles completo/dirigido)

Al INICIAR cada prompt numerado, ANTES de cualquier otra accion:

1. Imprimir banner cian en consola con: numero, titulo, timestamp inicio, N tareas, duracion estimada.
2. Escribir `.planning/CURRENT_PROMPT.md` con estado `EN_EJECUCION`, inicio, PC, tarea actual.
3. Al completar cada Tx: imprimir `✅ T-N completada · HH:MM:SS · +XmYs desde inicio`.
4. Al cerrar: imprimir banner verde + actualizar marcador a `COMPLETADO` con `Fin:` y `Duracion:`.

Bloques PowerShell canonicos en `<raíz>\.claude\docs\detalle\observability.md` (la rule `prompt-lifecycle.md` solo los referencia).

**NO usar** `Set-PromptTitle` ni escribir el archivo `current-prompt-title` de la carpeta personal de Claude — mecanismo deprecado.

---

## Cierre de prompt — OBLIGATORIO tras cada prompt numerado

### 1. Resolver fallos

- Si hay fallos: corregir ANTES de cerrar. No dejar fallos pendientes.
- Ejecutar el check del stack que diga la sección Comandos de este CLAUDE.md (compilar, tipos, pruebas) → 0 errores obligatorio.
- Si un fallo no se puede resolver: documentar en el reporte con razon y propagar al backlog.

### 2. Modelo de 3 tiers para oportunidades

**Tier 1 — Autonomo SIEMPRE (resolver inline)**: fallos, oportunidades <5 min, refactors locales reversibles. Condiciones: ≤3 archivos, sin cambio API publica, sin cambio schema, sin cambio i18n keys.

**Tier 2 — Gate IA + ejecucion hasta el final (commit separado revertible)**: refactors medianos (<30 min), tests faltantes del scope, mejoras de cobertura de tipos. Condiciones: ≤8 archivos, sin cambio schema, sin cambio API publica, sin cambio comportamiento observable.

**Tier 3 — Gate IA reforzado con tabla de riesgos**: decision arquitectonica, refactor mayor (>30 min o >8 archivos), breaking changes de API publica.

**Lineas rojas del admin (encolar en `<raíz>\.claude\state\PLANES-PENDIENTES.md`, la cola de la raíz, sin bloquear la sesion)**: plano de control (rules/hooks/settings/presets/wrapper/workflows/manifiestos), destructivos irreversibles (DROP/ALTER, borrado masivo, force push), secretos, dinero real y auth, naming/marca.

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

Seguido de:

- Prompt ejecutado: `NNNN — Titulo`
- Estado: COMPLETADO / PARCIAL / FALLIDO
- Fallos encontrados: lista o "ninguno"
- ✅ Oportunidades resueltas (Tier 1): lista
- ✅ Oportunidades resueltas por autonomia extendida (Tier 2): lista — revertible con `git revert <sha>`
- ⏳ Oportunidades pendientes de decision (Tier 3): lista — propagadas al backlog
- ⚠️ Topes anti-runaway disparados: si/no + cual

### 5. Actualizar trazabilidad

- `prompts/INDEX.md` → anadir/actualizar fila del prompt con estado y fecha.
- Si el repo tiene roadmap (docs/ROADMAP.md), marcar en él el prompt como COMPLETADO.
- Si el proyecto tiene BD con tabla `prompts_registro`: UPDATE estado + hashCommit.

### 6. Propagar oportunidades Tier 3 al backlog (si el perfil lleva `.claude/state/`: completo y dirigido)

- Leer seccion "Oportunidades pendientes" del reporte.
- Propagar cada item a `.claude/state/BACKLOG-IDEAS.md` con prefijo `[NNNN]`.
- Clasificar en: Fallos latentes / Tecnicas / Producto / Operativa.
- NO duplicar — si ya existe, anadir el nuevo prompt al prefijo (`[NNNN][MMMM]`).

### 7. Actualizar estado operativo (si el perfil lo lleva: completo y dirigido)

- Actualizar `.claude/state/CONTEXTO-OPERATIVO.md` (ultimo prompt + estado).
- Si surgieron decisiones abiertas → `.claude/state/DECISIONES-ACTIVAS.md`.
- Si cierras a mitad de tarea → llenar `.claude/state/HANDOFF.md`.

### 8. Sincronia pre-push (OBLIGATORIO, automatico)

Antes del commit final conventional:

```bash
git pull --rebase --autostash origin main
```

Automatico y silencioso — **no consultar al admin** (`windows.md` §Sincronia con remoto). Razon: el bot de release y el CI adelantan `main` por su cuenta; sin esto el push final falla con `non-fast-forward`.

### 9. Commit, push verificado y CI verde

- Commit atomico con conventional commits. NUNCA `Co-Authored-By`.
- Auto-commits intermedios con `[skip ci]` (los hace el hook `gsd-auto-commit` en completo y dirigido).
- Commit final conventional **sin** `[skip ci]` → dispara CI y push real.
- `git push origin main` explicito tras commit final — no confiar solo en el hook.
- Si el repo tiene CI, verificarlo en verde con `gh run list --limit 1` antes de declarar COMPLETADO.
- El pre-commit del gate (completo y dirigido) rechaza todo commit de más de dos archivos sin gate firmado en `.planning/CURRENT_PROMPT.md`, dentro o fuera de las rutas críticas; solo se libra el commit de cierre que lleva únicamente el informe, el índice y el marcador. En ligero no hay pre-commit. Si falta en un clon, se reinstala con la orden de «En un clon nuevo».

### 10. Generar reporte

`prompts/out/NNNN_resultado_descripcion.md` con:

- Todas las secciones de arriba.
- Hash commit final + resultado del push + estado CI.
- Inicio / Fin / Duracion total (`Xh Ym Zs`).

> Perfil **ligero**: este ritual completo NO aplica — basta secrets-guard + check verde de cierre + conventional commits + gate inline en rutas críticas. Ver `adoption-profiles.md`.
<!-- ECO:END ritual -->
