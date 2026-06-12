# CLAUDE.md — svgl-mcp

> Repo adoptado al ecosistema C:\dev via upgrade-repo -Adopt (perfil: ligero).
> Completar briefing tecnico del proyecto debajo de las secciones gestionadas.

<!-- ECO:BEGIN apertura -->
## Perfil de gobierno y ritual de apertura

Este repo declara su perfil en `.claude/ecosystem.json` (`completo | dirigido | ligero | exento`) con sus **rutas críticas** (`criticalPaths`). Tocar una ruta crítica exige gate Plan Mode aunque sea 1 archivo. Ver rule `adoption-profiles.md`.

El hook `eco-session-start` imprime automáticamente al abrir sesión: perfil, CURRENT_PROMPT, HANDOFF pendiente y DECISIONES-ACTIVAS. Si algo aparece ahí, atiéndelo ANTES de empezar trabajo nuevo. Complemento manual:

1. `.claude/state/CONTEXTO-OPERATIVO.md` — qué hacemos, último prompt.
2. `.claude/state/BACKLOG-IDEAS.md` — si tiene items del scope actual, mencionarlos.
<!-- ECO:END apertura -->

<!-- ECO:BEGIN rules -->
## Estructura de rules

Las reglas (`.claude/rules/`) viven en DOS carpetas:

- **`.claude/rules/`** — reglas heredadas del ecosistema vía junction a `C:\dev\.claude\rules` (creada por `crear-nuevo-repo.ps1`). Rules canónicas vigentes: `ecosystem`, `secrets`, `windows`, `conventions`, `multi-agent`, `observability`, `tier-model`, `prompt-lifecycle`, `plan-mode`, `prompt-bloqueo`, `clean-architecture`, `mode-router`, `adoption-profiles`. **Se cargan TODAS automáticamente en cada sesión.** NO editar — modificar el ecosistema raíz vía prompt numerado.
- **`.claude/rules-domain/`** — reglas locales del proyecto: stack-specific (`typescript.md`, `prisma.md`, sembradas desde `rules-domain-seed/` del template), dominio-específico, workflow-específico. Editar libremente. ⚠️ NO se cargan automáticamente: referéncialas desde este CLAUDE.md o invócalas al trabajar el área.

Si el repo se generó SIN ecosistema padre (modo standalone), `rules/` contiene rules locales (no junction).

## Gates obligatorios (resumen operativo)

- **Plan Mode Tier 2-3**: plan formal + OK explícito del admin ANTES de tocar código (`plan-mode.md`). El hook `eco-plan-gate` lo verifica técnicamente según el perfil del manifiesto.
- **Rutas críticas**: tocar un glob de `criticalPaths` = Tier 2 mínimo con gate, aunque sea 1 archivo.
- **Modelo por tarea**: los agents del kit llevan su modelo asignado (`mode-router.md`); para el hilo principal, recomendar `/model` al detectar mismatch.
- **Multi-agente** (`multi-agent.md`): Tier 2-3 → plan Gemini + review Codex vía wrapper, con fallback en 3 niveles.

## Rules de dominio del stack

- `.claude/rules-domain/typescript.md` — convenciones TypeScript del proyecto (si stack TS).
- `.claude/rules-domain/prisma.md` — convenciones Prisma (si stack Prisma).
<!-- ECO:END rules -->

<!-- ECO:BEGIN ritual -->
## Observabilidad del prompt — OBLIGATORIO (perfiles completo/dirigido)

Al INICIAR cada prompt numerado, ANTES de cualquier otra accion:

1. Imprimir banner cian en consola con: numero, titulo, timestamp inicio, N tareas, duracion estimada.
2. Escribir `.planning/CURRENT_PROMPT.md` con estado `EN_EJECUCION`, inicio, PC, tarea actual.
3. Al completar cada Tx: imprimir `✅ T-N completada · HH:MM:SS · +XmYs desde inicio`.
4. Al cerrar: imprimir banner verde + actualizar marcador a `COMPLETADO` con `Fin:` y `Duracion:`.

