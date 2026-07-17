#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRODUCTION_DB = 'lmsystemv2-db';
export const PRODUCTION_DB_ID = '1de90532-157b-473e-8e7a-655ca9e0953d';
const root = process.cwd();
const migrationsDir = path.join(root, 'migrations');
const expectedDir = path.join(root, 'database', 'expected');
const bootstrapFile = path.join(root, 'database', 'bootstrap', 'legacy-base-schema.sql');
const replayOverridesDir = path.join(root, 'database', 'replay-overrides');
const replayOverridesManifest = path.join(replayOverridesDir, 'manifest.json');
const baselineDir = path.join(root, 'database', 'baseline');
const releaseRoot = path.join(root, 'release');

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) args._.push(arg);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) args[arg.slice(2)] = argv[++i];
    else args[arg.slice(2)] = true;
  }
  return args;
}
export const migrationFiles = (dir = migrationsDir) => readdirSync(dir).filter(f => /^\d+.*\.sql$/.test(f)).sort();

function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EINVAL') {
      throw new Error(`Failed to start subprocess ${cmd}: ${error.message}`);
    }
    const stderr = String(error.stderr || '').trim();
    const stdout = String(error.stdout || '').trim();
    const details = [stderr && `stderr: ${stderr}`, stdout && `stdout: ${stdout}`].filter(Boolean).join('\n');
    const wrapped = new Error(`Subprocess ${cmd} failed${details ? `\n${details}` : ''}`);
    wrapped.exitCode = error.status || error.exitCode || 1;
    wrapped.stderr = error.stderr;
    wrapped.stdout = error.stdout;
    throw wrapped;
  }
}
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fileHash = file => sha256(readFileSync(file));

