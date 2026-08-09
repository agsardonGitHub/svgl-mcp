---
name: auditoria-web
description: >-
  Auditar una web o webapp en tres dimensiones (accesibilidad con axe, rendimiento con presupuesto
  Core Web Vitals, SEO con checklist ejecutable) y llevar los hallazgos a CERRADOS: cada finding se
  mapea al archivo que lo causa, se corrige por lotes por causa raiz y se re-audita. Usar cuando se
  pida auditar, revisar u optimizar una web, su accesibilidad, su rendimiento o su SEO.
---
> **Origen**: propia del ecosistema (prompt 0034), tras rechazar `audit-website` (55/120: dependía de
> un binario de terceros y de su MCP). Conserva su idea buena — el bucle auditar→mapear→corregir→re-auditar —
> con herramientas que ya gobernamos.

# Auditoría web — método y herramientas

## El método (esto es lo que vale)

```
1. INVENTARIAR   las páginas representativas (home, listado, detalle, formulario, login)
2. AUDITAR       cada página en las 3 dimensiones → findings con severidad
3. MAPEAR        cada finding AL ARCHIVO que lo causa (sin esto, el informe es decorativo)
4. AGRUPAR       por causa raíz: 40 findings suelen ser 5 causas
5. CORREGIR      por lotes (una causa = un commit revertible)
6. RE-AUDITAR    hasta verde. La auditoría no "informa": CIERRA
```

El paso 3 es el que separa esta skill de un informe de consultor: un finding sin archivo asignado
no es accionable. `img sin alt en /productos` → `src/modules/catalog/ProductCard.tsx:34`.

## Las 3 dimensiones y su herramienta (todas de registro npm oficial)

| Dimensión | Herramienta | Umbral de partida |
|---|---|---|
| Accesibilidad | `@axe-core/playwright` (tags wcag2a/aa/22aa) | 0 violaciones critical/serious |
| Rendimiento | `capturePerf` del toolkit (LCP/FCP/TTFB) | LCP < 3000ms, FCP < 1800ms |
| SEO | Checklist Playwright: title 10-60, meta description, UN h1, canonical, og:*, `html[lang]`, alt en imgs, enlaces rotos | 0 fallos en páginas indexables |

**Punto de partida ejecutable**: los proyectos con módulo frontend traen
`scripts/audit/auditoria.spec.ts` (spec con las 3 dimensiones), `scripts/audit/audit-toolkit.ts`
(findings.md, metrics.json, screenshots, captura de consola) y el script `npm run audit`.
Adaptar la lista `PAGINAS` y el `PRESUPUESTO` al proyecto: ese es el primer paso de la auditoría.

## Reglas del ecosistema (límites duros)

- **Dependencias**: si falta `@playwright/test` o `@axe-core/playwright`, proponer `npm i -D` del
  registro oficial DENTRO del plan gateado. **Jamás binarios sueltos ni instaladores de webs de
  terceros** (la línea que descalificó a audit-website).
- **Las correcciones siguen el ritual**: >3 archivos → gate + `@code-reviewer`; textos → paridad
  i18n; nada de "arreglos" que cambien comportamiento sin plan.
- Findings de severidad `critical` en accesibilidad **bloquean** el cierre del prompt que los
  encontró: o se corrigen, o quedan como PARCIAL con motivo.

## Profundizar

- `wcag-audit-patterns` — la teoría WCAG 2.2 detrás de los findings de axe (qué criterio incumple
  cada regla y cómo remediarlo).
- `playwright-best-practices` → `testing-patterns/accessibility.md` y `performance-testing.md`
  (integración avanzada: AxeBuilder por componente, web-vitals en CI).
- Findings de diseño visual (no conformidad): eso es de `@gsd-ui-auditor`, no de esta skill.
