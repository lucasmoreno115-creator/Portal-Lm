#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { replayMigrations, introspectSqliteDb } from './db-tool.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(root, 'qa', 'sprint1-policy.json');
const failures = [];
const evidence = [];

function fail(scope, message, details = {}) { failures.push({ scope, message, ...details }); }
function pass(scope, message, details = {}) { evidence.push({ scope, message, ...details }); }
function posix(relativePath) { return relativePath.split(path.sep).join('/'); }
function read(relativePath) { return readFileSync(path.join(root, relativePath), 'utf8'); }

function requirePath(relativePath, scope) {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) fail(scope, `Caminho obrigatório ausente: ${relativePath}`);
  else pass(scope, `Caminho encontrado: ${relativePath}`);
  return fullPath;
}

function walk(relativeRoot) {
  const start = path.join(root, relativeRoot);
  if (!existsSync(start)) return [];
  const output = [];
  const visit = (absolute) => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const child = path.join(absolute, entry.name);
      if (entry.isDirectory()) visit(child);
      else output.push(posix(path.relative(root, child)));
    }
  };
  visit(start);
  return output.sort();
}

function loadPolicy() {
  requirePath('qa/sprint1-policy.json', 'policy');
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

function auditMigrationCatalog() {
  const scope = 'migrations';
  const dir = requirePath('migrations', scope);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
  if (files.length === 0) { fail(scope, 'Nenhuma migration numerada encontrada.'); return null; }

  const numbers = files.map((name) => Number(name.slice(0, 4)));
  const duplicates = [...new Set(numbers.filter((number, index) => numbers.indexOf(number) !== index))];
  if (duplicates.length) fail(scope, 'Numeração duplicada de migrations.', { duplicates });
  else pass(scope, 'Numeração de migrations sem duplicidade.', { count: files.length });

  const invalidOrder = [];
  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] <= numbers[index - 1]) invalidOrder.push({ previous: files[index - 1], current: files[index] });
  }
  if (invalidOrder.length) fail(scope, 'Ordem de migrations inválida.', { invalidOrder });
  else pass(scope, 'Ordenação de migrations válida.');

  const replay = replayMigrations();
  if (!replay.ok) { fail(scope, 'Replay oficial de migrations falhou.', { error: replay.error, applied: replay.applied }); return replay; }

  const schema = introspectSqliteDb(replay.database);
  pass(scope, 'Replay oficial de migrations aprovado.', {
    applied: replay.applied.length,
    tables: schema.tables.length,
    indexes: Object.values(schema.indexes).reduce((total, list) => total + list.length, 0),
    triggers: schema.triggers.length,
    views: schema.views.length,
  });
  return replay;
}

function auditDatabaseIntegrity(replay) {
  const scope = 'database-integrity';
  if (!replay?.ok || !replay.database) return fail(scope, 'Integridade não executada porque o replay falhou.');
  const database = new DatabaseSync(replay.database);
  try {
    const integrity = database.prepare('PRAGMA integrity_check;').all();
    const integrityOk = integrity.length === 1 && integrity[0].integrity_check === 'ok';
    if (!integrityOk) fail(scope, 'PRAGMA integrity_check reprovado.', { integrity });
    else pass(scope, 'PRAGMA integrity_check aprovado.');

    const foreignKeyFailures = database.prepare('PRAGMA foreign_key_check;').all();
    if (foreignKeyFailures.length) fail(scope, 'PRAGMA foreign_key_check encontrou violações.', { foreignKeyFailures });
    else pass(scope, 'PRAGMA foreign_key_check aprovado.');

    const foreignKeys = [];
    for (const table of database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
      const rows = database.prepare(`PRAGMA foreign_key_list(${JSON.stringify(table.name)});`).all();
      for (const row of rows) foreignKeys.push({ table: table.name, from: row.from, targetTable: row.table, targetColumn: row.to, onDelete: row.on_delete, onUpdate: row.on_update });
    }
    pass(scope, 'Relacionamentos declarados catalogados.', { foreignKeyCount: foreignKeys.length, foreignKeys });
  } finally {
    database.close();
    rmSync(path.dirname(replay.database), { recursive: true, force: true });
  }
}

function auditLifecycle(policy) {
  const scope = 'lifecycle';
  const sqlFiles = walk('migrations').filter((file) => file.endsWith('.sql'));
  const corpus = sqlFiles.map((file) => read(file)).join('\n').toUpperCase();
  const missing = policy.lifecycle.requiredStates.filter((state) => !corpus.includes(state));
  if (missing.length) fail(scope, 'Estados obrigatórios do lifecycle ausentes nas migrations.', { missing });
  else pass(scope, 'Todos os estados obrigatórios do lifecycle estão representados nas migrations.', { states: policy.lifecycle.requiredStates });
}

