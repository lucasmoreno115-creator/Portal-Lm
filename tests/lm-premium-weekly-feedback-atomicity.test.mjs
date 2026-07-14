import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseDuplicateAuditRows, WEEKLY_FEEDBACK_DUPLICATE_AUDIT_SQL } from '../scripts/audit-weekly-feedback-duplicates.mjs';

test('submissão usa INSERT OR IGNORE, DB.batch e evento idempotente determinístico', async () => {
  const source = await readFile('workers/premium/application/submit-weekly-feedback.js', 'utf8');
  assert.match(source, /INSERT OR IGNORE INTO student_checkins/);
  assert.match(source, /INSERT OR IGNORE INTO premium_pending_items/);
  assert.match(source, /INSERT OR IGNORE INTO activity_timeline/);
  assert.match(source, /db\.batch/);
  assert.match(source, /weekly-feedback:\$\{studentId\}:\$\{weekRef\}:received/);
});

test('submissão bloqueia edição concorrente quando coach_status já foi analisado', async () => {
  const source = await readFile('workers/premium/application/submit-weekly-feedback.js', 'utf8');
  assert.match(source, /isFeedbackAnalyzed\(saved\.coach_status\)/);
  assert.match(source, /status: 409/);
  assert.match(source, /Este Feedback Semanal já foi analisado por Lucas/);
});

test('repository usa INSERT OR IGNORE e bloqueio de status analisado na persistência', async () => {
  const source = await readFile('workers/premium/repositories/d1-weekly-feedback-repository.js', 'utf8');
  assert.match(source, /INSERT OR IGNORE INTO student_checkins/);
  assert.match(source, /NOT IN \('REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA'\)/);
  assert.match(source, /blocked: true/);
});

test('auditoria de migration detecta duplicidade legada sem apagar respostas', () => {
  const conflicts = parseDuplicateAuditRows([{ student_id: 'stu-1', week_ref: '2026-W29', total: 2, checkin_ids: 'a,b' }]);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].checkin_ids, ['a', 'b']);
  assert.match(conflicts[0].recommended_action, /não mesclar nem apagar silenciosamente/i);
  assert.match(WEEKLY_FEEDBACK_DUPLICATE_AUDIT_SQL, /HAVING COUNT\(\*\) > 1/);
});
