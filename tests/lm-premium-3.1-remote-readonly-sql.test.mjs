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
