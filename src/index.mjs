#!/usr/bin/env node
/**
 * svgl-mcp — MCP server para svgl.app
 *
 * Expone tools para buscar, listar y descargar logos SVG desde Claude Code,
 * Codex CLI, Gemini CLI o cualquier cliente MCP-compatible.
 *
 * API base: https://api.svgl.app (público, sin auth, con rate limit anti-abuse).
 *
 * Tools expuestas:
 *  - svg_search(query): buscar logos por nombre
 *  - svg_list_categories(): listar todas las categorías
 *  - svg_list_by_category(category): logos de una categoría
 *  - svg_get_metadata(name): metadata + URLs de un logo
 *  - svg_download(name, output_path): descargar SVG a disco
 *
 * Diseño: stateless, sin caché en proceso (el cliente decide cache).
 * El helper PowerShell complementario `Get-BrandLogo.ps1` añade cache local.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const API_BASE = 'https://api.svgl.app';
const USER_AGENT = 'svgl-mcp/0.1.0 (https://github.com/agsardonGitHub/svgl-mcp)';

/**
 * Fetch wrapper con timeout + user-agent + error handling.
 *
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<Response>}
 * @throws {Error} si HTTP >=400 o timeout
 */
async function svglFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`svgl API ${response.status} ${response.statusText} - ${url}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Tool implementations
 */
const tools = {
  async svg_search({ query, limit = 10 }) {
    if (!query || typeof query !== 'string') {
      throw new Error('query (string) requerido');
    }
    const url = `${API_BASE}/?search=${encodeURIComponent(query)}`;
    const response = await svglFetch(url);
    const data = await response.json();
    const list = Array.isArray(data) ? data : [data];
    return list.slice(0, limit);
  },

  async svg_list_categories() {
    const response = await svglFetch(`${API_BASE}/categories`);
    return await response.json();
  },

  async svg_list_by_category({ category, limit = 50 }) {
    if (!category || typeof category !== 'string') {
      throw new Error('category (string) requerido');
    }
    // NOTA case-sensitivity: algunas categorías son acronyms case-sensitive
    // (ej: 'AI' funciona, 'ai' 404). Otras aceptan ambos. Fallback automático
    // a versión con first-letter-uppercase si lowercase falla con 404.
    const tryCategory = async (cat) => {
      const url = `${API_BASE}/category/${encodeURIComponent(cat)}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!response.ok) return null;
      return await response.json();
    };
    let data = await tryCategory(category);
    if (!data) {
      // Fallback: first-letter upper, resto lower (normalización canónica)
      const titleCase = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      if (titleCase !== category) data = await tryCategory(titleCase);
    }
    if (!data) {
      // Fallback final: all-upper (acronyms tipo AI)
      data = await tryCategory(category.toUpperCase());
    }
    if (!data) {
      throw new Error(
        `Categoría '${category}' no encontrada. Usa svg_list_categories() para ver nombres exactos.`
      );
    }
    const list = Array.isArray(data) ? data : [data];
    return list.slice(0, limit);
  },

  async svg_get_metadata({ name }) {
    if (!name || typeof name !== 'string') {
      throw new Error('name (string) requerido');
    }
    // Primero buscar por nombre exacto
    const results = await tools.svg_search({ query: name, limit: 20 });
    if (results.length === 0) {
      throw new Error(`No se encontró logo con name='${name}'. Prueba svg_search con query parcial.`);
    }
    // Match exacto (case-insensitive) o primer resultado
    const exact = results.find(
      (r) => r.title?.toLowerCase() === name.toLowerCase()
    );
    return exact || results[0];
  },

  async svg_download({ name, output_path, theme = 'light' }) {
    if (!name || typeof name !== 'string') {
      throw new Error('name (string) requerido');
    }
    if (!output_path || typeof output_path !== 'string') {
      throw new Error('output_path (string) requerido');
    }
    if (theme !== 'light' && theme !== 'dark') {
      throw new Error("theme debe ser 'light' o 'dark'");
    }
    // 1. Buscar metadata por nombre para resolver `route` real.
    //    El API NO expone /svg/<name>.svg directo — el SVG está en `route` del search.
    //    `route` puede ser string (sin theme variants) u objeto {light, dark}.
    const metadata = await tools.svg_get_metadata({ name });
    const route = metadata.route;
    let svgUrl;
    if (typeof route === 'string') {
      svgUrl = route;
    } else if (route && typeof route === 'object') {
      svgUrl = route[theme] || route.light || route.dark;
      if (!svgUrl) {
        throw new Error(`Logo '${metadata.title}' no tiene URL en route: ${JSON.stringify(route)}`);
      }
    } else {
      throw new Error(`Logo '${metadata.title}' sin route válida: ${JSON.stringify(route)}`);
    }

    // 2. Fetch del SVG real (desde svgl.app, no api.svgl.app)
    const response = await fetch(svgUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/svg+xml,*/*' },
    });
    if (!response.ok) {
      throw new Error(`svgl SVG fetch ${response.status} - ${svgUrl}`);
    }
    const svgText = await response.text();

    // 3. Sanitizar output_path + escribir a disco
    const resolved = resolve(output_path);
    await mkdir(dirname(resolved), { recursive: true });
    await writeFile(resolved, svgText, 'utf8');
    return {
      success: true,
      name: metadata.title,
      path: resolved,
      bytes: Buffer.byteLength(svgText, 'utf8'),
      theme,
      source_url: svgUrl,
    };
  },
};

/**
 * MCP server setup
 */
const server = new Server(
  {
    name: 'svgl-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions con JSON Schema para inputs
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'svg_search',
      description:
        'Buscar logos SVG por nombre o término. Devuelve hasta `limit` resultados (default 10) con metadata (id, title, category, route, url).',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "Término de búsqueda (ej: 'react', 'postgres', 'aws')",
          },
          limit: {
            type: 'number',
            description: 'Máximo de resultados a devolver (default 10)',
            default: 10,
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'svg_list_categories',
      description: 'Lista todas las categorías de logos disponibles (AI, Software, Framework, Database, etc.).',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'svg_list_by_category',
      description: 'Lista logos de una categoría específica (ej: "software", "ai", "framework", "database").',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Nombre de categoría (lowercase)',
          },
          limit: { type: 'number', default: 50 },
        },
        required: ['category'],
      },
    },
    {
      name: 'svg_get_metadata',
      description:
        'Obtiene metadata completa de un logo específico por nombre exacto (theme variants, brandUrl, wordmark si aplica).',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre exacto del logo (ej: "React", "PostgreSQL")' },
        },
        required: ['name'],
      },
    },
    {
      name: 'svg_download',
      description:
        'Descarga un logo SVG y lo guarda en disco. Resuelve theme variants (light/dark) si el logo tiene ambas. Crea directorios padre si no existen.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre del logo (ej: "React", "PostgreSQL")' },
          output_path: {
            type: 'string',
            description: 'Ruta absoluta o relativa donde guardar el SVG',
          },
          theme: {
            type: 'string',
            enum: ['light', 'dark'],
            description: 'Variante de tema si el logo tiene ambas (default light)',
            default: 'light',
          },
        },
        required: ['name', 'output_path'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = tools[name];
  if (!tool) {
    throw new Error(`Tool desconocida: ${name}`);
  }
  try {
    const result = await tool(args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: `ERROR en ${name}: ${err.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Arranque del server vía stdio (patrón estándar MCP)
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // No console.log al stdout — stdio se usa para JSON-RPC del protocolo MCP.
  // Logs de debug van a stderr.
  console.error('[svgl-mcp] server arrancado, esperando requests via stdio');
}

main().catch((err) => {
  console.error('[svgl-mcp] fatal:', err);
  process.exit(1);
});
