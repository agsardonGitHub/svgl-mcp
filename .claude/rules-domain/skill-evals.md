# Skill evals

> Esta regla se carga automáticamente por Claude Code. Vigente desde prompt 0553 (2026-05-02).

## Propósito

Cada uno de los 16 skills `valoria-*` (13 dominio + 3 workflow) tiene una eval suite reproducible que valida que cumple sus triggers + outputs canónicos ante prompts representativos. Origen: PRD-001 APROBADO 2026-05-02.

## Estructura

```
.claude/evals/
├── README.md                          ← documentación operativa
├── .gitignore                         ← .results/ ignorado
└── valoria-<skill>/
    ├── eval-01-<slug>.json
    └── eval-NN-<slug>.json
```

Schema completo en `.claude/evals/README.md`.

## Cuándo correr la suite

**Manual (obligatorio antes de commit que modifique un skill):**

```bash
npx tsx scripts/utils/run-skill-evals.ts --skill valoria-grill
```

Si FAIL: ¿bug del eval (assertions mal escritas) o degradación del skill? Corregir uno u otro antes del commit.

**Manual (todos los skills):**

```bash
npx tsx scripts/utils/run-skill-evals.ts --all
```

**Generar reporte Markdown (opcional):**

```bash
npx tsx scripts/utils/run-skill-evals.ts --all --report docs/eval-reports/$(date +%F).md
```

**JSON machine-readable (para CI/pipelines):**

```bash
npx tsx scripts/utils/run-skill-evals.ts --all --json-output
```

Imprime un bloque `--- JSON_OUTPUT ---` ... `--- END_JSON_OUTPUT ---` con resumen estructurado (`total`, `pass`, `fail`, `error`, `pass_rate`, `results[]`).

**CI (desde 0557):**

GitHub Action `.github/workflows/skill-evals.yml` ejecuta la suite cuando hay cambio en:

- `.claude/skills/**`
- `.claude/evals/**`
- `scripts/utils/run-skill-evals.ts`
- `.github/workflows/skill-evals.yml`

**Modos:**

- **Dry-run** (default en push/PR): valida schemas + descubre evals + reporta cobertura. NO invoca `claude` CLI (cero coste tokens).
- **Real** (`workflow_dispatch` manual con `mode=real`, desde 0560): instala `@anthropic-ai/claude-code` global, ejecuta los 51 evals contra el binario `claude`, genera reporte Markdown en `docs/eval-reports/YYYY-MM-DD-ci-<run_id>.md` y lo sube como artifact (retención 30d).

**Inputs del workflow_dispatch (modo real):**

- `mode`: `dry-run` (default) | `real`
- `skill`: vacío (todos) | nombre específico (ej: `valoria-grill`)
- `model`: `claude-sonnet-4-6` (default · ~$0.80/run completo) | `claude-opus-4-7` (~$3.80/run · usar solo si Sonnet falla en matices) | `claude-haiku-4-5-20251001` (~$0.20/run · suficiente para schemas simples)

**Setup secret ANTHROPIC_API_KEY (admin, una vez):**

1. https://console.anthropic.com/ → Settings → API Keys → Create Key
2. GitHub repo `<owner>/<repo>` → Settings → Secrets and variables → Actions → New repository secret
3. Name: `ANTHROPIC_API_KEY` · Value: el key generado
4. Test: GitHub UI → Actions → Skill evals → Run workflow → mode=real, skill=valoria-grill, model=claude-sonnet-4-6 → Run

Sin secret, el workflow falla con mensaje claro indicando el setup.

**Coste estimado:**

- 51 evals × ~5K tokens cada uno = ~255K tokens/run completo
- Sonnet 4.6 (recomendado): ~$0.80/run · si CI corre 5-10 veces/mes → **$4-8/mes**
- Opus 4.7: ~$3.80/run → $19-38/mes
- Haiku 4.5: ~$0.20/run → $1-2/mes

Trigger restrictivo (paths filter) garantiza que solo corre cuando tiene sentido.

Step summary del workflow incluye:

- En dry-run: tabla cobertura por skill
- En real: modelo usado, skill, link al artifact, head del reporte (primeras 20 líneas)

## Cómo añadir un eval nuevo

Cada vez que un skill cambia su comportamiento (nuevo trigger, output canónico, regla nueva), añadir o actualizar evals:

1. Identificar comportamiento clave a validar
2. Crear `.claude/evals/<skill>/eval-NN-<slug>.json` con schema canónico (`.claude/evals/README.md`)
3. Verificar schema: `npx tsx scripts/utils/run-skill-evals.ts --skill <skill> --dry-run`
4. Ejecutar real: `npx tsx scripts/utils/run-skill-evals.ts --skill <skill>`
5. Si PASS → commit `test(<skill>): eval <slug>` (o incluido en mismo commit del cambio)
6. Si FAIL inesperado → ajustar `expected` (assertions) o el `SKILL.md`

## Convivencia con Vitest

| Sistema         | Qué valida                                    | Ubicación                   |
| --------------- | --------------------------------------------- | --------------------------- |
| **Vitest**      | Código TypeScript (lógica, edge cases, mocks) | `packages/*/src/__tests__/` |
| **Skill evals** | Comportamiento del agente Code ante un prompt | `.claude/evals/<skill>/`    |

NO se solapan. Vitest sigue siendo el principal mecanismo de regresión del código. Las evals validan SOLO los skills.

## Tolerance levels

Las salidas de Code son estocásticas. Para evitar falsos positivos:

- `low` — output casi determinista, falla si no hay match exacto. Usar solo cuando el skill produce salida fija (ej: comandos exactos, regex sin variabilidad)
- `medium` (default) — outputs ligeramente variables. Asume orden de filas, capitalización, sinónimos
- `high` — outputs estocásticos, busca señales fuertes (varios contains/regex). Usar para skills workflow tipo `valoria-grill` que producen tablas con justificaciones libres

## Mantenimiento esperado

- ~30 min/mes ajustando evals que rompen tras refactor intencional de un skill
- Añadir 1-2 evals nuevos cuando se introduce un skill nuevo o un trigger nuevo
- Re-baseline tras bump de modelo Claude Code (Sonnet/Opus)

## Anti-patrones

- ❌ **Eval sin assertions** (todo PASS por defecto) → no aporta señal
- ❌ **Eval con regex demasiado estricto** sobre output estocástico → falsos positivos crónicos
- ❌ **Mover assertion del eval al skill** para que pase (overfitting eval-to-skill)
- ❌ **Saltarse evals al modificar skill** porque "es un cambio menor" → es lo que la suite previene
- ❌ **Eval que depende de estado externo no reproducible** (filesystem, BD, network) — debe ser pura

## Estado actual del sprint PRD-001

- **0553 (este prompt)**: bootstrap + 1 eval ejemplo en valoria-grill
- **0554-0556**: cobertura de los 16 skills (3-5 evals cada uno)
- **0557**: GitHub Action CI
- **0558**: validación + baseline + bug intencional

Hasta que el sprint cierre (0558), la suite está en modo bootstrap — no es bloqueante para commits que toquen `valoria-*/SKILL.md`. Tras 0558, será gate obligatorio.

## Referencias

- `docs/prd/PRD-001-eval-suite-valoria-skills.md` — decisión de producto APROBADA
- `.claude/evals/README.md` — schema y estructura
- `scripts/utils/run-skill-evals.ts` — runner local
- Sprint: prompts 0553-0558
