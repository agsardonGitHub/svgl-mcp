<#
.SYNOPSIS
  Descarga un logo SVG desde svgl.app con cache local en ~/.dev-assets/svgl/.

.DESCRIPTION
  Helper PowerShell standalone (sin pasar por MCP). Util desde shell para:
  - Descargar logo a un path específico
  - Cachear el SVG localmente (TTL configurable)
  - Re-uso offline tras primer fetch

  Cache: $HOME/.dev-assets/svgl/<name>.svg
  TTL default: 30 días (configurable con -CacheTtlDays)

.PARAMETER Name
  Nombre del logo (ej: 'react', 'postgres', 'aws'). Case-insensitive.
  Sanitizado a [a-z0-9-]+ antes de query.

.PARAMETER OutputPath
  Path destino donde copiar el SVG. Si omites, devuelve el path del cache.

.PARAMETER NoCache
  Bypass cache: descarga siempre desde svgl.app.

.PARAMETER CacheTtlDays
  Días de validez del cache (default 30). Tras eso, refetch.

.PARAMETER Theme
  Variante de tema si el logo tiene ambas ('light' o 'dark'). Default 'light'.

.PARAMETER ListCategories
  Lista categorías disponibles y exit.

.PARAMETER Search
  Buscar logos por término (no descarga, solo lista resultados).

.EXAMPLE
  . C:\dev\Tools\svgl-mcp\scripts\Get-BrandLogo.ps1
  Get-BrandLogo -Name react -OutputPath ./logos/react.svg

.EXAMPLE
  Get-BrandLogo -Search "postgres"

.EXAMPLE
  Get-BrandLogo -ListCategories

.EXAMPLE
  # Solo cachear, no copiar:
  $cachedPath = Get-BrandLogo -Name aws
  Write-Host "Cacheado en: $cachedPath"
#>

[CmdletBinding()]
param(
    [string]$Name,
    [string]$OutputPath,
    [switch]$NoCache,
    [int]$CacheTtlDays = 30,
    [ValidateSet('light', 'dark')]
    [string]$Theme = 'light',
    [switch]$ListCategories,
    [string]$Search
)

$ErrorActionPreference = 'Stop'
$API_BASE = 'https://api.svgl.app'
$CACHE_DIR = Join-Path $HOME '.dev-assets/svgl'

function Initialize-Cache {
    if (-not (Test-Path -LiteralPath $CACHE_DIR)) {
        New-Item -ItemType Directory -Path $CACHE_DIR -Force | Out-Null
    }
}

function Test-CacheValid {
    param([string]$Path, [int]$TtlDays)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    $age = (Get-Date) - (Get-Item -LiteralPath $Path).LastWriteTime
    return $age.TotalDays -lt $TtlDays
}

function Invoke-SvglApi {
    param([string]$Path)
    $url = "$API_BASE$Path"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        if ($response.StatusCode -ne 200) {
            throw "HTTP $($response.StatusCode) - $url"
        }
        return $response.Content
    } catch {
        throw "svgl API error: $($_.Exception.Message) - $url"
    }
}

# ListCategories mode
if ($ListCategories) {
    Write-Host "`n== Categorias svgl.app ==`n" -ForegroundColor Cyan
    $json = Invoke-SvglApi -Path '/categories'
    $categories = $json | ConvertFrom-Json
    $categories | ForEach-Object {
        $cat = if ($_.category) { $_.category } else { $_ }
        $count = if ($_.total) { " ($($_.total))" } else { '' }
        Write-Host "  - $cat$count"
    }
    exit 0
}

# Search mode
if ($Search) {
    Write-Host "`n== Buscando '$Search' en svgl.app ==`n" -ForegroundColor Cyan
    $json = Invoke-SvglApi -Path "/?search=$([uri]::EscapeDataString($Search))"
    $results = $json | ConvertFrom-Json
    if (-not $results) {
        Write-Host "  (sin resultados)" -ForegroundColor Yellow
        exit 0
    }
    # Normalizar a array
    if ($results -isnot [array]) { $results = @($results) }
    foreach ($r in $results) {
        Write-Host "  - $($r.title)" -ForegroundColor White -NoNewline
        if ($r.category) { Write-Host " [$($r.category)]" -ForegroundColor Gray -NoNewline }
        Write-Host ""
    }
    Write-Host "`n  Total: $($results.Count) resultados`n"
    exit 0
}

# Download mode (requiere -Name)
if (-not $Name) {
    Write-Error "Falta -Name. Uso: Get-BrandLogo -Name <logo> [-OutputPath <ruta>] [-Search <term>] [-ListCategories]"
    exit 2
}

# Sanitizar name
$safeName = $Name.ToLower() -replace '[^a-z0-9-]', ''
if (-not $safeName) {
    Write-Error "Name invalido tras sanitizacion: '$Name'"
    exit 2
}

Initialize-Cache
$cachePath = Join-Path $CACHE_DIR "${safeName}_${Theme}.svg"

# Fetch o usar cache
if ($NoCache -or -not (Test-CacheValid -Path $cachePath -TtlDays $CacheTtlDays)) {
    # El API svgl NO expone /svg/<name>.svg directo. Hay que:
    # 1. Buscar por name → obtener route (string o {light, dark})
    # 2. Fetch route URL → SVG real
    Write-Host "  [search] $API_BASE/?search=$Name" -ForegroundColor Gray
    try {
        $searchJson = Invoke-SvglApi -Path "/?search=$([uri]::EscapeDataString($Name))"
        $searchResults = $searchJson | ConvertFrom-Json
        if (-not $searchResults) { throw "Sin resultados para '$Name'" }
        if ($searchResults -isnot [array]) { $searchResults = @($searchResults) }

        # Match exacto case-insensitive o primer resultado
        $match = $searchResults | Where-Object { $_.title -and $_.title.ToLower() -eq $Name.ToLower() } | Select-Object -First 1
        if (-not $match) { $match = $searchResults[0] }

        # Resolver route (puede ser string o objeto con theme variants)
        $route = $match.route
        $svgUrl = $null
        if ($route -is [string]) {
            $svgUrl = $route
        } elseif ($route -is [PSCustomObject] -or $route -is [hashtable]) {
            $svgUrl = $route.$Theme
            if (-not $svgUrl) { $svgUrl = $route.light }
            if (-not $svgUrl) { $svgUrl = $route.dark }
        }
        if (-not $svgUrl) { throw "Logo '$($match.title)' sin route valida" }

        Write-Host "  [fetch] $svgUrl" -ForegroundColor Gray
        $response = Invoke-WebRequest -Uri $svgUrl -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        if ($response.StatusCode -ne 200) { throw "HTTP $($response.StatusCode)" }

        Set-Content -LiteralPath $cachePath -Value $response.Content -Encoding UTF8 -NoNewline
        Write-Host "  [cache] $cachePath ($($response.Content.Length) bytes, theme=$Theme)" -ForegroundColor Green
    } catch {
        Write-Error "No se pudo descargar logo '$Name': $($_.Exception.Message)"
        exit 1
    }
} else {
    Write-Host "  [cache-hit] $cachePath" -ForegroundColor Green
}

# Copiar a OutputPath si se especifica
if ($OutputPath) {
    $outDir = Split-Path -Parent $OutputPath
    if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $cachePath -Destination $OutputPath -Force
    Write-Host "  [output] $OutputPath" -ForegroundColor Green
    return $OutputPath
}

return $cachePath