function isValidSha256(value) { return /^[a-f0-9]{64}$/i.test(String(value || '')); }
function environmentAllowed(override, environment) {
  if (environment === 'production') return false;
  if ((override.environments || []).includes(environment)) return true;
  if (environment === 'local' && (override.appliesTo || []).includes('local-empty-database-replay')) return true;
  if (environment === 'staging' && (override.appliesTo || []).includes('new-staging-provisioning')) return true;
  return false;
}
function loadReplayOverrides({ manifestPath = replayOverridesManifest, overridesDir = replayOverridesDir } = {}) {
  if (!existsSync(manifestPath)) return new Map();
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return new Map((manifest.overrides || []).map(o => [o.migration, { ...o, path: path.join(overridesDir, o.migration), manifestPath }]));
}
function validateReplayOverride({ file, originalPath, override, environment }) {
  const errors = [];
  if (!override || override.migration !== file) errors.push({ field: 'migration', message: 'Override manifest migration does not match current migration.' });
  if (override?.productionAllowed !== false) errors.push({ field: 'productionAllowed', message: 'Replay overrides must set productionAllowed to false.' });
  if (!environmentAllowed(override || {}, environment)) errors.push({ field: 'environment', message: `Replay override is not allowed in ${environment}.` });
  if (!isValidSha256(override?.originalMigrationHash)) errors.push({ field: 'originalMigrationHash', message: 'Invalid original migration SHA-256.' });
  if (!isValidSha256(override?.overrideHash)) errors.push({ field: 'overrideHash', message: 'Invalid override SHA-256.' });
  if (!override?.reason) errors.push({ field: 'reason', message: 'Replay override reason is required.' });
  if (!override?.semanticEffect) errors.push({ field: 'semanticEffect', message: 'Replay override semanticEffect is required.' });
  if (!override?.path || !existsSync(override.path)) errors.push({ field: 'overridePath', message: 'Replay override file is missing.' });
  const originalMigrationHashActual = existsSync(originalPath) ? fileHash(originalPath) : null;
  const overrideHashActual = override?.path && existsSync(override.path) ? fileHash(override.path) : null;
  if (override?.originalMigrationHash && originalMigrationHashActual !== override.originalMigrationHash) errors.push({ field: 'originalMigrationHash', message: 'Original migration hash mismatch.', expected: override.originalMigrationHash, actual: originalMigrationHashActual });
  if (override?.overrideHash && overrideHashActual !== override.overrideHash) errors.push({ field: 'overrideHash', message: 'Replay override hash mismatch.', expected: override.overrideHash, actual: overrideHashActual });
  return {
    ok: errors.length === 0,
    errors,
    evidence: {
      originalMigrationPath: path.relative(root, originalPath),
      originalMigrationHashExpected: override?.originalMigrationHash,
      originalMigrationHashActual,
      overridePath: override?.path ? path.relative(root, override.path) : null,
      overrideHashExpected: override?.overrideHash,
      overrideHashActual,
      hashesVerified: errors.filter(e => /Hash|hash/.test(e.field)).length === 0 && Boolean(originalMigrationHashActual) && Boolean(overrideHashActual),
    }
  };
}
function columnsExist(db, table, names) { const cols = parseJsonRows(sqlite('-json', db, `PRAGMA table_info(${JSON.stringify(table)});`)).map(c => c.name); return names.every(name => cols.includes(name)); }
function shouldUseReplayOverride(db, file, override, environment = 'local') { if (!override) return false; if (environment === 'production' || override.productionAllowed === true) return false; if (file === '0021_lm2_week_transition_activation.sql') return columnsExist(db, 'lm2_journeys', ['week_started_at', 'week_completed_at']); return false; }
const writeJsonAtomic = (file, data) => { mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.tmp-${process.pid}`; writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`); renameSync(tmp, file); };
const writeAtomic = (file, data) => { mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.tmp-${process.pid}`; writeFileSync(tmp, data); renameSync(tmp, file); };
const sqlite = (...args) => run('sqlite3', args);
const parseJsonRows = output => output && output.trim() ? JSON.parse(output) : [];

function readVersion() {
  if (process.env.RELEASE_VERSION && /^\d+\.\d+\.\d+/.test(process.env.RELEASE_VERSION)) return process.env.RELEASE_VERSION;
  if (existsSync(path.join(root, 'VERSION.md'))) {
    const match = readFileSync(path.join(root, 'VERSION.md'), 'utf8').match(/\b\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?\b/);
    if (match) return match[0];
  }
  if (existsSync(path.join(root, 'RELEASE_MANIFEST.json'))) {
    const manifest = JSON.parse(readFileSync(path.join(root, 'RELEASE_MANIFEST.json'), 'utf8'));
    const candidate = manifest.version || manifest.releaseVersion;
    if (candidate && /^\d+\.\d+\.\d+/.test(candidate)) return candidate;
  }
  throw new Error('Unable to resolve release version from RELEASE_VERSION, VERSION.md, or RELEASE_MANIFEST.json.');
}

function extractStatement(sql, offset) {
  const before = sql.slice(0, offset).split(/\r?\n/).length;
  const lines = sql.split(/\r?\n/).slice(Math.max(0, before - 3), before + 4);
  return { line: before, context: lines.join('\n') };
}

export function replayMigrations({ dir = migrationsDir, bootstrap = bootstrapFile, useOverrides = true, environment = 'local', overridesManifest = replayOverridesManifest, overridesDir = replayOverridesDir } = {}) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'portal-lm-db-'));
  const db = path.join(temp, 'expected.sqlite');
  const applied = [];
  const overridesUsed = [];
  const overrides = loadReplayOverrides({ manifestPath: overridesManifest, overridesDir });
  try {
    if (bootstrap) {
      try { sqlite(db, `.read ${bootstrap}`); }
      catch (error) { return { ok: false, status: 'BLOCKING', database: db, applied, error: { file: bootstrap, migration: 'legacy-base-schema.sql', message: String(error.stderr || error.message || '').trim(), statement: { line: null, context: null } } }; }
    }
    for (const file of migrationFiles(dir)) {
      const full = path.join(dir, file);
      try {
        const override = useOverrides ? overrides.get(file) : null;
        if (override) {
          const validation = validateReplayOverride({ file, originalPath: full, override, environment });
          if (!validation.ok) return { ok: false, status: 'BLOCKING', database: db, applied, overridesUsed, error: { migration: file, code: 'REPLAY_OVERRIDE_INVALID', errors: validation.errors, evidence: validation.evidence } };
          const semanticConditionVerified = shouldUseReplayOverride(db, file, override, environment);
          if (!semanticConditionVerified) return { ok: false, status: 'BLOCKING', database: db, applied, overridesUsed, error: { migration: file, code: 'REPLAY_OVERRIDE_SEMANTIC_CONDITION_NOT_MET', evidence: { ...validation.evidence, semanticConditionVerified: false } } };
          sqlite(db, `.read ${override.path}`);
          overridesUsed.push({ migration: file, override: path.relative(root, override.path), reason: override.reason, result: 'SEMANTICALLY_SATISFIED', ...validation.evidence, hashesVerified: true, semanticConditionVerified: true });
        } else {
          sqlite(db, `.read ${full}`);
        }
        applied.push(file);
      } catch (error) {
        const stderr = String(error.stderr || error.message || '');
        const sql = readFileSync(full, 'utf8');
        const lineMatch = stderr.match(/near line (\d+)/i);
        const statement = lineMatch ? extractStatement(sql, Number(lineMatch[1])) : { line: null, context: null };
        return { ok: false, status: 'BLOCKING', database: db, applied, error: { migration: file, message: stderr.trim(), statement } };
      }
    }
    return { ok: true, status: 'PASS', database: db, applied, overridesUsed };
  } catch (error) {
    rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

export function introspectSqliteDb(db) {
  const objects = parseJsonRows(sqlite('-json', db, "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' ORDER BY type,name;"));
  const tables = objects.filter(o => o.type === 'table').map(o => o.name).sort();
  const columns = {};
  const indexes = {};
  for (const table of tables) {
    columns[table] = parseJsonRows(sqlite('-json', db, `PRAGMA table_info(${JSON.stringify(table)});`));
    indexes[table] = parseJsonRows(sqlite('-json', db, `PRAGMA index_list(${JSON.stringify(table)});`)).map(idx => ({ ...idx, columns: parseJsonRows(sqlite('-json', db, `PRAGMA index_info(${JSON.stringify(idx.name)});`)) }));
  }
  return { objects, tables, columns, indexes, triggers: objects.filter(o => o.type === 'trigger'), views: objects.filter(o => o.type === 'view') };
}

function canonicalSchema(schema) {
  return {
    tables: Object.fromEntries(schema.tables.map(t => [t, { columns: schema.columns[t].map(c => ({ name: c.name, type: (c.type || '').toUpperCase(), notnull: !!c.notnull, dflt_value: c.dflt_value ?? null, pk: c.pk })), indexes: (schema.indexes[t] || []).map(i => ({ name: i.name, unique: !!i.unique, origin: i.origin, partial: !!i.partial, columns: i.columns.map(c => c.name) })).sort((a,b)=>a.name.localeCompare(b.name)) }])),
    triggers: schema.triggers.map(t => ({ name: t.name, table: t.tbl_name, sql: (t.sql || '').replace(/\s+/g, ' ').trim() })).sort((a,b)=>a.name.localeCompare(b.name)),
    views: schema.views.map(v => ({ name: v.name, sql: (v.sql || '').replace(/\s+/g, ' ').trim() })).sort((a,b)=>a.name.localeCompare(b.name))
  };
}

export function compareSchemas(expected, actual) {
  const e = canonicalSchema(expected), a = canonicalSchema(actual);
  const missingTables = Object.keys(e.tables).filter(t => !a.tables[t]);
  const extraTables = Object.keys(a.tables).filter(t => !e.tables[t]);
  const columnDiffs = [];
  const indexDiffs = [];
  for (const [table, exp] of Object.entries(e.tables)) {
    if (!a.tables[table]) continue;
    if (JSON.stringify(exp.columns) !== JSON.stringify(a.tables[table].columns)) columnDiffs.push({ table, expected: exp.columns, actual: a.tables[table].columns });
    if (JSON.stringify(exp.indexes) !== JSON.stringify(a.tables[table].indexes)) indexDiffs.push({ table, expected: exp.indexes, actual: a.tables[table].indexes });
  }
  const triggerDiffs = JSON.stringify(e.triggers) === JSON.stringify(a.triggers) ? [] : [{ expected: e.triggers, actual: a.triggers }];
  const viewDiffs = JSON.stringify(e.views) === JSON.stringify(a.views) ? [] : [{ expected: e.views, actual: a.views }];
  const blocking = missingTables.length || extraTables.length || columnDiffs.length || indexDiffs.length || triggerDiffs.length || viewDiffs.length;
  return { status: blocking ? 'BLOCKING' : 'PASS', missingTables, extraTables, columnDiffs, indexDiffs, triggerDiffs, viewDiffs };
}

function migrationHistory(expected, applied, policy = process.env.MIGRATION_HISTORY_POLICY || 'warning') {
  const missing = expected.filter(m => !applied.includes(m));
  const extra = applied.filter(m => !expected.includes(m));
  const divergence = missing.length || extra.length;
  return { status: divergence ? (policy === 'blocking' ? 'BLOCKING' : 'WARNING') : 'PASS', code: divergence ? 'HISTORY_DIVERGENCE' : 'OK', missing, extra, policy };
}

function emitExpected() {
  const replay = replayMigrations();
  if (!replay.ok) { console.error(JSON.stringify(replay.error, null, 2)); process.exitCode = 2; return; }
  const schema = introspectSqliteDb(replay.database);
  const sql = schema.objects.map(o => `${o.sql};`).join('\n\n') + '\n';
  const canonical = canonicalSchema(schema);
  writeAtomic(path.join(expectedDir, 'migration-schema.sql'), sql);
  writeJsonAtomic(path.join(expectedDir, 'migration-schema.json'), { generatedAt: new Date().toISOString(), source: 'database/bootstrap/legacy-base-schema.sql + versioned migrations + registered replay overrides', bootstrap: 'database/bootstrap/legacy-base-schema.sql', migrations: replay.applied, overridesUsed: replay.overridesUsed, replayOrder: ['database/bootstrap/legacy-base-schema.sql', ...replay.applied], schemaHash: sha256(JSON.stringify(canonical)), ...canonical });
}

function catalog() {
  const schemaFile = path.join(expectedDir, 'migration-schema.json');
  if (!existsSync(schemaFile)) {
    const lines = ['# Database Catalog', '', 'Build 6.5 database catalog is pending because `database/expected/migration-schema.json` does not exist.', '', 'Run `npm run db:expected` after the migration history is replayable from zero, then rerun `npm run db:catalog`.', '', 'Production baseline remains separate and must be captured by authenticated read-only D1 introspection.'];
    writeAtomic(path.join(root,'DATABASE_CATALOG.md'), `${lines.join('\n')}\n`);
    return;
  }
  const schema = JSON.parse(readFileSync(schemaFile, 'utf8'));
  const lines = ['# Database Catalog', '', 'Generated from `database/expected/migration-schema.json` after replaying `database/bootstrap/legacy-base-schema.sql` and all versioned migrations.', '', '## Build 6.5 note', '', 'Production baseline is captured only by authenticated read-only D1 introspection; migration-derived expected schema is stored separately under `database/expected/`.', '', '## Tables', ''];
  for (const [table, def] of Object.entries(schema.tables || {})) { lines.push(`### ${table}`, '', '| Column | Type | Not null | Default | PK |', '| --- | --- | --- | --- | --- |'); for (const c of def.columns) lines.push(`| ${c.name} | ${c.type} | ${c.notnull} | ${c.dflt_value ?? ''} | ${c.pk} |`); lines.push('', 'Indexes:', ''); for (const idx of def.indexes) lines.push(`- ${idx.name} (${idx.columns.join(', ')}) unique=${idx.unique} partial=${idx.partial}`); lines.push(''); }
  writeAtomic(path.join(root, 'DATABASE_CATALOG.md'), `${lines.join('\n')}\n`);
}