Bloques PowerShell canonicos en `.claude/rules/prompt-lifecycle.md` seccion "Observabilidad del prompt".

**NO usar** `Set-PromptTitle` ni escribir a `~/.claude/current-prompt-title` — mecanismo deprecado.

---

## Cierre de prompt — OBLIGATORIO tras cada prompt numerado

### 1. Resolver fallos

- Si hay fallos: corregir ANTES de cerrar. No dejar fallos pendientes.
- Ejecutar `tsc --noEmit` + tests → 0 errores obligatorio.
- Si un fallo no se puede resolver: documentar en el reporte con razon y propagar al backlog.

### 2. Modelo de 3 tiers para oportunidades

**Tier 1 — Autonomo SIEMPRE (resolver inline)**: fallos, oportunidades <5 min, refactors locales reversibles. Condiciones: ≤3 archivos, sin cambio API publica, sin cambio schema, sin cambio i18n keys.

**Tier 2 — Autonomo CON REPORTE EXPLICITO (commit separado revertible)**: refactors medianos (<30 min), tests faltantes del scope, mejoras de cobertura de tipos. Condiciones: ≤8 archivos, sin cambio schema, sin cambio API publica, sin cambio comportamiento observable.

**Tier 3 — SIEMPRE esperar aprobacion (propagar al backlog)**: decision arquitectonica, DROP/ALTER destructivos, refactor mayor (>30 min o >8 archivos), cambios en CI/hooks/workflows, breaking changes de API publica, cambios de naming/marca.

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
- `docs/ROADMAP.md` → marcar prompt como COMPLETADO si aplica.
- Si el proyecto tiene BD con tabla `prompts_registro`: UPDATE estado + hashCommit.

### 6. Propagar oportunidades Tier 3 al backlog

- Leer seccion "Oportunidades pendientes" del reporte.
- Propagar cada item a `.claude/state/BACKLOG-IDEAS.md` con prefijo `[NNNN]`.
- Clasificar en: Fallos latentes / Tecnicas / Producto / Operativa.
- NO duplicar — si ya existe, anadir el nuevo prompt al prefijo (`[NNNN][MMMM]`).

### 7. Actualizar estado operativo

- Actualizar `.claude/state/CONTEXTO-OPERATIVO.md` (ultimo prompt + estado).
- Si surgieron decisiones abiertas → `.claude/state/DECISIONES-ACTIVAS.md`.
- Si cierras a mitad de tarea → llenar `.claude/state/HANDOFF.md`.

### 8. Fetch + check divergencia pre-commit (OBLIGATORIO)

Antes del commit final conventional:

```bash
git fetch origin main
BEHIND=$(git log HEAD..origin/main --oneline | wc -l)
if [ "$BEHIND" -gt 0 ]; then
  echo "⚠️ $BEHIND commits en origin/main no locales. Consultar admin antes de pullrebase."
  exit 1
fi
```

Razon: si se trabaja multi-PC, puede haber commits de otro PC sin pullear. Sin check, push final falla con `non-fast-forward`.

### 9. Commit, push verificado y CI verde

- Commit atomico con conventional commits. NUNCA `Co-Authored-By`.
- Auto-commits intermedios con `[skip ci]` (los gestiona `.claude/hooks/gsd-auto-commit.js`).
- Commit final conventional **sin** `[skip ci]` → dispara CI y push real.
- `git push origin main` explicito tras commit final — no confiar solo en el hook.
- Verificar CI verde con `gh run list --limit 1` antes de declarar COMPLETADO.

### 10. Generar reporte

`prompts/out/NNNN_resultado_descripcion.md` con:

- Todas las secciones de arriba.
- Hash commit final + resultado del push + estado CI.
- Inicio / Fin / Duracion total (`Xh Ym Zs`).

> Perfil **ligero**: este ritual completo NO aplica — basta secrets-guard + check verde de cierre + conventional commits + gate inline en rutas críticas. Ver `adoption-profiles.md`.
<!-- ECO:END ritual -->
