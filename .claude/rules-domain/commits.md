# Convenciones de commits y hooks

> Cargado automáticamente por Claude Code. Vigente desde prompt 0465 (2026-04-21).

## Conventional commits

Formato: `tipo(scope): descripcion corta`.

Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.

- Imperativo, minusculas, <72 caracteres en la primera linea.
- Cuerpo opcional con bullets explicando que y por que.
- **Nunca** `Co-Authored-By` (regla global `~/.claude/CLAUDE.md`).

## Convención semver auto (desde 0551 — ADR-021 APROBADO 2026-05-02)

Cada push a `main` con commit convencional dispara `semver-bump.yml`, que mapea el commit más fuerte a un bump semántico:

| Commit                                                                        | Bump      | Ejemplo           |
| ----------------------------------------------------------------------------- | --------- | ----------------- |
| `BREAKING CHANGE:` en body o `feat!:` / `fix!:` / `tipo(scope)!:`             | **major** | `1.0.0` → `2.0.0` |
| `feat:` o `feat(scope):` (sin `!`)                                            | **minor** | `1.0.0` → `1.1.0` |
| `fix:` / `fix(scope):` / `perf:` / `perf(scope):`                             | **patch** | `1.0.0` → `1.0.1` |
| Otros (`chore`, `docs`, `refactor`, `test`, `build`, `ci`, `style`, `revert`) | (skip)    | sin cambio        |

**Flujo end-to-end:**

1. Dev push convencional `feat: X` → `semver-bump.yml` dispara
2. Lee commits desde último tag `vN.N.N` (sin sufijo `-DATE`) hasta `HEAD`
3. Calcula bump más alto encontrado
4. Si hay bump: `npm version <bump> --no-git-tag-version` actualiza `package.json` + `package-lock.json` → commit `chore(release): vN.N.N` (SIN `[skip ci]`) → push a main
5. El push de `chore(release):` dispara `release-notes.yml` (que SOLO se activa con commits chore(release):), genera `docs/releases/YYYY-MM-DD-vN.md` con la nueva versión, crea tag **`vN.N.N` puro** (sin `-DATE`) y publica GitHub Release

**Anti-loop:**

- `semver-bump.yml` skipea si commit es `chore(release):` o contiene `[skip ci]`
- `release-notes.yml` solo dispara con `chore(release):` o `workflow_dispatch` manual
- Resultado: cada push productivo genera **un único** ciclo bump+release en ~1 minuto

**Workflow dispatch manual:**

```bash
gh workflow run "Semver bump" --ref main -f force_bump=patch
```

Útil cuando se quiere bumpear sin commit nuevo (caso raro: hotfix de versión).

**Tag estrategia:**

- `v1.1.0` puro (recomendación 0551). Semver garantiza unicidad temporal.
- Si por workflow_dispatch manual coincide con tag existente, el sufijo `-DATE-N` del 0544 sigue como fallback hasta `-10`.

**Impacto en Sentry (actualizado 0559):**

Las releases de Sentry usan **versión semver** (`v1.1.0`) con fallback a SHA. Implementación:

- **Frontend** (`packages/frontend/src/lib/sentry.ts`): `RELEASE = __APP_VERSION__ ?? VITE_GIT_SHA ?? 'dev'`. `__APP_VERSION__` ya viene de `package.json` vía `vite.config.ts` define (desde 0531).
- **Backend** (`packages/backend/src/utils/sentry.ts`): `RELEASE = APP_VERSION ?? GIT_SHA ?? VERCEL → RAILWAY → 'dev'`. `APP_VERSION` se lee de `process.env.APP_VERSION` o de `package.json` directamente en build/start time.
- **Mobile** (`packages/mobile/src/lib/sentry.ts`): `RELEASE = EXPO_PUBLIC_APP_VERSION ?? EXPO_PUBLIC_GIT_SHA ?? 'dev'`.

Tras 0559: el dashboard Sentry agrupa por `v1.1.0` automáticamente en los próximos deploys (Vercel para frontend, Railway para backend). NO requiere cambio de env vars en producción — la versión la lee del `package.json` que ya se bumpea con semver-bump.yml.

## PAT auto-trigger workflows en cascade (desde 0559)

