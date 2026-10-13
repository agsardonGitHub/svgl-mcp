# AGENTS.md — svgl-mcp

> Entrypoint **portable** para cualquier runtime de agente (Claude Code, Codex CLI, futuros; Gemini CLI retirado en 0053). Cada runtime arranca aqui y luego lee SU capa especifica.

## Capas

| Capa             | Fuente                          | Quien la lee                                                                   |
| ---------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Comun (canonica) | `CLAUDE.md`                     | Todos los runtimes — fuente de verdad tecnica del proyecto.                    |
| Comun (heredado) | `.claude/rules/`                | Reglas del ecosistema padre (junction). Todos los runtimes las cargan.        |
| Comun (local)    | `.claude/rules-domain/`         | Reglas locales del proyecto (stack-specific, dominio). Todos los runtimes las cargan también. |
| Comun            | `.claude/skills/`               | Claude (auto-carga). Codex las lee via include explicito si aplica.               |
| Comun            | `.claude/state/`                | Todos — estado vivo del proyecto.                                              |
| Comun            | `docs/`, `prompts/`, `modules/` | Todos — documentacion, trazabilidad y blueprints.                              |
| Adapter Claude   | `.claude/` raiz                 | Claude Code — hooks, agents, settings.                                          |
| Adapter Codex    | `.codex/`                       | Codex CLI — instrucciones, registro, plan-mode rules.                          |
| Multiagente      | `scripts/utils/invoke-external-agent.cjs` + `.claude/rules/multi-agent.md` | Orquestacion Claude+Codex.        |

## Ritual de arranque por runtime

### Claude Code

1. Leer `CLAUDE.md` (auto).
2. Leer `.claude/rules/` (heredadas del ecosistema, via junction) Y `.claude/rules-domain/` (locales del proyecto) aplicables segun keywords del prompt.
3. Leer `.claude/state/CONTEXTO-OPERATIVO.md`, `DECISIONES-ACTIVAS.md`, `HANDOFF.md`, `BACKLOG-IDEAS.md`.
4. Hooks de `.claude/settings.json` se cargan solos.

### Codex CLI

1. Leer este `AGENTS.md`.
2. Leer `.codex/INSTRUCCIONES.md`.
3. Leer `CLAUDE.md` y las rules de `.claude/rules/` + `.claude/rules-domain/` aplicables.
4. En plan mode: aplicar `.codex/rules/plan-mode.md`.
5. Registrar operaciones significativas en `.codex/REGISTRO.md`.

### Gemini CLI (retirado)

Gemini CLI se retiro del ecosistema en el 0053 (0 de 7 invocaciones buenas en 60 dias). El wrapper rechaza `--agent gemini` con error claro y `.gemini/` ya no se siembra. Codex es el unico revisor externo; su suplente es un subagente Claude de contexto limpio (`.claude/rules/multi-agent.md`).

Para soportar un runtime adicional (ej: nuevo CLI), crear `.runtime/INSTRUCCIONES.md` con el ritual de arranque y referenciarlo desde este `AGENTS.md`. La capa comun (`CLAUDE.md`, `.claude/rules/`, `.claude/rules-domain/`, `.claude/state/`) NO se duplica.

## Multiagente (Claude + Codex)

Wrapper unificado en `scripts/utils/invoke-external-agent.cjs`. Protocolo completo en `.claude/rules/multi-agent.md`. Estado: **DEFAULT ON** para Tier 2-3 con fallback layered 3 niveles (Codex/Gemini → sub-agentes Claude → Claude Code directo). Tier 1 trivial bypass.
