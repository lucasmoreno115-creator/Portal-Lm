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
import { identityAuditQueryCatalog, validateIdentityAuditInternalQueries, assertIdentityAuditArgs, REMOTE_READ_ONLY_SQL_FORBIDDEN } from '../scripts/db-tool.mjs';

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