Por defecto, `GITHUB_TOKEN` que usa el job de `semver-bump.yml` para hacer push del `chore(release): vN.N.N` **no dispara workflows en cascade** (limitación de seguridad de GitHub Actions). Resultado: tras un bump, hay que ejecutar `gh workflow run "Release notes"` manualmente.

**Solución (0559):** secret `RELEASE_BOT_PAT` con scope `repo` (Personal Access Token classic). Si está configurado:

```yaml
# .github/workflows/semver-bump.yml — paso checkout
- uses: actions/checkout@v6
  with:
    fetch-depth: 0
    token: ${{ secrets.RELEASE_BOT_PAT || secrets.GITHUB_TOKEN }}
```

El token PAT se asocia al usuario que lo creó (no al bot), por lo que el push del `chore(release):` SÍ dispara `release-notes.yml` automáticamente.

**Setup del PAT (admin, una vez):**

1. GitHub UI → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)
2. Scope mínimo: `repo` (Full control of private repositories)
3. Expiry: recomendado 1 año (renovar antes de expirar)
4. Settings del repo `<owner>/<repo>` → Secrets and variables → Actions → New repository secret
5. Name: `RELEASE_BOT_PAT` · Value: el token generado

**Sin PAT:** el workflow sigue funcionando con `GITHUB_TOKEN`. La única diferencia: tras `feat:` → bump → `chore(release):` no dispara `release-notes.yml` automáticamente. Hay que ejecutar `gh workflow run "Release notes" --ref main` manualmente.

**Verificación:** tras configurar el PAT, hacer un commit `feat:` cualquiera. El flujo completo (bump → release notes → tag → GitHub Release) debe ocurrir en ~1 minuto sin intervención manual.

## Auto-commits con prettier format

Todo hook de auto-commit (Claude Code hooks, Husky, scripts PowerShell) DEBE:

1. Detectar archivos staged con extensiones formateables: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.yml`, `.yaml`, `.css`.
2. Ejecutar `npx prettier --write --ignore-unknown --ignore-path .prettierignore <archivos>` sobre la lista.
3. Re-stage (`git add`) los archivos tras format.
4. Proceder con el commit.

Si `prettier` falla con `exit != 0` → **abortar el commit** con mensaje explicito (`[hook] prettier failed, aborting auto-commit`). NO swallow errors.

### Motivacion (hallazgo 0464 → 0465 M1)

El 0464 cerro con 2 CIs consecutivos rojos en `Lint + Typecheck + Build → Format check`. Causa raiz: el auto-commit hook `.claude/hooks/gsd-auto-commit.js` usa `git commit --no-verify` para evitar loops recursivos con el pre-commit, lo cual bypasea `npx lint-staged` (y por tanto prettier). El CI ejecuta `prettier --check .` sobre todo el repo y falla si algo quedo sin formatear.

El 0465 M1 compensa ese bypass corriendo prettier manualmente dentro del propio hook sobre los archivos staged antes del commit. Asi el commit resultante pasa `prettier --check .` sin intervencion manual.

### Hook vigente

`.claude/hooks/gsd-auto-commit.js` desde version `1.2.0` (ver cabecera del fichero).

Implementacion:

- Regex de deteccion: `/\.(ts|tsx|js|jsx|json|md|ya?ml|css)$/i`
- Lista via `git diff --cached --name-only --diff-filter=ACMR`.
- Llamada: `npx prettier --write --ignore-unknown --ignore-path .prettierignore <archivos>`.
- Timeout: 60s (prettier sobre 100+ archivos toma ~10s).
- Re-stage: `git add <archivos>` explicito (no `git add -u` para no arrastrar otros cambios).

## Test de verificacion

Reproducible manualmente:

```bash
# 1. Crear archivo mal formateado
cat > format-test.ts <<EOF
const x={a:1,    b:2}
function foo(    ){return x}
export {foo}
EOF

# 2. Stagearlo
git add format-test.ts

# 3. Disparar el hook (simula una PostToolUse de Bash)
echo '{"tool_name":"Bash","tool_input":{"command":"echo dummy"}}' | node .claude/hooks/gsd-auto-commit.js

