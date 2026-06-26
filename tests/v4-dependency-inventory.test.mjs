import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const inventoryPath = path.join(rootDir, 'docs/v4-dependency-inventory.md');

const protectedEntrypoints = [
  'admin.html',
  'admin-login.html',
  'admin-command-center.html',
  'admin-student.html',
  'admin-students.html',
  'portal-login.html',
  'portal.html',
  'portal-checkin.html',
  'portal-plano-alimentar.html',
  'portal-progressao.html',
  'projeto-lm-jornada.html',
  'projeto-lm-planejamento.html',
  'projeto-lm-biblioteca.html',
  'projeto-lm-conquistas.html',
  'projeto-lm-onboarding.html',
  'anamnese-premium.html'
];

async function listFilesInDir(relativeDir, pattern) {
  try {
    const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && pattern.test(entry.name))
      .map((entry) => path.posix.join(relativeDir, entry.name));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function inventoryFiles() {
  const rootEntries = await readdir(rootDir, { withFileTypes: true });
  const rootFiles = rootEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);

  const htmlFiles = [
    ...rootFiles.filter((file) => file.endsWith('.html')),
    ...(await listFilesInDir('public', /\.html$/))
  ].sort();
  const jsFiles = [
    ...rootFiles.filter((file) => file.endsWith('.js')),
    ...(await listFilesInDir('public/assets/js', /\.js$/))
  ].sort();
  const cssFiles = [
    ...rootFiles.filter((file) => file.endsWith('.css')),
    ...(await listFilesInDir('public/assets/css', /\.css$/))
  ].sort();
  const assetFiles = (await listFilesInDir('public/assets/images', /.+/)).sort();

  return { htmlFiles, jsFiles, cssFiles, assetFiles };
}

function cleanReference(value) {
  if (!value) return null;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed || trimmed.startsWith('#') || trimmed.includes('${')) return null;
  if (/^(https?:|mailto:|tel:|javascript:|data:|\/api\/)/i.test(trimmed)) return null;
  return trimmed.split('#')[0].split('?')[0].replace(/^\.\//, '').replace(/^\//, '');
}

function resolveReference(reference, fromFile) {
  const cleaned = cleanReference(reference);
  if (!cleaned) return null;
  const baseDir = path.posix.dirname(fromFile);
  const base = cleaned.endsWith('.html') && !cleaned.includes('/') ? '' : (baseDir === '.' ? '' : baseDir);
  const resolved = path.posix.normalize(path.posix.join(base, cleaned));
  if (resolved.startsWith('..')) return null;
  return resolved;
}

export function extractHtmlReferences(source, relativePath) {
  const references = [];
  const add = (kind, value) => {
    const resolved = resolveReference(value, relativePath);
    if (resolved) references.push({ kind, target: resolved, source: relativePath });
  };

  for (const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) add('script', match[1]);
  for (const match of source.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) add('stylesheet', match[1]);
  for (const match of source.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*>/gi)) add('stylesheet', match[1]);
  for (const match of source.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) add('html', match[1]);
  for (const match of source.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) add('asset', match[1]);

  return references;
}

export function extractJsReferences(source, relativePath) {
  const references = [];
  const add = (kind, value) => {
    const resolved = resolveReference(value, relativePath);
    if (resolved) references.push({ kind, target: resolved, source: relativePath });
  };

  for (const match of source.matchAll(/import\s+(?:[^'";]+\s+from\s+)?["']([^"']+)["']/g)) add('script', match[1]);
  for (const match of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) add('script', match[1]);
  for (const match of source.matchAll(/["']([^"']+\.html(?:[?#][^"']*)?)["']/g)) add('html', match[1]);
  for (const match of source.matchAll(/["']([^"']*public\/assets\/[^"']+|[^"']*assets\/images\/[^"']+)["']/g)) add('asset', match[1]);

  return references;
}

export function extractCssReferences(source, relativePath) {
  const references = [];
  for (const match of source.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) {
    const resolved = resolveReference(match[1], relativePath);
    if (resolved) references.push({ kind: 'asset', target: resolved, source: relativePath });
  }
  return references;
}

async function collectReferences() {
  const files = await inventoryFiles();
  const references = [];
  for (const htmlFile of files.htmlFiles) references.push(...extractHtmlReferences(await readFile(path.join(rootDir, htmlFile), 'utf8'), htmlFile));
  for (const jsFile of files.jsFiles) references.push(...extractJsReferences(await readFile(path.join(rootDir, jsFile), 'utf8'), jsFile));
  for (const cssFile of files.cssFiles) references.push(...extractCssReferences(await readFile(path.join(rootDir, cssFile), 'utf8'), cssFile));
  return { files, references };
}

function referencesByKind(references, kind) {
  return references.filter((reference) => reference.kind === kind).map((reference) => reference.target);
}

test('inventário de dependências V4 existe e documenta potenciais órfãos', async () => {
  await assert.doesNotReject(access(inventoryPath));
  const inventory = await readFile(inventoryPath, 'utf8');
  assert.match(inventory, /# V4 Dependency Inventory/);
  assert.match(inventory, /potential_orphan/);
});

test('entrypoints protegidos existem', async () => {
  const { htmlFiles } = await inventoryFiles();
  for (const entrypoint of protectedEntrypoints) {
    assert.ok(htmlFiles.includes(entrypoint), `${entrypoint} deve existir e não pode ser tratado como órfão automaticamente.`);
  }
});

test('referências HTML para scripts, stylesheets e páginas internas existem', async () => {
  const { files, references } = await collectReferences();
  const htmlSet = new Set(files.htmlFiles);
  const jsSet = new Set(files.jsFiles);
  const cssSet = new Set(files.cssFiles);

  for (const script of references.filter((reference) => reference.kind === 'script')) {
    assert.ok(jsSet.has(script.target), `${script.source} referencia script inexistente: ${script.target}`);
  }
  for (const stylesheet of references.filter((reference) => reference.kind === 'stylesheet')) {
    assert.ok(cssSet.has(stylesheet.target), `${stylesheet.source} referencia stylesheet inexistente: ${stylesheet.target}`);
  }
  for (const html of references.filter((reference) => reference.kind === 'html')) {
    assert.ok(htmlSet.has(html.target), `${html.source} referencia HTML interno inexistente: ${html.target}`);
  }
});

test('assets referenciados por HTML, JS ou CSS existem', async () => {
  const { files, references } = await collectReferences();
  const knownFiles = new Set([...files.htmlFiles, ...files.jsFiles, ...files.cssFiles, ...files.assetFiles]);
  for (const asset of referencesByKind(references, 'asset')) {
    if (knownFiles.has(asset)) continue;
    await assert.doesNotReject(access(path.join(rootDir, asset)), `Asset referenciado inexistente: ${asset}`);
  }
});