function routeFromFunctionFile(file) {
  let route = file.replace(/^functions/, '').replace(/\.(?:js|mjs|ts)$/, '');
  route = route.replace(/\/index$/, '');
  route = route.replace(/\[\.\.\.[^\]]+\]/g, '*').replace(/\[[^\]]+\]/g, ':param');
  return route || '/';
}

function normalizeApiReference(value) {
  return value.split('?')[0].replace(/\$\{[^}]+\}/g, ':param').replace(/\/+$/, '') || '/';
}

function routeCompatible(frontendRoute, backendRoute) {
  const frontParts = frontendRoute.split('/').filter(Boolean);
  const backParts = backendRoute.split('/').filter(Boolean);
  for (let index = 0; index < backParts.length; index += 1) {
    if (backParts[index] === '*') return frontParts.length >= index;
    if (frontParts[index] == null) return false;
    if (backParts[index] === ':param' || frontParts[index] === ':param') continue;
    if (backParts[index] !== frontParts[index]) return false;
  }
  return frontParts.length === backParts.length;
}

function auditApiContracts(policy) {
  const scope = 'api-contracts';
  const frontendFiles = policy.contracts.frontendRoots.flatMap(walk).filter((file) => /\.(?:html|js|mjs|ts)$/.test(file));
  const backendFiles = policy.contracts.backendRoots.flatMap(walk).filter((file) => /\.(?:js|mjs|ts)$/.test(file));
  const backendRoutes = backendFiles.map(routeFromFunctionFile);
  const ignored = policy.contracts.ignoredApiPatterns.map((pattern) => new RegExp(pattern));
  const references = new Map();
  const apiRegex = /["'`](\/api\/[A-Za-z0-9_\-./${}:[\]]+)/g;

  for (const file of frontendFiles) {
    const source = read(file);
    for (const match of source.matchAll(apiRegex)) {
      const route = normalizeApiReference(match[1]);
      if (ignored.some((pattern) => pattern.test(route))) continue;
      if (!references.has(route)) references.set(route, []);
      references.get(route).push(file);
    }
  }

  const unresolved = [];
  for (const [route, files] of references) {
    if (!backendRoutes.some((backendRoute) => routeCompatible(route, backendRoute))) unresolved.push({ route, files: [...new Set(files)] });
  }

  if (backendFiles.length === 0) fail(scope, 'Nenhum handler de API encontrado.', { roots: policy.contracts.backendRoots });
  else pass(scope, 'Handlers de API catalogados.', { count: backendFiles.length, backendRoutes });
  if (unresolved.length) fail(scope, 'Frontend referencia rotas sem handler correspondente.', { unresolved });
  else pass(scope, 'Todas as rotas estáticas encontradas no frontend possuem handler correspondente.', { references: references.size });
}

function allowedReference(file, matchedText, allowlist) {
  return allowlist.some((entry) => entry.path === file && new RegExp(entry.pattern).test(matchedText));
}

function auditIsolation(policy) {
  const scope = 'product-isolation';
  const all = policy.isolation.premiumRoots.flatMap(walk);
  const premiumPattern = new RegExp(policy.isolation.premiumFilePattern, 'i');
  const projectPattern = new RegExp(policy.isolation.projectFilePattern, 'i');
  const premiumFiles = all.filter((file) => premiumPattern.test(file));
  const projectFiles = all.filter((file) => projectPattern.test(file));
  const violations = [];

  for (const file of premiumFiles) {
    const source = read(file);
    for (const match of source.matchAll(/[^\n]{0,100}(?:project-lm|projeto_lm|lm2_)[^\n]{0,100}/gi)) {
      if (!allowedReference(file, match[0], policy.isolation.premiumAllowedProjectReferences)) violations.push({ direction: 'Premium → Projeto LM', file, reference: match[0].trim() });
    }
  }

  for (const file of projectFiles) {
    const source = read(file);
    for (const match of source.matchAll(/[^\n]{0,100}(?:portal\.html|premium)[^\n]{0,100}/gi)) {
      if (!allowedReference(file, match[0], policy.isolation.projectAllowedPremiumReferences)) violations.push({ direction: 'Projeto LM → Premium', file, reference: match[0].trim() });
    }
  }

  if (violations.length) fail(scope, 'Referências cruzadas fora da allowlist.', { violations });
  else pass(scope, 'Nenhuma referência cruzada fora da allowlist.', { premiumFiles: premiumFiles.length, projectFiles: projectFiles.length });
}

const policy = loadPolicy();
const replay = auditMigrationCatalog();
auditDatabaseIntegrity(replay);
auditLifecycle(policy);
auditApiContracts(policy);
auditIsolation(policy);

const report = {
  sprint: 'QA 1',
  status: failures.length === 0 ? 'VALIDATED' : 'FAILED',
  generatedAt: new Date().toISOString(),
  summary: { failures: failures.length, evidence: evidence.length },
  failures,
  evidence,
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length === 0 ? 0 : 1;