# 4. Verificar que el archivo quedo formateado en el commit
git show HEAD -- format-test.ts
# Esperado: const x = { a: 1, b: 2 }; function foo() { return x; } export { foo };

# 5. Limpiar
git rm --cached format-test.ts && rm format-test.ts
```

Validado en 0465 M1 (2026-04-21): prettier reformateo de 4 lineas → 5 lineas correctas, commit `0cf0aa5e` incluyo el archivo ya formateado.

## Husky pre-commit (ejecucion interactiva)

`.husky/pre-commit` hace:

1. `npx lint-staged` → ESLint + Prettier sobre staged (packages/\*\*).
2. Paridad i18n ES=EN=ZH (`scripts/utils/i18n-parity-check.ts`).
3. Sync ROADMAP → BD si el .md del roadmap esta staged.
4. Regenera `prompt-titles.json` si cambia `prompts/` o `INDEX.md`.

**Solo corre en commits interactivos** (`git commit` sin `--no-verify`). Los auto-commits de Claude Code usan `--no-verify` y por tanto NO pasan por aqui — por eso el hook de Claude Code debe replicar el format check (ver arriba).

## Pre-commit: fetch + check divergencia (desde 0486 — 2026-04-24)

Antes de CUALQUIER commit final de un prompt (el conventional sin `[skip ci]` que dispara CI), Claude Code DEBE:

1. **Fetch** el estado remoto: `git fetch origin main`
2. **Check divergencia** contra `origin/main`:
   ```bash
   git log HEAD..origin/main --oneline | wc -l   # commits que hay en origin y no tengo local
   git log origin/main..HEAD --oneline | wc -l   # commits mios no pusheados
   ```
3. **Si `behind > 0` (hay commits en origin que no tengo)**:
   - **NO hacer commit directamente.** Reportar al admin el diff + pedir decisión.
   - Opciones: `git pull --rebase origin main` (limpio si no hay conflictos) o manejo manual si hay conflicto.
4. **Si `behind == 0`**: continuar con el commit normal.

### Motivacion (0486)

El CEO trabaja desde 3 PCs (casa · oficina · portatil) + OneDrive no sincroniza el repo (solo se hace pull/push via GitHub). Si el agente commitea local sin fetch previo y otro PC pusheó en medio, el push siguiente falla con `non-fast-forward` o peor: el admin pierde commits si alguien hace force-push para resolverlo.

Check temprano evita conflictos en cierre de tandas largas (T1-T5).

### Aplicabilidad

- **Obligatorio** al cierre de cada tanda (commit final conventional).
- **Recomendado** al arrancar un prompt nuevo (parte del ritual de apertura).
- **NO aplica** a auto-commits `[skip ci]` intermedios — quedan locales hasta el cierre del prompt.

### Ejemplo integrado en cierre

```bash
# Antes del commit final:
git fetch origin main
BEHIND=$(git log HEAD..origin/main --oneline | wc -l)
if [ "$BEHIND" -gt 0 ]; then
  echo "⚠️ $BEHIND commits en origin/main que no tienes local. Abortar + consultar admin."
  exit 1
fi

