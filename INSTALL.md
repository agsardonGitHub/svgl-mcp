# svgl-mcp — Guía de instalación

> NOTA: este repo NO modifica automáticamente `claude_desktop_config.json` ni los configs de Codex/Gemini. El backlog del ecosistema tiene `[0003][CONFIG-DRIFT]` activo — cualquier modificación al config requiere decisión consciente del CEO.

## 1. Instalar dependencias

```bash
cd C:\dev\Tools\svgl-mcp
npm install
```

## 2. Validar funcionamiento

```bash
npm run smoke
# Debe imprimir: PASS: 5/5 tests OK
```

Si no pasa: revisar conectividad con `https://api.svgl.app`.

## 3. Registrar en Claude Code

### Path del config
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- (alternativa documentada por el ecosistema: `~/.claude/claude_desktop_config.json`)

### Bloque a añadir

Añadir a la sección `mcpServers` (crearla si no existe):

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

### Verificar
1. Reiniciar Claude Code
2. En sesión nueva, las 5 tools aparecen como:
   - `mcp__svgl__svg_search`
   - `mcp__svgl__svg_list_categories`
   - `mcp__svgl__svg_list_by_category`
   - `mcp__svgl__svg_get_metadata`
   - `mcp__svgl__svg_download`

## 4. Registrar en Codex CLI (opcional)

Añadir a `~/.codex/config.toml`:

```toml
[[mcp_servers]]
name = "svgl"
command = "node"
args = ["C:\\dev\\Tools\\svgl-mcp\\src\\index.mjs"]
```

## 5. Registrar en Gemini CLI (opcional)

Añadir a `~/.gemini/config.json`:

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

## 6. Uso desde shell sin MCP (helper PowerShell)

```powershell
. C:\dev\Tools\svgl-mcp\scripts\Get-BrandLogo.ps1

# Listar categorías:
Get-BrandLogo -ListCategories

# Buscar logos:
Get-BrandLogo -Search "postgres"

# Descargar con cache local (TTL 30 días, en ~/.dev-assets/svgl/):
Get-BrandLogo -Name react -OutputPath ./logos/react.svg

# Theme variant:
Get-BrandLogo -Name react -Theme dark -OutputPath ./logos/react-dark.svg

# Forzar refetch (sin cache):
Get-BrandLogo -Name react -NoCache
```

## Verificación post-registro en Claude Code

Una vez registrado, en una sesión nueva pedir:

> "Lista las categorías disponibles en svgl"

Claude debería responder usando `mcp__svgl__svg_list_categories()` y devolver las 41 categorías reales.

## Troubleshooting

| Síntoma | Solución |
|---|---|
| Tools `mcp__svgl__*` no aparecen tras reiniciar | Revisar JSON valido + path absoluto correcto + permisos lectura |
| `Cannot find module @modelcontextprotocol/sdk` | Falta `npm install` |
| Smoke test 0/5 OK | Sin red, o `api.svgl.app` caído |
| Smoke test 4/5 (falla list_by_category) | Probar con case correcto: `'Software'` en vez de `'software'` |
| `command not found: node` | Instalar Node.js 20+ |

## Referencias

- Implementación MCP server: `src/index.mjs`
- Helper offline: `scripts/Get-BrandLogo.ps1`
- README operativo: `README.md`
- Manual ecosistema: `C:\dev\.claude\MANUAL-ECOSISTEMA.md` § "Implementar algo nuevo que se propague" sección E (MCP)
- API svgl: https://api.svgl.app
- Repo upstream svgl: https://github.com/pheralb/svgl
