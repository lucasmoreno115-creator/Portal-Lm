import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRemoteReadOnlySql } from '../scripts/db-tool.mjs';

const accepted = [
  'SELECT COUNT(*) AS total FROM student_access;',
  ' select type,name FROM sqlite_schema WHERE type = "table" ',
  'PRAGMA table_info("premium_students");',
  'PRAGMA index_list("student_access")',
  'PRAGMA index_info("idx_premium_students_status_name");',
  'PRAGMA foreign_key_list("student_checkins");',
];

for (const sql of accepted) {
  test(`LM Premium 3.1 read-only SQL guard accepts ${sql}`, () => {
    assert.equal(assertRemoteReadOnlySql(sql).endsWith(';'), false);
  });
}

const rejected = [
  'INSERT INTO student_access(email) VALUES("x@example.com");',
  'UPDATE student_access SET status="ACTIVE";',
  'DELETE FROM premium_students;',
  'REPLACE INTO premium_students(student_id) VALUES("s");',
  'UPSERT INTO premium_students(student_id) VALUES("s");',
  'DROP TABLE premium_students;',
  'ALTER TABLE premium_students ADD COLUMN unsafe TEXT;',
  'CREATE TABLE audit_write(id TEXT);',
  'TRUNCATE TABLE student_access;',
  'VACUUM;',
  'PRAGMA journal_mode=WAL;',
  'SELECT COUNT(*) FROM student_access; SELECT COUNT(*) FROM premium_students;',
];

for (const sql of rejected) {
  test(`LM Premium 3.1 read-only SQL guard rejects unsafe SQL ${sql}`, () => {
    assert.throws(() => assertRemoteReadOnlySql(sql), /rejected|one read-only statement/);
  });
}

test('LM Premium 3.1 read-only SQL guard error messages do not expose tokens or personal data', () => {
  process.env.CLOUDFLARE_API_TOKEN = 'token-must-not-appear';
  assert.throws(
    () => assertRemoteReadOnlySql('UPDATE student_access SET email="person@example.com";'),
    (error) => !String(error.message).includes('token-must-not-appear') && !String(error.message).includes('person@example.com')
  );
});

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { identityAuditQueryCatalog, validateIdentityAuditInternalQueries, assertIdentityAuditArgs, REMOTE_READ_ONLY_SQL_FORBIDDEN, loadRemoteSchema, IDENTITY_AUDIT_TABLE_ALLOWLIST } from '../scripts/db-tool.mjs';

test('LM Premium 3.1 identity-audit internal query catalog is fixed, aggregated and read-only', () => {
  assert.equal(validateIdentityAuditInternalQueries(), true);
  const catalog = identityAuditQueryCatalog();
  assert.ok(catalog.length >= 9);
  for (const { sql } of catalog) {
    assert.equal(assertRemoteReadOnlySql(sql), sql);
    assert.equal(REMOTE_READ_ONLY_SQL_FORBIDDEN.test(sql), false);
    assert.doesNotMatch(sql, /\b(phone|whatsapp|anamnesis_response|clinical|content|feedback_text)\b/i);
    assert.match(sql, /COUNT|SUM|sqlite_schema|PRAGMA/i);
  }
});

test('LM Premium 3.1 identity-audit rejects custom SQL and requires explicit read-only confirmation', () => {
  assert.throws(() => assertIdentityAuditArgs({ environment: 'production' }), /confirm-read-only-production/);
  assert.throws(() => assertIdentityAuditArgs({ environment: 'staging' }), /confirm-read-only-staging/);
  assert.throws(() => assertIdentityAuditArgs({ environment: 'staging', 'confirm-read-only-staging': true, command: 'SELECT 1' }), /does not accept custom SQL/);
  assert.throws(() => assertIdentityAuditArgs({ environment: 'staging', 'confirm-read-only-staging': true, sql: 'SELECT 1' }), /does not accept custom SQL/);
  assert.equal(assertIdentityAuditArgs({ environment: 'staging', 'confirm-read-only-staging': true }), 'staging');
  assert.equal(assertIdentityAuditArgs({ environment: 'production', 'confirm-read-only-production': true }), 'production');
});

