import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildWranglerInvocation, classifyWranglerBin, compareSchemas, main, parseArgs, replayMigrations, PRODUCTION_DB, PRODUCTION_DB_ID, WRANGLER_BIN_TYPES } from '../scripts/db-tool.mjs';

function tempDir() { return mkdtempSync(path.join(os.tmpdir(), 'build65-test-')); }
function writeMigration(dir, name, sql) { writeFileSync(path.join(dir, name), sql); }
function schema(columns = [{ name:'id', type:'TEXT', notnull:0, dflt_value:null, pk:1 }], indexes = []) {
  return { tables:['students'], columns:{ students: columns.map((c, cid)=>({ cid, ...c })) }, indexes:{ students:indexes }, triggers:[], views:[], objects:[{type:'table',name:'students',tbl_name:'students',sql:'CREATE TABLE students(id TEXT PRIMARY KEY)'}] };
}

test('Build 6.5 baseline: remote production capture requires explicit read-only confirmation', () => {
  const old = process.exitCode;
  process.exitCode = 0;
  main(['capture-baseline', '--environment', 'production']);
  assert.equal(process.exitCode, 2);
  process.exitCode = old;
});

test('Build 6.5 expected schema: migration replay succeeds deterministically for valid migrations', () => {
  const dir = tempDir();
  try {
    writeMigration(dir, '0001_create.sql', 'CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL);');
    writeMigration(dir, '0002_index.sql', 'CREATE UNIQUE INDEX idx_students_name ON students(name);');
    const result = replayMigrations({ dir });
    assert.equal(result.ok, true);
    assert.deepEqual(result.applied, ['0001_create.sql', '0002_index.sql']);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test('Build 6.5 migration replay: reports migration error and does not create expected artifact', () => {
  const dir = tempDir();
  try {
    writeMigration(dir, '0001_valid.sql', 'CREATE TABLE students (id TEXT PRIMARY KEY);');
    writeMigration(dir, '0002_invalid.sql', 'CREATE INDEX idx_missing ON missing_table(id);');
    const result = replayMigrations({ dir });
    assert.equal(result.ok, false);
    assert.equal(result.status, 'BLOCKING');
    assert.equal(result.error.migration, '0002_invalid.sql');
    assert.equal(existsSync(path.join(dir, 'migration-schema.json')), false);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test('Build 6.5 migration replay: trigger with semicolon in string is not split by agent parser', () => {
  const dir = tempDir();
  try {
    writeMigration(dir, '0001_trigger.sql', `
      CREATE TABLE logs (id INTEGER PRIMARY KEY, message TEXT);
      CREATE TRIGGER trg_logs AFTER INSERT ON logs BEGIN
        INSERT INTO logs(message) VALUES ('literal; semicolon');
      END;
    `);
    const result = replayMigrations({ dir });
    assert.equal(result.ok, true);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test('Build 6.5 audit: equal schemas pass and cosmetic SQL whitespace is irrelevant', () => {
  assert.equal(compareSchemas(schema(), schema()).status, 'PASS');
});

test('Build 6.5 audit: missing column is schema drift', () => {
  const expected = schema([{ name:'id', type:'TEXT', notnull:0, dflt_value:null, pk:1 }, { name:'email', type:'TEXT', notnull:1, dflt_value:null, pk:0 }]);
  const actual = schema();
  const diff = compareSchemas(expected, actual);
  assert.equal(diff.status, 'BLOCKING');
  assert.equal(diff.columnDiffs[0].table, 'students');
});

test('Build 6.5 audit: missing or extra index is structural drift', () => {
  const idx = [{ name:'idx_students_email', unique:1, origin:'c', partial:0, columns:[{ name:'email' }] }];
  assert.equal(compareSchemas(schema(undefined, idx), schema()).status, 'BLOCKING');
  assert.equal(compareSchemas(schema(), schema(undefined, idx)).status, 'BLOCKING');
});

test('Build 6.5 staging guard: production database name and id are blocked', () => {
  const old = process.exitCode;
  process.exitCode = 0;
  main(['restore', '--environment', 'staging', '--database', PRODUCTION_DB, '--confirm-restore', '--file', 'missing.sql']);
  assert.equal(process.exitCode, 2);
  process.exitCode = old;
  assert.equal(PRODUCTION_DB_ID, '1de90532-157b-473e-8e7a-655ca9e0953d');
});

test('Build 6.5 smoke gate: skipped smoke is NOT_EXECUTED and blocks', () => {
  const old = process.exitCode;
  process.exitCode = 0;
  main(['smoke', '--environment', 'staging', '--skip-smoke']);
  assert.equal(process.exitCode, 2);
  process.exitCode = old;
});

test('Build 6.5 production guard: plan blocks without all explicit gates', () => {
  const old = process.exitCode;
  process.exitCode = 0;
  main(['production-plan']);
  assert.equal(process.exitCode, 2);
  process.exitCode = old;
});

test('Build 6.5 CLI parser supports flags required by restore and baseline', () => {
  assert.deepEqual(parseArgs(['restore', '--environment', 'staging', '--file', 'backups/a.sql', '--confirm-restore']), { _: ['restore'], environment: 'staging', file: 'backups/a.sql', 'confirm-restore': true });
});

test('Build 6.5 integrated replay: legacy bootstrap plus all official migrations reaches expected schema PASS', () => {
  const result = replayMigrations();
  assert.equal(result.ok, true);
  const expectedOrder = result.applied.toSorted();
  assert.deepEqual(result.applied, expectedOrder);
});

test('Build 6.5 integrated schema confirms Premium, Projeto LM and Build 6 indexes', async () => {
  const { introspectSqliteDb } = await import('../scripts/db-tool.mjs');
  const result = replayMigrations();
  assert.equal(result.ok, true);
  const finalSchema = introspectSqliteDb(result.database);
  assert.equal(compareSchemas(finalSchema, finalSchema).status, 'PASS');
  for (const table of ['student_access', 'student_checkins', 'nutrition_plans', 'premium_students', 'premium_pending_items', 'premium_followup_entries']) assert.ok(finalSchema.tables.includes(table), table);
  for (const table of ['project_lm_profiles', 'project_lm_journeys', 'lm2_profiles', 'training_plans']) assert.ok(finalSchema.tables.includes(table), table);
  const allIndexes = Object.values(finalSchema.indexes).flat().map(index => index.name);
  for (const index of ['idx_premium_students_status_name', 'idx_premium_pending_items_workspace', 'idx_student_checkins_workspace_student_status', 'idx_nutrition_plans_workspace_student_status']) assert.ok(allIndexes.includes(index), index);
});

test('Build 6.5 bootstrap failure is BLOCKING and does not produce partial expected artifact', () => {
  const dir = tempDir();
  try {
    writeMigration(dir, '0001_valid.sql', 'CREATE TABLE after_bootstrap (id TEXT PRIMARY KEY);');
    const result = replayMigrations({ dir, bootstrap: path.join(dir, 'missing-bootstrap.sql') });
    assert.equal(result.ok, false);
    assert.equal(result.status, 'BLOCKING');
    assert.equal(result.error.migration, 'legacy-base-schema.sql');
    assert.equal(existsSync(path.join(dir, 'migration-schema.json')), false);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test('Build 6.5 replay override: 0021 historical migration remains original and hash is validated', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const original = readFileSync('migrations/0021_lm2_week_transition_activation.sql', 'utf8');
  assert.equal(original, 'ALTER TABLE lm2_journeys ADD COLUMN week_started_at TEXT;\nALTER TABLE lm2_journeys ADD COLUMN week_completed_at TEXT;\n');
  const manifest = JSON.parse(readFileSync('database/replay-overrides/manifest.json', 'utf8'));
  const override = manifest.overrides.find((item) => item.migration === '0021_lm2_week_transition_activation.sql');
  assert.equal(createHash('sha256').update(original).digest('hex'), override.originalMigrationHash);
  assert.equal(override.productionAllowed, false);
});

test('Build 6.5 replay override: complete replay uses registered override without modifying migration', () => {
  const result = replayMigrations();
  assert.equal(result.ok, true);
  assert.equal(result.overridesUsed.length, 1);
  assert.equal(result.overridesUsed[0].migration, '0021_lm2_week_transition_activation.sql');
  assert.equal(result.overridesUsed[0].result, 'SEMANTICALLY_SATISFIED');
});

test('Build 6.5 replay override: disabling overrides detects the 0019/0021 conflict', () => {
  const result = replayMigrations({ useOverrides: false });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'BLOCKING');
  assert.equal(result.error.migration, '0021_lm2_week_transition_activation.sql');
});

test('Build 6.5 replay override: production environment cannot use replay override', () => {
  const result = replayMigrations({ environment: 'production' });
  assert.equal(result.ok, false);
  assert.equal(result.error.migration, '0021_lm2_week_transition_activation.sql');
});

test('Build 6.5 expected schema records original migration and replay override hashes', async () => {
  const { readFileSync } = await import('node:fs');
  const expected = JSON.parse(readFileSync('database/expected/migration-schema.json', 'utf8'));
  assert.ok(expected.migrations.includes('0021_lm2_week_transition_activation.sql'));
  assert.equal(expected.overridesUsed[0].originalMigrationHashActual, 'f9a2bcddcab6c6688afa62835713e17ed9d74f4486e32edd9cc2f9fa1fa066b6');
  assert.equal(expected.overridesUsed[0].overrideHashActual, 'de69bd5946036c806fb5816c5a3cd5c9118126960a6b4be4691bb76776d0a925');
});

async function createOverrideReplayFixture({ originalSql, overrideSql, manifestPatch = {}, omitOverride = false } = {}) {
  const { createHash } = await import('node:crypto');
  const { mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
  const dir = tempDir();
  const overridesDir = path.join(dir, 'overrides');
  mkdirSync(overridesDir);
  writeMigration(dir, '0019_lm2_data_layer.sql', 'CREATE TABLE lm2_journeys (student_id TEXT PRIMARY KEY, week_started_at TEXT, week_completed_at TEXT);');
  const historical = originalSql ?? 'ALTER TABLE lm2_journeys ADD COLUMN week_started_at TEXT;\nALTER TABLE lm2_journeys ADD COLUMN week_completed_at TEXT;\n';
  writeMigration(dir, '0021_lm2_week_transition_activation.sql', historical);
  writeMigration(dir, '0022_after_override.sql', 'CREATE TABLE after_override (id TEXT PRIMARY KEY);');
  const overridePath = path.join(overridesDir, '0021_lm2_week_transition_activation.sql');
  const override = overrideSql ?? 'CREATE TABLE override_marker (id TEXT PRIMARY KEY);\n';
  if (!omitOverride) writeFileSync(overridePath, override);
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const manifest = { overrides: [{ migration: '0021_lm2_week_transition_activation.sql', reason: 'test override reason', originalMigrationHash: hash(historical), overrideHash: hash(override), appliesTo: ['local-empty-database-replay'], environments: ['local'], productionAllowed: false, semanticEffect: 'test semantic effect', approvedByBuild: 'Build 6.5', createdAt: '2026-07-15T00:00:00.000Z', ...manifestPatch }] };
  const manifestPath = path.join(dir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { dir, overridesDir, manifestPath, manifest, historical, override, readFileSync };
}

test('Build 6.5 override validation: correct original and override hashes allow replay', async () => {
  const fx = await createOverrideReplayFixture();
  try {
    const result = replayMigrations({ dir: fx.dir, bootstrap: null, overridesManifest: fx.manifestPath, overridesDir: fx.overridesDir });
    assert.equal(result.ok, true);
    assert.equal(result.overridesUsed[0].hashesVerified, true);
    assert.equal(result.overridesUsed[0].semanticConditionVerified, true);
  } finally { rmSync(fx.dir, { recursive:true, force:true }); }
});

test('Build 6.5 override validation: altered original migration hash blocks before next migration', async () => {
  const fx = await createOverrideReplayFixture({ manifestPatch: { originalMigrationHash: '0'.repeat(64) } });
  try {
    const result = replayMigrations({ dir: fx.dir, bootstrap: null, overridesManifest: fx.manifestPath, overridesDir: fx.overridesDir });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'REPLAY_OVERRIDE_INVALID');
    assert.equal(result.error.errors[0].field, 'originalMigrationHash');
    assert.equal(result.applied.includes('0022_after_override.sql'), false);
  } finally { rmSync(fx.dir, { recursive:true, force:true }); }
});

test('Build 6.5 override validation: altered override hash blocks and does not execute override SQL', async () => {
  const fx = await createOverrideReplayFixture({ manifestPatch: { overrideHash: '1'.repeat(64) } });
  try {
    const result = replayMigrations({ dir: fx.dir, bootstrap: null, overridesManifest: fx.manifestPath, overridesDir: fx.overridesDir });
    assert.equal(result.ok, false);
    assert.equal(result.error.errors.some((error) => error.field === 'overrideHash'), true);
    const { execFileSync } = await import('node:child_process');
    const tables = execFileSync('sqlite3', ['-json', result.database, "SELECT name FROM sqlite_schema WHERE type='table' AND name='override_marker';"], { encoding: 'utf8' });
    assert.equal(tables.trim(), '');
  } finally { rmSync(fx.dir, { recursive:true, force:true }); }
});

test('Build 6.5 override validation: invalid manifest hash, missing override, productionAllowed and unauthorized environment block', async () => {
  const invalidHash = await createOverrideReplayFixture({ manifestPatch: { originalMigrationHash: 'not-a-sha' } });
  const missing = await createOverrideReplayFixture({ omitOverride: true });
  const prodAllowed = await createOverrideReplayFixture({ manifestPatch: { productionAllowed: true } });
  const envDenied = await createOverrideReplayFixture({ manifestPatch: { environments: ['staging-new-empty-or-disposable'], appliesTo: ['new-staging-provisioning'] } });
  try {
    for (const fx of [invalidHash, missing, prodAllowed, envDenied]) {
      const result = replayMigrations({ dir: fx.dir, bootstrap: null, overridesManifest: fx.manifestPath, overridesDir: fx.overridesDir });
      assert.equal(result.ok, false);
      assert.equal(result.status, 'BLOCKING');
      assert.equal(result.overridesUsed.length, 0);
    }
  } finally {
    for (const fx of [invalidHash, missing, prodAllowed, envDenied]) rmSync(fx.dir, { recursive:true, force:true });
  }
});

function wranglerCommandLine({ wranglerBin, platform = 'win32', args = ['d1', 'execute', 'lmsystemv2-db', '--remote', '--json', '--command', 'SELECT 1;'] } = {}) {
  const invocation = buildWranglerInvocation({ wranglerBin, platform });
  return [invocation.command, ...invocation.prefixArgs, ...args];
}

test('Build 6.5 Wrangler launcher: classifies npx, Wrangler, and custom executables explicitly', () => {
  assert.equal(classifyWranglerBin('npx'), WRANGLER_BIN_TYPES.NPX_LAUNCHER);
  assert.equal(classifyWranglerBin('npx.cmd'), WRANGLER_BIN_TYPES.NPX_LAUNCHER);
  assert.equal(classifyWranglerBin('C:\\tools\\npx.cmd'), WRANGLER_BIN_TYPES.NPX_LAUNCHER);
  assert.equal(classifyWranglerBin('/usr/local/bin/npx'), WRANGLER_BIN_TYPES.NPX_LAUNCHER);
  assert.equal(classifyWranglerBin('wrangler'), WRANGLER_BIN_TYPES.WRANGLER_LAUNCHER);
  assert.equal(classifyWranglerBin('wrangler.cmd'), WRANGLER_BIN_TYPES.WRANGLER_LAUNCHER);
  assert.equal(classifyWranglerBin('C:\\repo\\node_modules\\.bin\\wrangler.cmd'), WRANGLER_BIN_TYPES.WRANGLER_LAUNCHER);
  assert.equal(classifyWranglerBin('/custom/bin/cloudflare-runner'), WRANGLER_BIN_TYPES.UNKNOWN_CUSTOM_EXECUTABLE);
});

test('Build 6.5 Wrangler launcher: WRANGLER_BIN=npx.cmd inserts wrangler before the full D1 command', () => {
  const sql = 'SELECT * FROM students WHERE name = "Ana Maria";';
  assert.deepEqual(wranglerCommandLine({ wranglerBin: 'npx.cmd', args: ['d1', 'execute', 'lmsystemv2-db', '--remote', '--json', '--command', sql] }), [
    'cmd.exe', '/d', '/s', '/c', 'npx.cmd', 'wrangler', 'd1', 'execute', 'lmsystemv2-db', '--remote', '--json', '--command', sql,
  ]);
});

test('Build 6.5 Wrangler launcher: WRANGLER_BIN=npx inserts wrangler on Unix', () => {
  assert.deepEqual(buildWranglerInvocation({ wranglerBin: 'npx', platform: 'linux' }), {
    command: 'npx', prefixArgs: ['wrangler'], binType: WRANGLER_BIN_TYPES.NPX_LAUNCHER,
  });
});

test('Build 6.5 Wrangler launcher: full path to npx.cmd inserts wrangler and preserves spaces', () => {
  const bin = 'C:\\Program Files\\nodejs\\npx.cmd';
  assert.deepEqual(buildWranglerInvocation({ wranglerBin: bin, platform: 'win32' }), {
    command: 'cmd.exe', prefixArgs: ['/d', '/s', '/c', bin, 'wrangler'], binType: WRANGLER_BIN_TYPES.NPX_LAUNCHER,
  });
});

test('Build 6.5 Wrangler launcher: local node_modules Wrangler cmd does not insert wrangler twice', () => {
  const bin = 'C:\\repo\\node_modules\\.bin\\wrangler.cmd';
  assert.deepEqual(buildWranglerInvocation({ wranglerBin: bin, platform: 'win32' }), {
    command: 'cmd.exe', prefixArgs: ['/d', '/s', '/c', bin], binType: WRANGLER_BIN_TYPES.WRANGLER_LAUNCHER,
  });
});

test('Build 6.5 Wrangler launcher: WRANGLER_BIN=wrangler.cmd and full Wrangler path do not add wrangler', () => {
  assert.deepEqual(buildWranglerInvocation({ wranglerBin: 'wrangler.cmd', platform: 'win32' }), {
    command: 'cmd.exe', prefixArgs: ['/d', '/s', '/c', 'wrangler.cmd'], binType: WRANGLER_BIN_TYPES.WRANGLER_LAUNCHER,
  });
  assert.deepEqual(buildWranglerInvocation({ wranglerBin: 'C:\\Cloudflare Tools\\wrangler.cmd', platform: 'win32' }).prefixArgs, ['/d', '/s', '/c', 'C:\\Cloudflare Tools\\wrangler.cmd']);
});

test('Build 6.5 Wrangler launcher: automatic fallback uses npx.cmd wrangler on Windows and npx wrangler on Linux', () => {
  assert.deepEqual(buildWranglerInvocation({ platform: 'win32' }), {
    command: 'cmd.exe', prefixArgs: ['/d', '/s', '/c', 'npx.cmd', 'wrangler'], binType: WRANGLER_BIN_TYPES.NPX_LAUNCHER,
  });
  assert.deepEqual(buildWranglerInvocation({ platform: 'linux' }), {
    command: 'npx', prefixArgs: ['wrangler'], binType: WRANGLER_BIN_TYPES.NPX_LAUNCHER,
  });
});

test('Build 6.5 Wrangler launcher: D1 args and SQL are separate argv entries, including spaces, quotes, and cmd metacharacters', () => {
  const sqlValues = [
    'SELECT * FROM students WHERE full_name = "Ana Maria";',
    "SELECT 'single quote''s value' AS text;",
    'SELECT "a&b|c(d);" AS dangerous_chars;',
  ];
  for (const sql of sqlValues) {
    const commandLine = wranglerCommandLine({ wranglerBin: 'npx.cmd', args: ['d1', 'execute', 'lmsystemv2-db', '--remote', '--json', '--command', sql] });
    assert.deepEqual(commandLine.slice(0, 13), ['cmd.exe', '/d', '/s', '/c', 'npx.cmd', 'wrangler', 'd1', 'execute', 'lmsystemv2-db', '--remote', '--json', '--command', sql]);
    assert.equal(commandLine.at(-1), sql);
  }
});

test('Build 6.5 Wrangler launcher: token-like values are not added to stdout/stderr launcher args', () => {
  const oldToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = 'secret-token-must-not-appear';
  try {
    const printable = JSON.stringify(wranglerCommandLine({ wranglerBin: 'npx.cmd' }));
    assert.equal(printable.includes(process.env.CLOUDFLARE_API_TOKEN), false);
  } finally {
    if (oldToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = oldToken;
  }
});
