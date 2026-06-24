import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const apiPath = path.join(rootDir, 'workers/api.js');
const inventoryPath = path.join(rootDir, 'docs/v4-route-inventory.md');

const criticalRoutes = [
  '/api/portal/login',
  '/api/portal/me',
  '/api/portal/checkin',
  '/api/portal/nutrition-plan',
  '/api/portal/progression',
  '/api/admin/command-center',
  '/api/admin/student-360',
  '/api/admin/students',
  '/api/admin/health-check',
  '/api/admin/operational-logs',
  '/api/project-lm/profile',
  '/api/portal/project-lm/current-mission',
  '/api/portal/project-lm/daily-actions/summary'
];

const frontendCriticalRoutes = [
  '/api/portal/checkin',
  '/api/portal/nutrition-plan',
  '/api/portal/progression',
  '/api/admin/command-center',
  '/api/admin/student-360',
  '/api/admin/students',
  '/api/admin/health-check',
  '/api/admin/operational-logs',
  '/api/project-lm/profile',
  '/api/portal/project-lm/current-mission',
  '/api/portal/project-lm/daily-actions/summary'
];

function regexLiteralToRoute(pattern) {
  return pattern
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replaceAll('\\/', '/')
    .replace(/\[\^\/\]\+/g, ':param')
    .replace(/\[\^\/\]\*/g, ':param')
    .replace(/\\d\+/g, ':id');
}

function methodNear(source, index) {
  const window = source.slice(index, index + 260);
  const methodMatch = window.match(/method\s*={2,3}\s*['"]([A-Z]+)['"]/);
  return methodMatch?.[1] || 'ANY';
}

export function extractWorkerRoutes(source) {
  const routes = [];
  const add = (route) => {
    if (!routes.some((item) => item.method === route.method && item.route === route.route && item.type === route.type)) routes.push(route);
  };

  for (const match of source.matchAll(/url\.pathname\s*={2,3}\s*['"]([^'"]+)['"]/g)) {
    add({ method: methodNear(source, match.index), route: match[1], type: 'exact', note: '' });
  }

  for (const match of source.matchAll(/url\.pathname\.startsWith\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    add({ method: methodNear(source, match.index), route: `${match[1]}*`, type: 'startsWith', note: 'rota/prefixo dinâmico' });
  }

  for (const match of source.matchAll(/\/\^((?:\\\/|[^/])+)\$\/\.test\(url\.pathname\)/g)) {
    add({ method: methodNear(source, match.index), route: regexLiteralToRoute(`^${match[1]}$`), type: 'regex', note: 'rota dinâmica aproximada' });
  }

  return routes.sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method));
}

function normalizeFrontendRoute(route) {
  return route
    .replace(/^\$\{API_BASE\}/, '/api')
    .split('?')[0]
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/\+\s*[^/]+/g, ':param');
}

export function extractFrontendRoutes(files) {
  const routeFiles = new Map();
  const add = (route, file) => {
    const normalized = normalizeFrontendRoute(route);
    if (!normalized.startsWith('/api/')) return;
    if (!routeFiles.has(normalized)) routeFiles.set(normalized, new Set());
    routeFiles.get(normalized).add(file);
  };

  for (const { relativePath, source } of files) {
    for (const match of source.matchAll(/fetch\(\s*([`'"])(\/api\/[^`'"]+|\$\{API_BASE\}[^`'"]*)\1/g)) add(match[2], relativePath);
    for (const match of source.matchAll(/fetchJson\(\s*([`'"])(\/api\/[^`'"]+)\1/g)) add(match[2], relativePath);
    for (const match of source.matchAll(/api\(\s*([`'"])(\/[^`'"]+)\1/g)) add(`/api${match[2]}`, relativePath);
    for (const match of source.matchAll(/fetchSafe\(\s*([`'"])(\/[^`'"]+)\1/g)) add(`/api${match[2]}`, relativePath);
    for (const match of source.matchAll(/[`'"](\/api\/[^`'"\s<>)]+)[`'"]/g)) add(match[1], relativePath);
  }

  return [...routeFiles.entries()]
    .map(([route, filesForRoute]) => ({ route, files: [...filesForRoute].sort() }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

async function frontendSources() {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const rootFiles = entries
    .filter((entry) => entry.isFile() && (/\.html$/.test(entry.name) || /\.js$/.test(entry.name)))
    .map((entry) => entry.name);
  let assetJs = [];
  try {
    assetJs = (await readdir(path.join(rootDir, 'public/assets/js'), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /\.js$/.test(entry.name))
      .map((entry) => `public/assets/js/${entry.name}`);
  } catch {}
  return Promise.all([...rootFiles, ...assetJs].sort().map(async (relativePath) => ({
    relativePath,
    source: await readFile(path.join(rootDir, relativePath), 'utf8')
  })));
}

test('inventário de rotas V4 existe', async () => {
  await assert.doesNotReject(access(inventoryPath));
});

test('rotas críticas continuam declaradas no Worker', async () => {
  const routes = extractWorkerRoutes(await readFile(apiPath, 'utf8'));
  const declared = new Set(routes.map((route) => route.route));
  for (const criticalRoute of criticalRoutes) {
    assert.ok(declared.has(criticalRoute), `${criticalRoute} deve continuar declarada no Worker.`);
  }
});

test('rotas críticas aplicáveis continuam consumidas pelo frontend', async () => {
  const frontendRoutes = extractFrontendRoutes(await frontendSources());
  const consumed = new Set(frontendRoutes.map((route) => route.route));
  for (const criticalRoute of frontendCriticalRoutes) {
    assert.ok(consumed.has(criticalRoute), `${criticalRoute} deve continuar consumida pelo frontend quando aplicável.`);
  }
});

test('inventário menciona endpoints operacionais protegidos', async () => {
  const inventory = await readFile(inventoryPath, 'utf8');
  assert.match(inventory, /\/api\/admin\/health-check/);
  assert.match(inventory, /\/api\/admin\/operational-logs/);
  assert.match(inventory, /não encontrada no frontend — revisar manualmente/);
});