test('LM Premium 3.1 identity-audit command rejects --command before Wrangler or remote SQL execution', () => {
  try {
    execFileSync(process.execPath, ['scripts/db-tool.mjs', 'identity-audit', '--environment', 'staging', '--confirm-read-only-staging', '--command', 'SELECT 1'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    assert.fail('identity-audit must reject custom SQL');
  } catch (error) {
    assert.equal(error.status, 1);
    assert.match(String(error.stderr), /does not accept custom SQL/);
    assert.doesNotMatch(String(error.stderr), /SELECT 1/);
  }
});

test('LM Premium 3.1 remote D1 paths validate SQL before passing it to Wrangler', () => {
  const source = readFileSync('scripts/db-tool.mjs', 'utf8');
  assert.match(source, /function remoteQuery\(database, command\) \{ const safeCommand = assertRemoteReadOnlySql\(command\);/);
  assert.doesNotMatch(source, /'--command',command/);
});


test('LM Premium 3.1 identity-audit schema loading only introspects allowlisted application tables', () => {
  const calls = [];
  const schemaRows = [
    { name: 'student_access' },
    { name: '_cf_KV' },
    { name: 'd1_migrations' },
    { name: 'lm2_journeys' },
    { name: 'project_lm_journeys' },
    { name: 'premium_students' },
    { name: 'premium_pending_items' },
    { name: 'operational_logs' },
    { name: 'training_sessions' },
  ];
  const query = (_database, sql) => {
    calls.push(sql);
    if (sql.includes('sqlite_schema')) return schemaRows;
    if (sql.includes('student_access')) return [{ name: 'student_id' }, { name: 'email' }];
    if (sql.includes('premium_students')) return [{ name: 'student_id' }, { name: 'email' }];
    if (sql.includes('premium_pending_items')) return [{ name: 'student_id' }, { name: 'status' }];
    assert.fail(`unexpected schema introspection: ${sql}`);
  };

  const schema = loadRemoteSchema('lmsystemv2-db', query);
  assert.deepEqual(schema.tables, ['student_access', 'premium_students', 'premium_pending_items']);
  assert.equal(schema.columns.student_access.includes('email'), true);
  assert.equal(schema.columns.premium_pending_items.includes('status'), true);
  for (const sql of calls) {
    assert.doesNotMatch(sql, /PRAGMA table_info\("_cf_KV"\)/);
    assert.doesNotMatch(sql, /PRAGMA table_info\("lm2_/);
    assert.doesNotMatch(sql, /PRAGMA table_info\("project_lm_/);
    assert.doesNotMatch(sql, /PRAGMA table_info\("d1_migrations"\)/);
    assert.doesNotMatch(sql, /PRAGMA table_info\("operational_logs"\)/);
    assert.doesNotMatch(sql, /PRAGMA table_info\("training_/);
  }
  const pragmaTables = calls.filter(sql => /^PRAGMA table_info/.test(sql)).map(sql => sql.match(/"([^"]+)"/)?.[1]);
  assert.deepEqual(pragmaTables, ['student_access', 'premium_students', 'premium_pending_items']);
  assert.ok(pragmaTables.every(table => IDENTITY_AUDIT_TABLE_ALLOWLIST.includes(table)));
});

test('LM Premium 3.1 identity-audit missing allowlisted tables stay absent without blocking schema loading', () => {
  const calls = [];
  const query = (_database, sql) => {
    calls.push(sql);
    if (sql.includes('sqlite_schema')) return [{ name: 'student_access' }];
    if (sql.includes('student_access')) return [{ name: 'student_id' }, { name: 'email' }];
    assert.fail(`unexpected query for missing table: ${sql}`);
  };
  const schema = loadRemoteSchema('lmsystemv2-db', query);
  assert.deepEqual(schema.tables, ['student_access']);
  assert.equal(schema.columns.premium_students, undefined);
  assert.equal(calls.some(sql => sql.includes('premium_students')), false);
});