# Si OK, proceder con commit:
git commit -m "docs(NNNN): ..."
```

## Post-commit auto-push

`.husky/post-commit` hace `git push origin main` automaticamente si la rama actual es `main`. Desactivable con `DISABLE_AUTO_PUSH=1`. Instalado por prompt 0422. Actualizado por **0478** para filtrar commits con `[skip ci]` (ver seccion siguiente).

## Auto-commits con `[skip ci]` (desde 0478 — 2026-04-22)

Desde el prompt **0478** los auto-commits del hook `gsd-auto-commit.js` (v1.3.0) incluyen `[skip ci]` en el mensaje. Esto significa:

- Los auto-commits intermedios del agente **NO disparan GitHub Actions** (convencion estandar de GitHub — ningun workflow se activa cuando el mensaje contiene `[skip ci]`).
- El hook `.husky/post-commit` detecta `[skip ci]` y **NO hace `git push`** para esos commits — quedan locales.
- Solo el commit final de un prompt (conventional commit **sin** `[skip ci]`, ej: `feat(NNNN): ...`, `fix(NNNN): ...`, `docs(NNNN): ...`, `chore(NNNN): ...`) dispara CI y pushea a `origin/main`.

### Motivacion

Billing GitHub Actions consumido muy rapido porque cada auto-commit del agente pusheaba y disparaba 4 jobs completos (~15 min/run). Un prompt tipico consumia ~2-3h de minutos.

Reduccion estimada post-0478:

- **Runs por prompt**: de ~10-15 a 1 (~-93%).
- **Minutos por run**: de ~15 a ~9 (~-40%, gracias al cache compartido y eliminacion de SonarCloud).
- **Consumo total por prompt**: ~-94%.

### Consecuencia para el admin

En el flujo tipico el push ocurre **solo al cierre del prompt**, de forma automatica cuando se hace el commit final (conventional sin `[skip ci]`).

Si se necesita push intermedio manual:

```bash
git push origin main
```

El hook no interfiere con pushes manuales — solo filtra los auto-pushes post-commit con `[skip ci]`.

### Desactivacion

- `DISABLE_AUTO_PUSH=1` sigue funcionando (desactiva todo post-commit auto-push).
- Para que un auto-commit SI pushee (caso raro): editar el mensaje manualmente con `git commit --amend -m "..."` quitando `[skip ci]` y pushear.

## Verificacion CI tras commit conventional (desde 0538 — 2026-04-30)

Tras `git push origin HEAD:main` del commit conventional final del prompt, **NO declarar CI verde sin verificar TODOS los workflows del SHA**.

### Procedimiento canonico

1. **NO usar `gh run list --limit 1`** — devuelve solo el primer workflow que termina (suele ser `Release notes` ~20s, NO representa el CI principal de 5-6 min).

2. **Comando primario** — workflow bloqueante directo:

   ```bash
   gh run list --workflow "<workflow-CI-principal>" --branch main --limit 1 --json databaseId,conclusion,status,headSha
   ```

   Validar que `conclusion: success` y que `headSha` coincide con el SHA del commit conventional reciente.

3. **Comando secundario** — barrer otros workflows del mismo SHA:

   ```bash
   gh run list --branch main --limit 5 --json name,conclusion,status,headSha,event
   ```

   Filtrar por `headSha == <sha-conventional>`. Validar que TODOS estan en `success` (excepto `Post-deploy health check` que puede estar `skipped` por trigger `workflow_run`).

4. **Si algun workflow esta en `failure`**: `gh run view <databaseId> --log-failed | tail -40` para causa raiz. Corregir + commit `fix(NNNN+):` (sufijo `+` documentado abajo) + push.

### Workflows habituales (ejemplo)

| Nombre exacto              | Trigger                          | Duracion tipica | Bloqueante                                            |
| -------------------------- | -------------------------------- | --------------- | ----------------------------------------------------- |
| `<workflow-CI-principal>`  | `push` a main                    | 5-6 min         | **Si — principal** (lint + typecheck + build + tests) |
| `Release notes`            | `push` a main                    | 18-21s          | No (genera changelog automatico)                      |
| `Coverage Gate`            | `pull_request`                   | 2-4 min         | Solo en PRs                                           |
| `Post-deploy health check` | `workflow_run` (depende de otro) | 5m-skipped      | Solo si pre-requisitos pasan                          |

### Convencion `fix(NNNN+):` para deuda heredada (oficial desde 0538)

Cuando un prompt N detecta y corrige un fallo introducido por otro prompt M (M < N), el commit del fix usa formato:

```
fix(NNNN+): descripcion concisa del fix

<body explicando que prompt origen introdujo la deuda + por que no se detecto antes>
```

- El sufijo `+` indica **deuda heredada de otro prompt**. Ej: `fix(0537+): tests backend tras Tier 3 split de 0535`.
- Esto preserva trazabilidad: el fix queda en el contexto temporal del prompt N, pero el body cita el origen M.
- Alternativa: si el fix esta totalmente dentro del scope del prompt N, usar `fix(NNNN):` sin `+`.

### Origen

Leccion 0535/0536 — agente reporto CI verde basandose solo en `Release notes` sin verificar el principal. Fallo silencioso 2 prompts seguidos. Ver CLAUDE.md § "CI verde — OBLIGATORIO (endurecido desde 0538)".
