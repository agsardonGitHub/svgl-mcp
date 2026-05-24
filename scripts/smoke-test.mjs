#!/usr/bin/env node
/**
 * Smoke test del API de svgl + flujo svg_download completo.
 * Secuencial (no Promise.all) para output limpio.
 * Invocar con `npm run smoke`.
 */
const API_BASE = 'https://api.svgl.app';

const tests = [];

function record(name, ok, detail) {
  tests.push({ name, ok, detail });
  const status = ok ? 'OK' : 'FAIL';
  const color = ok ? '\x1b[32m' : '\x1b[31m';
  console.log(`  ${color}${status}\x1b[0m  ${name.padEnd(40)} ${detail || ''}`);
}

async function testJson(name, url, validator) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return record(name, false, `HTTP ${r.status}`);
    const data = await r.json();
    const ok = validator(data);
    const count = Array.isArray(data) ? data.length : Object.keys(data).length;
    record(name, ok, ok ? `${count} entradas` : 'validator failed');
    return data;
  } catch (err) {
    record(name, false, err.message);
    return null;
  }
}

async function testSvgDownloadFlow() {
  // El svgl API NO expone /svg/<name>.svg directo. El SVG está en route
  // del resultado del search. Probamos el flujo completo:
  // 1. search react → obtener route (puede ser string o {light, dark})
  // 2. fetch route URL → SVG real
  try {
    const r1 = await fetch(`${API_BASE}/?search=React`, { headers: { Accept: 'application/json' } });
    if (!r1.ok) return record('svg_download flow (search)', false, `HTTP ${r1.status}`);
    const results = await r1.json();
    const react = (Array.isArray(results) ? results : [results]).find(
      (x) => x.title?.toLowerCase() === 'react'
    );
    if (!react) return record('svg_download flow (search)', false, 'React no encontrado');
    record('svg_download flow (search)', true, `route=${typeof react.route}`);

    const url = typeof react.route === 'string' ? react.route : react.route.light;
    const r2 = await fetch(url, { headers: { Accept: 'image/svg+xml' } });
    if (!r2.ok) return record('svg_download flow (fetch)', false, `HTTP ${r2.status}`);
    const svg = await r2.text();
    const isSvg = svg.startsWith('<svg') || svg.includes('<?xml');
    record('svg_download flow (fetch)', isSvg, `${svg.length} bytes`);
  } catch (err) {
    record('svg_download flow', false, err.message);
  }
}

console.log('\n== svgl-mcp smoke test ==\n');

await testJson('list_categories', `${API_BASE}/categories`, (d) => Array.isArray(d) && d.length > 0);
await testJson('search (react)', `${API_BASE}/?search=react`, (d) => {
  const arr = Array.isArray(d) ? d : [d];
  return arr.length > 0 && arr[0].title;
});
// NOTA: algunas categorías son case-sensitive (acronyms: 'AI', 'OS').
// 'software' funciona en ambos casos.
await testJson('list_by_category (software)', `${API_BASE}/category/software`, (d) => {
  const arr = Array.isArray(d) ? d : [d];
  return arr.length > 0;
});
await testSvgDownloadFlow();

const ok = tests.filter((t) => t.ok).length;
const total = tests.length;
console.log(`\n${ok === total ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}: ${ok}/${total} tests OK\n`);
process.exit(ok === total ? 0 : 1);
