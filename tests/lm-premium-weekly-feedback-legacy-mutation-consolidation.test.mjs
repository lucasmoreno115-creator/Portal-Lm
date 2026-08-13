import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';

const productionCallers = Object.freeze([
  'admin-checkins.html',
  'admin-student.html',
  'public/admin-checkins.html',
  'public/admin-student.html',
]);

async function source(path) { return readFile(join(process.cwd(), path), 'utf8'); }

async function withDb(run) {
  const directory = await mkdtemp(join(tmpdir(), 'legacy-mutation-consolidation-'));
  const db = new SqliteD1(join(directory, 'test.db'));
  try { await initializeSchemaForTests(db); await run(db); }
  finally { db.close(); await rm(directory, { recursive: true, force: true }); }
}

async function adminRequest(db, method, pathname, body) {
  return worker.fetch(new Request(`https://portal.test${pathname}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-token': 'admin-token' },
    body: JSON.stringify(body),
  }), { DB: db, ADMIN_TOKEN: 'admin-token' });
}

test('caller inventory migrates every active legacy production caller to the canonical command', async () => {
  for (const path of productionCallers) {
    const runtime = await source(path);
    assert.doesNotMatch(runtime, /\/api\/admin\/checkins\/[^`'" ]+\/reply/);
    assert.match(runtime, /\/api\/admin\/premium\/weekly-feedbacks\/\$\{encodeURIComponent\([^)]*\)\}\/decision/);
    assert.match(runtime, /decision_type/);
    assert.doesNotMatch(runtime, /coach_status\s*:/);
  }
});

test('legacy mutation route is absent and cannot mutate Premium or Projeto LM check-ins', async () => withDb(async (db) => {
  await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES ('premium','premium@example.com','premium@example.com','Premium','ACTIVE','ACTIVE','TEST',datetime('now'),datetime('now'))`).run();
  await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,coach_status,submitted_at,created_at,updated_at) VALUES ('premium-checkin','premium','premium@example.com','2026-W33','pending',datetime('now'),datetime('now'),datetime('now')),('project-checkin','project','project@example.com','2026-W33','pending',datetime('now'),datetime('now'),datetime('now'))`).run();

  for (const id of ['premium-checkin', 'project-checkin']) {
    const response = await adminRequest(db, 'PATCH', `/api/admin/checkins/${id}/reply`, { coach_reply: 'Não salvar', decision_type: 'KEEP_STRATEGY', coach_status: 'QUALQUER_COISA' });
    assert.equal(response.status, 404);
  }

  const rows = await db.prepare(`SELECT id,coach_status,coach_reply,coach_reply_at,reviewed_at,analyzed_at,decision_type FROM student_checkins ORDER BY id`).all();
  assert.deepEqual(rows.results, [
    { id: 'premium-checkin', coach_status: 'pending', coach_reply: null, coach_reply_at: null, reviewed_at: null, analyzed_at: null, decision_type: null },
    { id: 'project-checkin', coach_status: 'pending', coach_reply: null, coach_reply_at: null, reviewed_at: null, analyzed_at: null, decision_type: null },
  ]);
  assert.equal((await db.prepare(`SELECT count(*) total FROM premium_followup_entries`).first()).total, 0);
  assert.equal((await db.prepare(`SELECT count(*) total FROM activity_timeline WHERE event_type='FEEDBACK_ANALYZED'`).first()).total, 0);
}));

test('parallel legacy mutation implementation and event production are removed', async () => {
  const api = await source('workers/api.js');
  const repository = await source('workers/premium/repositories/d1-weekly-feedback-repository.js');
  const events = await source('workers/premium/domain/premium-events.js');
  assert.doesNotMatch(api, /createAnalyzeWeeklyFeedbackUseCase|analyzeWeeklyFeedback|FEEDBACK_ANALYZED|\/api\/admin\/checkins\/[^/]+\/reply/);
  assert.doesNotMatch(repository, /saveProfessionalDecision/);
  assert.doesNotMatch(events, /FEEDBACK_ANALYZED/);
  await assert.rejects(readFile(join(process.cwd(), 'workers/premium/application/analyze-weekly-feedback.js'), 'utf8'), { code: 'ENOENT' });
});
