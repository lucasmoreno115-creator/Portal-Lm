import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';

const NOW = '2026-08-14T13:00:00.000Z'; // Friday in the production São Paulo schedule.
const STUDENT = Object.freeze({ id: 'premium-e2e-student', email: 'premium-e2e@example.com', token: 'premium-e2e-token' });
const DECISION = Object.freeze({
  decision_type: 'UPDATE_PLAN',
  note: 'Ajustar estratégia na próxima semana.',
  coach_reply: 'Boa evolução. Vamos ajustar o planejamento para a próxima semana.',
  followup_at: null,
});

async function withDatabase(run) {
  const directory = await mkdtemp(join(tmpdir(), 'professional-review-e2e-'));
  const db = new SqliteD1(join(directory, 'test.db'));
  try { await initializeSchemaForTests(db); await run(db); }
  finally { db.close(); await rm(directory, { recursive: true, force: true }); }
}

async function request(db, method, pathname, body, actor = 'admin') {
  const headers = { 'content-type': 'application/json' };
  if (actor === 'admin') headers['x-admin-token'] = 'admin-token';
  if (actor === 'student') { headers['x-student-email'] = STUDENT.email; headers['x-student-token'] = STUDENT.token; }
  const response = await worker.fetch(new Request(`https://portal.test${pathname}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, ADMIN_TOKEN: 'admin-token', PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED: 'true' });
  return { status: response.status, body: await response.json() };
}

async function seedPremiumStudent(db, { id = STUDENT.id, email = STUDENT.email, token = STUDENT.token } = {}) {
  await db.prepare(`INSERT INTO student_access (id,name,email,access_token,status,plan_type,plan,whatsapp,student_id,created_at)
    VALUES (?,?,?,?, 'ACTIVE','PREMIUM','premium','5511999999999',?,?)`).bind(`access-${id}`, 'Aluno Premium E2E', email, token, id, NOW).run();
  await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at)
    VALUES (?,?,?,'Aluno Premium E2E','ACTIVE','ACTIVE','F2.2.5_E2E',?,?)`).bind(id, email, email, NOW, NOW).run();
}

const one = (db, sql, ...params) => db.prepare(sql).bind(...params).first();
const many = async (db, sql, ...params) => (await db.prepare(sql).bind(...params).all()).results;

test('F2.2.5 completes the Premium weekly-feedback professional review through real HTTP and D1 boundaries', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  await withDatabase(async (db) => {
    await seedPremiumStudent(db);
    const previous = {
      id: 'premium-e2e-previous', week: '2026-W32', reply: 'Resposta preservada da semana anterior.',
      repliedAt: '2026-08-08T14:00:00.000Z', reviewedAt: '2026-08-08T14:01:00.000Z', analyzedAt: '2026-08-08T14:02:00.000Z', decisionAt: '2026-08-08T14:03:00.000Z',
    };
    await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,training_adherence,coach_status,coach_reply,coach_reply_at,reviewed_at,analyzed_at,decision_type,decision_note,decision_at,submitted_at,created_at,updated_at)
      VALUES (?,?,?,?,?,'reviewed',?,?,?,?, 'KEEP_STRATEGY','Manter estratégia anterior',?,?,?,?)`)
      .bind(previous.id, STUDENT.id, STUDENT.email, previous.week, 'Boa', previous.reply, previous.repliedAt, previous.reviewedAt, previous.analyzedAt, previous.decisionAt, '2026-08-08T12:00:00.000Z', '2026-08-08T12:00:00.000Z', previous.decisionAt).run();

    const currentBefore = await request(db, 'GET', '/api/portal/premium/weekly-feedback/current', undefined, 'student');
    assert.equal(currentBefore.status, 200);
    assert.equal(currentBefore.body.data.status, 'AVAILABLE');
    const weekRef = currentBefore.body.data.weekRef;

    const answers = { trainingAdherence: 'Treinei quatro vezes', nutritionAdherence: 'Boa adesão', cardioAdherence: 'Três sessões', sleepQuality: 'Boa', energyLevel: 'Alta', weeklyWeight: '78.4', mainDifficulty: 'Horários', routineContext: 'Viagem curta', supportNeeded: 'Ajustar refeições' };
    const submitted = await request(db, 'POST', '/api/portal/premium/weekly-feedback/current', answers, 'student');
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.data.weekRef, weekRef);
    const checkinId = submitted.body.data.id;

    const stored = await one(db, 'SELECT * FROM student_checkins WHERE id=?', checkinId);
    assert.equal(stored.student_id, STUDENT.id);
    assert.equal(stored.week_ref, weekRef);
    assert.ok(stored.submitted_at);
    assert.equal(stored.coach_status, 'pending');
    assert.equal(stored.coach_reply, null);
    assert.equal(stored.main_difficulty, answers.mainDifficulty);
    assert.equal((await one(db, 'SELECT COUNT(*) total FROM student_checkins WHERE student_id=? AND week_ref=?', STUDENT.id, weekRef)).total, 1);

    let analyze = await one(db, `SELECT * FROM premium_pending_items WHERE student_id=? AND type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id=?`, STUDENT.id, checkinId);
    assert.deepEqual({ status: analyze.status, priority: analyze.priority, source: analyze.source, relatedType: analyze.related_entity_type }, { status: 'OPEN', priority: 'NORMAL', source: 'automatic', relatedType: 'student_checkins' });
    const submissionRetry = await request(db, 'POST', '/api/portal/premium/weekly-feedback/current', answers, 'student');
    assert.equal(submissionRetry.status, 200);
    assert.equal(submissionRetry.body.data.id, checkinId);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id=?`, checkinId)).total, 1);

    const workspaceBefore = await request(db, 'GET', '/api/admin/premium/workspace/summary');
    assert.equal(workspaceBefore.status, 200);
    assert.ok(workspaceBefore.body.data.checkins.awaitingReview >= 1);
    assert.ok(workspaceBefore.body.data.checkins.items.some((item) => item.studentId === STUDENT.id && item.checkinId === checkinId));
    assert.ok(workspaceBefore.body.data.pendingItems.items.some((item) => item.type === 'ANALYZE_WEEKLY_FEEDBACK' && item.relatedEntity?.id === checkinId));

    const detail = await request(db, 'GET', `/api/admin/premium/weekly-feedbacks/${checkinId}`);
    assert.equal(detail.status, 200);
    assert.deepEqual({ id: detail.body.data.feedback.id, student: detail.body.data.feedback.student_id, week: detail.body.data.feedback.week_ref, status: detail.body.data.feedback.coach_status }, { id: checkinId, student: STUDENT.id, week: weekRef, status: 'pending' });
    assert.ok(detail.body.data.feedback.submitted_at);
    assert.equal(detail.body.data.feedback.routine_context, answers.routineContext);
    assert.equal(detail.body.data.pending.length, 1);
    assert.equal(detail.body.data.pending[0].related_entity_id, checkinId);

    const decided = await request(db, 'POST', `/api/admin/premium/weekly-feedbacks/${checkinId}/decision`, DECISION);
    assert.equal(decided.status, 200);
    assert.equal(decided.body.ok, true);
    assert.equal(decided.body.data.unchanged, false);
    assert.equal(decided.body.data.feedback.coach_reply, DECISION.coach_reply);

    const reviewed = await one(db, 'SELECT * FROM student_checkins WHERE id=?', checkinId);
    assert.deepEqual({ status: reviewed.coach_status, reply: reviewed.coach_reply, type: reviewed.decision_type, note: reviewed.decision_note, followup: reviewed.followup_at }, { status: 'reviewed', reply: DECISION.coach_reply, type: 'UPDATE_PLAN', note: DECISION.note, followup: null });
    for (const field of ['coach_reply_at', 'reviewed_at', 'analyzed_at', 'decision_at']) assert.doesNotThrow(() => new Date(reviewed[field]).toISOString());
    assert.ok(new Date(reviewed.decision_at) >= new Date(reviewed.submitted_at));

    const entries = await many(db, `SELECT * FROM premium_followup_entries WHERE entry_type='PROFESSIONAL_DECISION' AND related_entity_id=?`, checkinId);
    assert.equal(entries.length, 1);
    assert.deepEqual({ student: entries[0].student_id, relatedType: entries[0].related_entity_type, content: entries[0].content, source: entries[0].source }, { student: STUDENT.id, relatedType: 'student_checkins', content: DECISION.note, source: 'admin' });
    assert.ok(entries[0].title);

    analyze = await one(db, `SELECT * FROM premium_pending_items WHERE type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id=?`, checkinId);
    assert.equal(analyze.status, 'RESOLVED');
    assert.ok(analyze.resolved_at);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id=? AND status='OPEN'`, checkinId)).total, 0);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE type='CREATE_NUTRITION_PLAN' AND related_entity_id=? AND status='OPEN'`, checkinId)).total, 1);

    const workspaceAfter = await request(db, 'GET', '/api/admin/premium/workspace/summary');
    assert.equal(workspaceBefore.body.data.checkins.awaitingReview - workspaceAfter.body.data.checkins.awaitingReview, 1);
    assert.equal(workspaceAfter.body.data.checkins.items.some((item) => item.checkinId === checkinId), false);
    assert.equal(workspaceAfter.body.data.pendingItems.items.some((item) => item.type === 'ANALYZE_WEEKLY_FEEDBACK' && item.relatedEntity?.id === checkinId), false);
    const pendingQueue = await request(db, 'GET', `/api/admin/premium/workspace/pending-items?student_id=${STUDENT.id}`);
    assert.ok(pendingQueue.body.data.items.some((item) => item.type === 'CREATE_NUTRITION_PLAN' && item.relatedEntity?.id === checkinId));

    const portalCurrent = await request(db, 'GET', '/api/portal/premium/weekly-feedback/current', undefined, 'student');
    assert.deepEqual(portalCurrent.body.data.professionalResponse, { message: DECISION.coach_reply, respondedAt: reviewed.coach_reply_at });
    for (const privateField of ['decision_note', 'followup_at', 'created_by', 'decision_by']) assert.equal(JSON.stringify(portalCurrent.body).includes(`"${privateField}"`), false);
    const history = await request(db, 'GET', '/api/portal/premium/weekly-feedback/history', undefined, 'student');
    const currentHistory = history.body.data.find((item) => item.id === checkinId);
    assert.deepEqual({ week: currentHistory.week_ref, reply: currentHistory.coach_reply, status: currentHistory.coach_status }, { week: weekRef, reply: DECISION.coach_reply, status: 'reviewed' });
    const previousHistory = history.body.data.find((item) => item.id === previous.id);
    assert.deepEqual({ week: previousHistory.week_ref, reply: previousHistory.coach_reply }, { week: previous.week, reply: previous.reply });
    assert.deepEqual(await one(db, 'SELECT coach_reply,coach_reply_at,reviewed_at,analyzed_at,decision_at FROM student_checkins WHERE id=?', previous.id), { coach_reply: previous.reply, coach_reply_at: previous.repliedAt, reviewed_at: previous.reviewedAt, analyzed_at: previous.analyzedAt, decision_at: previous.decisionAt });

    const timestamps = { coach_reply_at: reviewed.coach_reply_at, reviewed_at: reviewed.reviewed_at, analyzed_at: reviewed.analyzed_at, decision_at: reviewed.decision_at, resolved_at: analyze.resolved_at };
    const retry = await request(db, 'POST', `/api/admin/premium/weekly-feedbacks/${checkinId}/decision`, DECISION);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.data.unchanged, true);
    const retryState = await one(db, `SELECT sc.coach_reply_at,sc.reviewed_at,sc.analyzed_at,sc.decision_at,pi.resolved_at FROM student_checkins sc JOIN premium_pending_items pi ON pi.related_entity_id=sc.id AND pi.type='ANALYZE_WEEKLY_FEEDBACK' WHERE sc.id=?`, checkinId);
    assert.deepEqual(retryState, timestamps);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_followup_entries WHERE entry_type='PROFESSIONAL_DECISION' AND related_entity_id=?`, checkinId)).total, 1);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE type='CREATE_NUTRITION_PLAN' AND related_entity_id=? AND status='OPEN'`, checkinId)).total, 1);

    const divergent = await request(db, 'POST', `/api/admin/premium/weekly-feedbacks/${checkinId}/decision`, { ...DECISION, coach_reply: 'Mensagem divergente.' });
    assert.equal(divergent.status, 409);
    assert.equal(divergent.body.code, 'WEEKLY_FEEDBACK_ALREADY_REVIEWED');
    assert.equal((await one(db, 'SELECT coach_reply FROM student_checkins WHERE id=?', checkinId)).coach_reply, DECISION.coach_reply);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE related_entity_id=?`, checkinId)).total, 2);

    const legacySnapshot = await one(db, 'SELECT coach_status,coach_reply FROM student_checkins WHERE id=?', checkinId);
    const legacy = await request(db, 'PATCH', `/api/admin/checkins/${checkinId}/reply`, { coach_reply: 'Não salvar', coach_status: 'arbitrary' });
    assert.equal(legacy.status, 404);
    assert.deepEqual(await one(db, 'SELECT coach_status,coach_reply FROM student_checkins WHERE id=?', checkinId), legacySnapshot);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_followup_entries WHERE related_entity_id=?`, checkinId)).total, 1);

    await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,coach_status,submitted_at,created_at,updated_at) VALUES ('project-e2e-checkin','project-lm-student','project@example.com','2026-W33','pending',?,?,?)`).bind(NOW, NOW, NOW).run();
    assert.equal((await request(db, 'GET', '/api/admin/premium/weekly-feedbacks/project-e2e-checkin')).status, 404);
    assert.equal((await request(db, 'POST', '/api/admin/premium/weekly-feedbacks/project-e2e-checkin/decision', { decision_type: 'KEEP_STRATEGY', coach_reply: 'Não salvar.' })).status, 404);
    assert.deepEqual(await one(db, `SELECT coach_status,coach_reply FROM student_checkins WHERE id='project-e2e-checkin'`), { coach_status: 'pending', coach_reply: null });
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE student_id='project-lm-student'`)).total, 0);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_followup_entries WHERE student_id='project-lm-student'`)).total, 0);
  });
});

test('all canonical decision types create only their approved derived pending effect', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  await withDatabase(async (db) => {
    const matrix = [
      ['KEEP_STRATEGY', null],
      ['CONTACT_STUDENT', 'CONTACT_STUDENT'],
      ['REQUEST_MORE_INFORMATION', 'REQUEST_INFORMATION'],
    ];
    for (const [index, [decisionType, expectedPending]] of matrix.entries()) {
      const id = `matrix-student-${index}`; const email = `matrix-${index}@example.com`;
      await seedPremiumStudent(db, { id, email, token: `token-${index}` });
      const feedbackId = `matrix-feedback-${index}`;
      await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,coach_status,submitted_at,created_at,updated_at) VALUES (?,?,?,'2026-W33','pending',?,?,?)`).bind(feedbackId, id, email, NOW, NOW, NOW).run();
      await db.prepare(`INSERT INTO premium_pending_items (id,student_id,type,title,status,priority,source,related_entity_type,related_entity_id,created_at,updated_at) VALUES (?,?, 'ANALYZE_WEEKLY_FEEDBACK','Analisar','OPEN','NORMAL','automatic','student_checkins',?,?,?)`).bind(`matrix-pending-${index}`, id, feedbackId, NOW, NOW).run();
      const response = await request(db, 'POST', `/api/admin/premium/weekly-feedbacks/${feedbackId}/decision`, { decision_type: decisionType, note: `Nota ${decisionType}`, coach_reply: `Resposta ${decisionType}.`, followup_at: null });
      assert.equal(response.status, 200);
      const derived = await many(db, `SELECT type FROM premium_pending_items WHERE related_entity_id=? AND status='OPEN'`, feedbackId);
      assert.deepEqual(derived.map((item) => item.type), expectedPending ? [expectedPending] : []);
    }
  });
});

test('Student Record runtime keeps the approved professional-review UI contract', async () => {
  const source = await readFile('public/admin-premium-student-record.js', 'utf8');
  assert.match(source, /Análise profissional/);
  for (const type of ['KEEP_STRATEGY', 'UPDATE_PLAN', 'CONTACT_STUDENT', 'REQUEST_MORE_INFORMATION']) assert.match(source, new RegExp(type));
  assert.match(source, /coach_reply/);
  assert.match(source, /weekly-feedbacks\/\$\{encodeURIComponent\([^)]*\)\}\/decision/);
  assert.match(source, /reviewSubmitting/);
  assert.doesNotMatch(source, /\/api\/admin\/checkins\/[^/]+\/reply/);
});
