# svgl-mcp

MCP server para [svgl.app](https://svgl.app) — descargar logos SVG de marcas, frameworks y herramientas desde Claude Code, Codex CLI, Gemini CLI, o cualquier cliente MCP-compatible.

## Qué hace

Expone 5 tools sobre el API público de svgl (~660 logos, sin auth):

| Tool | Descripción |
|---|---|
| `svg_search(query, limit?)` | Buscar logos por nombre |
| `svg_list_categories()` | Listar categorías (AI, Software, Framework, Database…) |
| `svg_list_by_category(category, limit?)` | Logos de una categoría |
| `svg_get_metadata(name)` | Metadata + URLs de un logo específico |
| `svg_download(name, output_path, optimized?)` | Descargar SVG a disco |

## Instalación

```bash
cd C:\dev\Tools\svgl-mcp
npm install
```

## Test rápido (sin MCP, contra API directo)

```bash
npm run smoke
# Verifica los 4 endpoints clave: categories, search, by_category, download
```

## Registro en Claude Code

Añadir al `claude_desktop_config.json` (usualmente `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "svgl": {
      "command": "node",
      "args": ["C:\\dev\\Tools\\svgl-mcp\\src\\index.mjs"]
    }
  }
}
```

Reiniciar Claude Code para que cargue el server. Las 5 tools aparecerán como `mcp__svgl__svg_search`, etc.

## Registro en Codex CLI

Añadir al `~/.codex/config.toml`:

```toml
[[mcp_servers]]
name = "svgl"
command = "node"
args = ["C:\\dev\\Tools\\svgl-mcp\\src\\index.mjs"]
```

## Registro en Gemini CLI

Añadir al `~/.gemini/config.json`:

```json
{
  "mcpServers": {
    "svgl": {
      "command": "node",
      "args": ["C:\\dev\\Tools\\svgl-mcp\\src\\index.mjs"]
    }
  }
}
```

## Uso desde Claude Code

Tras registrar, pedir cosas como:

> "Descarga el logo de Postgres a `assets/logos/postgres.svg`"

→ Claude invoca `mcp__svgl__svg_download({name: "postgres", output_path: "assets/logos/postgres.svg"})`.

> "Lista todos los logos de la categoría AI"

→ Claude invoca `mcp__svgl__svg_list_by_category({category: "ai", limit: 50})`.

## Helper PowerShell (uso offline + cache)

Para uso desde shell sin pasar por MCP, ver `scripts/Get-BrandLogo.ps1`:

```powershell
# Cachea en ~/.dev-assets/svgl/<name>.svg si no existe
. C:\dev\Tools\svgl-mcp\scripts\Get-BrandLogo.ps1
Get-BrandLogo -Name react -OutputPath ./logos/react.svg
```

## Restricciones del API svgl

Del propio API svgl: "Don't use the API to create the same product as SVGL." Uso interno de aplicaciones está permitido. Tiene rate limit anti-abuse (no documentado el límite exacto).

## Arquitectura

```
svgl-mcp/
├── package.json              # type=module, bin=svgl-mcp
├── README.md                 # este archivo
├── .gitignore
├── src/
│   └── index.mjs             # MCP server (stdio transport)
└── scripts/
    ├── smoke-test.mjs        # test directo del API svgl
    └── Get-BrandLogo.ps1     # helper PowerShell con cache local
```

**Diseño**:
- Stateless: sin cache en proceso (cliente decide cache, ver helper PS)
- Stdio transport: patrón estándar MCP, compatible con todos los clientes
- Sin logs al stdout (reservado para JSON-RPC); logs debug a stderr
- Sanitización de inputs: `name` en `svg_download` se filtra a `[a-z0-9-]+` para evitar path traversal

## Troubleshooting

| Síntoma | Solución |
|---|---|
| `command not found: node` | Instalar Node.js 20+ |
| MCP server no aparece en Claude Code | Verificar JSON válido en config + reiniciar Claude Code |
| `ECONNREFUSED` / timeout | Sin red o `api.svgl.app` caído. Probar `curl https://api.svgl.app/categories` |
| Tool devuelve `ERROR: svgl API 429` | Rate limit alcanzado. Esperar 1 min |
| SVG descargado vacío o malformado | Probar `optimized: false` por si la optimización falla |

## Roadmap

- [ ] v0.2: cache opcional en disco (TTL configurable)
- [ ] v0.3: tool `svg_to_react_component` (wrapper para generar componente React)
- [ ] v0.4: subir a npm como `@agsardon/svgl-mcp`

## Licencia

MIT. Los SVGs descargados pertenecen a sus respectivas marcas — verificar cada licencia individual antes de usar comercialmente.

## Referencias

- API svgl: https://api.svgl.app
- Web svgl: https://svgl.app
- Repo svgl: https://github.com/pheralb/svgl
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Ecosistema C:\dev: ver `C:\dev\.claude\MANUAL-ECOSISTEMA.md`
