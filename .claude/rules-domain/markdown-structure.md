# Estructura de títulos Markdown

> Esta regla se carga automáticamente por Claude Code. Vigente desde prompt 0496 (2026-04-25).

## Convención obligatoria

Todo `.md` del repo (excepto `docs/archive/` y código en `packages/`) sigue:

- **Un único H1 (`#`) por documento** — el título del documento.
- **H2 (`##`) para secciones top-level** (Objeto y Alcance, Definiciones, Responsables, Desarrollo, Anexos, etc.).
- **H3 (`###`) para subsecciones** (dentro de una sección H2).
- **H4-H5-H6** para detalle más profundo según necesidad.

## Por qué

- GFM (GitHub Flavored Markdown) renderiza H1 grande, H2 mediano, H3 pequeño. Múltiples H1 por doc rompen la jerarquía visual: el técnico/IA no distingue título de sección.
- El outline navegable de VSCode (Ctrl+Shift+O) muestra estructura jerárquica solo si los títulos están escalonados.
- Convención WCAG y SEO: un H1 por documento.

## Aplicación automática

Los 51 docs proyecto (régimen repo, post-0490) y los 93 docs empresa (régimen BD → cache `docs/core/`) son normalizados automáticamente por:

- **Función pura**: `packages/backend/src/utils/normalize_headings.ts` exporta `normalizeHeadings(content): { content, flags }`.
- **Sync BD → repo**: `scripts/utils/sync_docs_from_db.ts` invoca la función antes de cada `fs.writeFileSync`. Cada `npm run sync:docs` (diff) o `npm run sync:docs:full` aplica la normalización a los 93 docs/core/.
- **One-shot 51 ex-BD**: ejecutado en 0496 (script en `scripts/legacy/0496_apply_normalize_headings.mjs`).

## Excepciones (la función NO toca, flagea con TODO)

- **`NO_H1`**: doc sin H1 detectable (empieza con `##` u otro). Revisar manualmente: probable que falte el H1 título.
- **`PARALLEL_H1`**: >5 H1 paralelos sin descendientes (ej: fichas de caracterización con `# Identificación`, `# Descripción`, `# Entradas y salidas`, `# Documentación`, `# Herramientas`, `# Indicadores`...). Mantener si es jerarquía intencional, o consolidar manualmente bajo un H1 padre + H2 cada anexo.
- **`H6_SATURATED`**: cascada llegó a H6, no puede bajar más. Aceptar como límite del estándar.

## Cuándo escribir un doc nuevo

Empieza siempre por un `# Título` único, luego `## Sección 1`, `## Sección 2` con sus `### Subsecciones`. La normalización es defensiva — no es excusa para no escribir bien desde el origen.

## NO incluido (futuro)

- **Numeración ISO** (`1.`, `1.1`, `1.1.1`...) en H2/H3/H4 — sería **Opción B** (bautizada como 0497 si se decide). Hoy se queda con jerarquía visual sin numeración.
- **CSS counters en visor web** (DocViewer ProseMirror) — sería **Opción C** (sincronización completa). Aparcado.

## Tests

7 tests unit en `packages/backend/src/__tests__/normalize_headings.test.ts`:

1. Idempotencia con 1 H1
2. Cascada con 4 H1 (1 título + 3 secciones)
3. Flag PARALLEL_H1 con 8 H1 paralelos sin descendientes
4. Flag NO_H1 con doc empezando por H2
5. H1 dentro de code block ignorado
6. H6 saturado flag por línea, demás bajan normal
7. Doble pasada idempotencia

## Referencias

- Prompt origen: 0496 (2026-04-25)
- Función: `packages/backend/src/utils/normalize_headings.ts`
- Tests: `packages/backend/src/__tests__/normalize_headings.test.ts`
- Integración sync: `scripts/utils/sync_docs_from_db.ts` línea ~333
- Script one-shot: `scripts/legacy/0496_apply_normalize_headings.mjs`