export const WRANGLER_BIN_TYPES = Object.freeze({
  NPX_LAUNCHER: 'NPX_LAUNCHER',
  WRANGLER_LAUNCHER: 'WRANGLER_LAUNCHER',
  UNKNOWN_CUSTOM_EXECUTABLE: 'UNKNOWN_CUSTOM_EXECUTABLE',
});

function executableName(value) {
  return String(value || '').trim().split(/[\\/]/).filter(Boolean).pop()?.toLowerCase() || '';
}

export function classifyWranglerBin(value) {
  const name = executableName(value);
  if (name === 'npx' || name === 'npx.cmd') return WRANGLER_BIN_TYPES.NPX_LAUNCHER;
  if (name === 'wrangler' || name === 'wrangler.cmd') return WRANGLER_BIN_TYPES.WRANGLER_LAUNCHER;
  return WRANGLER_BIN_TYPES.UNKNOWN_CUSTOM_EXECUTABLE;
}

function isCmdExecutable(value) {
  return executableName(value).endsWith('.cmd');
}

export function normalizeExecutablePath(value, { platform = process.platform } = {}) {
  let normalized = path.normalize(String(value || '').trim());
  if (platform === 'win32') {
    normalized = normalized.replace(/\\/g, '/').replace(/^\/([a-z]:\/)/i, '$1').toLowerCase();
  }
  return normalized;
}

