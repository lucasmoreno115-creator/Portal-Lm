#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { replayMigrations, introspectSqliteDb } from './db-tool.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const evidence = [];

function fail(scope, message, details = {}) {
  failures.push({ scope, message, ...details });
}

function pass(scope, message, details = {}) {
  evidence.push({ scope, message, ...details });
}

function requireFile(relativePath, scope) {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) fail(scope, `Arquivo obrigatório ausente: ${relativePath}`);
  else pass(scope, `Arquivo encontrado: ${relativePath}`);
  return fullPath;
}

function requirePattern(relativePath, pattern, scope, description) {
  const fullPath = requireFile(relativePath, scope);
  if (!existsSync(fullPath)) return;
  const source = readFileSync(fullPath, 'utf8');
  if (!pattern.test(source)) fail(scope, description, { path: relativePath, pattern: String(pattern) });
  else pass(scope, description, { path: relativePath });
}

function auditMigrationCatalog() {
  const scope = 'migrations';
  const dir = requireFile('migrations', scope);
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
  if (files.length === 0) return fail(scope, 'Nenhuma migration numerada encontrada.');

  const numbers = files.map((name) => Number(name.slice(0, 4)));
  const duplicates = numbers.filter((number, index) => numbers.indexOf(number) !== index);
  if (duplicates.length) fail(scope, 'Numeração duplicada de migrations.', { duplicates: [...new Set(duplicates)] });
  else pass(scope, 'Numeração de migrations sem duplicidade.', { count: files.length });

  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] <= numbers[index - 1]) {
      fail(scope, 'Ordem de migrations inválida.', { previous: files[index - 1], current: files[index] });
    }
  }

  const replay = replayMigrations();
  if (!replay.ok) fail(scope, 'Replay oficial de migrations falhou.', { error: replay.error, applied: replay.applied });
  else {
    const schema = introspectSqliteDb(replay.database);
    pass(scope, 'Replay oficial de migrations aprovado.', {
      applied: replay.applied.length,
      tables: schema.tables.length,
      indexes: Object.values(schema.indexes).reduce((total, list) => total + list.length, 0),
    });
  }
}

function auditContracts() {
  requirePattern('package.json', /"db:expected"\s*:/, 'contracts', 'Contrato de schema esperado registrado no package.json.');
  requirePattern('package.json', /"check:project-lm-runtime"\s*:/, 'contracts', 'Contrato de isolamento do runtime registrado no package.json.');
  requirePattern('public/portal.html', /getUserPlan\(\)\s*===\s*['"]projeto_lm['"]/, 'isolation', 'Portal Premium redireciona explicitamente usuários do Projeto LM.');
  requirePattern('public/portal.html', /portal-login\.html/, 'contracts', 'Portal Premium preserva contrato de autenticação.');
  requirePattern('public/project-lm-2.html', /id=['"]project-lm-2-root['"]/, 'isolation', 'Projeto LM mantém root independente do Premium.');
  requirePattern('public/project-lm-2.html', /project-lm-2\.css/, 'isolation', 'Projeto LM mantém stylesheet próprio.');
}

auditMigrationCatalog();
auditContracts();

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