function localWranglerBin({ platform = process.platform, cwd = root } = {}) {
  return path.join(cwd, 'node_modules', '.bin', platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
}

function isSameExecutableName(a, b, { platform = process.platform } = {}) {
  return normalizeExecutablePath(a, { platform }) === normalizeExecutablePath(b, { platform });
}

function invocationForBin(configuredBin, { platform = process.platform } = {}) {
  const binType = classifyWranglerBin(configuredBin);
  const usesNpx = binType === WRANGLER_BIN_TYPES.NPX_LAUNCHER;
  const prefixArgs = usesNpx ? [configuredBin, 'wrangler'] : [configuredBin];
  if (platform === 'win32' && isCmdExecutable(configuredBin)) {
    return { command: 'cmd.exe', prefixArgs: ['/d', '/s', '/c', ...prefixArgs], binType };
  }
  return { command: configuredBin, prefixArgs: usesNpx ? ['wrangler'] : [], binType };
}

export function resolveWranglerInvocation({ wranglerBin = process.env.WRANGLER_BIN, platform = process.platform, cwd = root, exists = existsSync } = {}) {
  if (wranglerBin) return { ...invocationForBin(wranglerBin, { platform }), source: 'WRANGLER_BIN' };

  const localBin = localWranglerBin({ platform, cwd });
  if (exists(localBin)) return { ...invocationForBin(localBin, { platform }), source: 'LOCAL_WRANGLER' };

  const npxBin = platform === 'win32' ? 'npx.cmd' : 'npx';
  const npxInvocation = invocationForBin(npxBin, { platform });
  return { ...npxInvocation, source: 'NPX_FALLBACK', fallbackCommand: platform === 'win32' ? 'wrangler.cmd' : 'wrangler' };
}

export function wrangler(args, options = {}) {
  const invocation = resolveWranglerInvocation(options);
  try {
    return run(invocation.command, [...invocation.prefixArgs, ...args], options.runOptions || {});
  } catch (error) {
    if (invocation.source === 'NPX_FALLBACK' && error.message.includes('Failed to start subprocess')) {
      const globalInvocation = invocationForBin(invocation.fallbackCommand, { platform: options.platform || process.platform });
      return run(globalInvocation.command, [...globalInvocation.prefixArgs, ...args], options.runOptions || {});
    }
    throw error;
  }
}
function sqlLiteral(value) { return `'${String(value ?? '').replaceAll("'", "''")}'`; }
function requireSafeNonProduction(environment, database, databaseId) { if (environment === 'production' || database === PRODUCTION_DB || databaseId === PRODUCTION_DB_ID) { const err = new Error('Production database is blocked for this operation.'); err.exitCode = 2; throw err; } }
function evidence(kind, data) { const version = readVersion(); const body = { command: process.argv.join(' '), startedAt: data.startedAt, completedAt: new Date().toISOString(), exitCode: data.exitCode ?? 0, source: 'scripts/db-tool.mjs', environment: data.environment, databaseName: data.databaseName, databaseId: data.databaseId, status: data.status, checks: data.checks || [], errors: data.errors || [], hashes: data.hashes || {} }; writeJsonAtomic(path.join(releaseRoot, version, `${kind}.json`), body); return body; }

function captureBaseline(args) {
  if (args.environment !== 'production' || args['confirm-read-only-production'] !== true) { console.error('Production baseline capture requires --environment production --confirm-read-only-production.'); process.exitCode = 2; return; }
  const database = args.database || PRODUCTION_DB;
  const databaseId = args['database-id'] || PRODUCTION_DB_ID;
  const startedAt = new Date().toISOString();
  const captured = remoteIntrospect(database);
  const schemaRows = captured.objects;
  const byKind = { schema: [], indexes: [], triggers: [], views: [] };
  for (const row of schemaRows) { const key = row.type === 'index' ? 'indexes' : row.type === 'trigger' ? 'triggers' : row.type === 'view' ? 'views' : 'schema'; byKind[key].push(`${row.sql};`); }
  writeAtomic(path.join(baselineDir, 'production-schema.sql'), `${byKind.schema.join('\n\n')}\n`);
  writeAtomic(path.join(baselineDir, 'production-indexes.sql'), `${byKind.indexes.join('\n\n')}\n`);
  writeAtomic(path.join(baselineDir, 'production-triggers.sql'), `${byKind.triggers.join('\n\n')}\n`);
  writeAtomic(path.join(baselineDir, 'production-views.sql'), `${byKind.views.join('\n\n')}\n`);
  const schemaHash = sha256(JSON.stringify(schemaRows));
  writeJsonAtomic(path.join(baselineDir, 'production-baseline.json'), { capturedAt: new Date().toISOString(), sourceEnvironment: 'production', sourceDatabase: database, sourceDatabaseId: databaseId, readOnlyCapture: true, schemaHash, objects: schemaRows, tables: captured.tables, columns: captured.columns, indexes: captured.indexes, triggers: captured.triggers, views: captured.views });
  writeJsonAtomic(path.join(root, 'database', 'baseline-manifest.json'), { baselineVersion: readVersion(), sourceEnvironment: 'production', sourceDatabase: database, sourceDatabaseId: databaseId, capturedAt: new Date().toISOString(), capturedBy: process.env.USER || 'operator', readOnlyCapture: true, schemaHash, objectCount: schemaRows.length, tableCount: schemaRows.filter(r=>r.type==='table').length, indexCount: schemaRows.filter(r=>r.type==='index').length, triggerCount: schemaRows.filter(r=>r.type==='trigger').length, viewCount: schemaRows.filter(r=>r.type==='view').length, migrationHistoryStatus: 'NOT_EVALUATED', productionDataIncluded: false });
  const result = evidence('baseline', { startedAt, environment:'production', databaseName:database, databaseId, status:'PASS', checks:['read-only sqlite_schema capture'], hashes:{ schemaHash } });
  console.log(JSON.stringify({ status: 'PASS', database, databaseId, schemaHash, evidence: path.relative(root, path.join(releaseRoot, readVersion(), 'baseline.json')) }));
  return result;
}


export const REMOTE_READ_ONLY_SQL_FORBIDDEN = /\b(INSERT|UPDATE|DELETE|REPLACE|UPSERT|DROP|ALTER|CREATE|TRUNCATE|VACUUM|ATTACH|DETACH|REINDEX)\b/i;

function stripSqlComments(sql) {
  return String(sql || '').replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
}

export function assertRemoteReadOnlySql(command) {
  const sql = stripSqlComments(command);
  if (!sql) throw new Error('Remote D1 audit SQL is empty.');
  const semicolons = [...sql.matchAll(/;/g)];
  if (semicolons.length > 1 || (semicolons.length === 1 && semicolons[0].index !== sql.length - 1)) {
    throw new Error('Remote D1 audit SQL must contain exactly one read-only statement.');
  }
  const statement = sql.replace(/;\s*$/, '').trim();
  if (REMOTE_READ_ONLY_SQL_FORBIDDEN.test(statement)) throw new Error('Remote D1 audit SQL rejected: write or schema mutation keyword detected.');
  if (/^PRAGMA\s+/i.test(statement)) {
    if (!/^PRAGMA\s+(table_info|table_xinfo|index_list|index_info|foreign_key_list)\s*\(/i.test(statement)) {
      throw new Error('Remote D1 audit SQL rejected: only schema-read PRAGMA statements are allowed.');
    }
    return statement;
  }
  if (/^SELECT\b/i.test(statement)) return statement;
  throw new Error('Remote D1 audit SQL rejected: only SELECT and schema-read PRAGMA statements are allowed.');
}

function remoteQuery(database, command) { const safeCommand = assertRemoteReadOnlySql(command); const out = JSON.parse(wrangler(['d1','execute',database,'--remote','--json','--command',safeCommand])); return out[0]?.results || out.results || []; }

function quoteIdent(name) { return `\"${String(name).replaceAll('\"', '\"\"')}\"`; }
function remoteIntrospect(database) { const objects = remoteQuery(database, "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' ORDER BY type,name;"); const tables = objects.filter(o => o.type === 'table').map(o => o.name).sort(); const columns = {}; const indexes = {}; for (const table of tables) { columns[table] = remoteQuery(database, `PRAGMA table_info(${quoteIdent(table)});`); indexes[table] = remoteQuery(database, `PRAGMA index_list(${quoteIdent(table)});`).map(idx => ({ ...idx, columns: remoteQuery(database, `PRAGMA index_info(${quoteIdent(idx.name)});`) })); } return { objects, tables, columns, indexes, triggers: objects.filter(o=>o.type==='trigger'), views: objects.filter(o=>o.type==='view') }; }
function remoteMigrations(database) { try { return remoteQuery(database, 'SELECT name FROM d1_migrations ORDER BY name;').map(r => r.name).filter(Boolean); } catch { return []; } }
function audit(args) { const env = args.environment || 'staging'; const dbName = args.database || (env === 'production' ? PRODUCTION_DB : 'lmsystemv2-staging-db'); const startedAt = new Date().toISOString(); const replay = replayMigrations(); if (!replay.ok) { const report = { schemaDrift:{status:'BLOCKING', error:replay.error}, migrationHistory:{status:'NOT_EVALUATED'}, status:'BLOCKING' }; writeJsonAtomic(path.join(root,'artifacts',`db-audit-${env}.json`), report); process.exitCode=2; return; } const expected = introspectSqliteDb(replay.database); const actual = remoteIntrospect(dbName); const drift = compareSchemas(expected, actual); const history = migrationHistory(migrationFiles(), remoteMigrations(dbName)); const status = drift.status === 'BLOCKING' || history.status === 'BLOCKING' ? 'BLOCKING' : history.status === 'WARNING' ? 'WARNING' : 'PASS'; writeJsonAtomic(path.join(root,'artifacts',`db-audit-${env}.json`), { schemaDrift: drift, migrationHistory: history, status }); evidence('audit', { startedAt, environment:env, databaseName:dbName, databaseId:args['database-id'], status, checks:['schemaDrift','migrationHistory'] }); if (status === 'BLOCKING') process.exitCode = 2; }
function backup(args) { const env=args.environment||'staging'; const db=args.database||'lmsystemv2-staging-db'; const id=args['database-id']; const startedAt=new Date().toISOString(); const out=args.output||path.join(root,'backups',`${env}-${new Date().toISOString().replace(/[:.]/g,'-')}.sql`); mkdirSync(path.dirname(out),{recursive:true}); wrangler(['d1','export',db,'--remote','--output',out]); if(!existsSync(out)) throw new Error('Backup export did not create a file.'); const st=statSync(out); evidence('backup',{startedAt,environment:env,databaseName:db,databaseId:id,status:'PASS',checks:['file-created','sha256'],hashes:{backup:fileHash(out)},}); console.log(JSON.stringify({file:out,size:st.size,sha256:fileHash(out)})); }
function restore(args) { const env=args.environment; const db=args.database; const id=args['database-id']; const file=args.file; const startedAt=new Date().toISOString(); requireSafeNonProduction(env,db,id); if(args['confirm-restore']!==true) throw new Error('Restore requires --confirm-restore.'); if(!file || !existsSync(file)) throw new Error('Restore file is missing.'); wrangler(['d1','execute',db,'--remote','--file',file]); evidence('restore',{startedAt,environment:env,databaseName:db,databaseId:id,status:'PASS',checks:['file-exists','import-command-completed'],hashes:{restore:fileHash(file)}}); }
function assertRemoteDatabaseEmpty(db) { const rows = remoteQuery(db, "SELECT name,type FROM sqlite_schema WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name;"); if (rows.length) { const err = new Error(`Refusing to provision non-empty database; found application objects: ${rows.map(r => r.name).join(', ')}`); err.exitCode = 2; throw err; } }
function remoteColumnsExist(db, table, names) { const cols = remoteQuery(db, `PRAGMA table_info(${quoteIdent(table)});`).map(c => c.name); return names.every(name => cols.includes(name)); }
function provisionStaging(args) { const env='staging'; const db=args.database; const id=args['database-id']; const startedAt=new Date().toISOString(); if(!db) throw new Error('Provision staging requires --database.'); requireSafeNonProduction(env,db,id); if(args['confirm-empty-or-disposable']!==true) throw new Error('Provision staging requires --confirm-empty-or-disposable.'); assertRemoteDatabaseEmpty(db); const overrides = loadReplayOverrides(); const applied=[]; const overridesUsed=[]; wrangler(['d1','execute',db,'--remote','--file',bootstrapFile]); wrangler(['d1','execute',db,'--remote','--command',`CREATE TABLE IF NOT EXISTS database_bootstrap_history (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, original_hash TEXT, executed_hash TEXT, result TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`]); wrangler(['d1','execute',db,'--remote','--command',`INSERT INTO database_bootstrap_history (id, kind, name, executed_hash, result, reason) VALUES ('bootstrap:legacy-base-schema', 'bootstrap', 'database/bootstrap/legacy-base-schema.sql', '${fileHash(bootstrapFile)}', 'APPLIED', 'Build 6.5 legacy bootstrap for empty staging');`]); for (const file of migrationFiles()) { const override=overrides.get(file); if (override) { const validation=validateReplayOverride({file, originalPath:path.join(migrationsDir,file), override, environment:env}); if(!validation.ok){ const err=new Error(`Replay override validation failed for ${file}: ${JSON.stringify(validation.errors)}`); err.exitCode=2; throw err; } if(!remoteColumnsExist(db,'lm2_journeys',['week_started_at','week_completed_at'])){ const err=new Error(`Replay override semantic condition not met for ${file}`); err.exitCode=2; throw err; } wrangler(['d1','execute',db,'--remote','--file',override.path]); wrangler(['d1','execute',db,'--remote','--command',`INSERT INTO database_bootstrap_history (id, kind, name, original_hash, executed_hash, result, reason) VALUES ('override:${file}', 'replay-override', '${file}', '${validation.evidence.originalMigrationHashActual}', '${validation.evidence.overrideHashActual}', 'SEMANTICALLY_SATISFIED', ${sqlLiteral(override.reason)});`]); overridesUsed.push({ migration:file, override:path.relative(root,override.path), ...validation.evidence, hashesVerified:true, semanticConditionVerified:true, result:'SEMANTICALLY_SATISFIED' }); } else { const full=path.join(migrationsDir,file); wrangler(['d1','execute',db,'--remote','--file',full]); wrangler(['d1','execute',db,'--remote','--command',`INSERT INTO database_bootstrap_history (id, kind, name, original_hash, executed_hash, result) VALUES ('migration:${file}', 'migration', '${file}', '${fileHash(full)}', '${fileHash(full)}', 'APPLIED');`]); } applied.push(file); } evidence('provision-staging',{startedAt,environment:env,databaseName:db,databaseId:id,status:'PASS',checks:['empty-or-disposable-confirmed','legacy-bootstrap-applied','controlled-migrations-applied','database_bootstrap_history-recorded'],hashes:{bootstrap:fileHash(bootstrapFile)},}); }
function smoke(args) { const startedAt=new Date().toISOString(); if(args['skip-smoke']) { evidence('smoke',{startedAt,environment:args.environment,status:'NOT_EXECUTED',checks:[{smokeExecuted:false}],errors:['Smoke was not executed.']}); process.exitCode=2; return; } run('node',['scripts/smoke-lm-premium-rc1.mjs'],{stdio:'inherit'}); const artifact=path.join(root,'artifacts','staging-smoke-results.json'); const result=existsSync(artifact)?JSON.parse(readFileSync(artifact,'utf8')):{}; const ok=result.smokeExecuted===true && result.ok===true && result.failed===0; evidence('smoke',{startedAt,environment:args.environment,status:ok?'PASS':'BLOCKING',checks:[result],hashes:existsSync(artifact)?{smoke:fileHash(artifact)}:{}}); if(!ok) process.exitCode=2; }
function productionPlan(args) { const gates = { allow:process.env.ALLOW_PRODUCTION_DEPLOY==='true', id:process.env.CONFIRM_PRODUCTION_DATABASE_ID===PRODUCTION_DB_ID, version:process.env.CONFIRM_RELEASE_VERSION===readVersion(), confirm:args['confirm-production']===true }; const status = Object.values(gates).every(Boolean) ? 'PASS' : 'BLOCKING'; writeJsonAtomic(path.join(root,'artifacts','production-deploy-plan.json'), { status, gates, writesExecuted:false }); if(status==='BLOCKING') process.exitCode=2; }


export function main(argv = process.argv.slice(2)) { const args=parseArgs(argv); const cmd=args._[0]; try { if(cmd==='expected') emitExpected(); else if(cmd==='catalog') catalog(); else if(cmd==='capture-baseline') captureBaseline(args); else if(cmd==='audit') audit(args); else if(cmd==='backup') backup(args); else if(cmd==='restore') restore(args); else if(cmd==='provision-staging') provisionStaging(args); else if(cmd==='smoke') smoke(args); else if(cmd==='production-plan') productionPlan(args); else { console.error('Usage: db-tool expected|catalog|capture-baseline|audit|backup|restore|provision-staging|smoke|production-plan'); process.exitCode=2; } } catch (error) { console.error(error.message); process.exitCode = error.exitCode || 1; } }

export function isDirectExecution({ metaUrl = import.meta.url, argv1 = process.argv[1], platform = process.platform } = {}) {
  if (!argv1) return false;
  return isSameExecutableName(fileURLToPath(metaUrl), argv1, { platform });
}

if (isDirectExecution()) main();
