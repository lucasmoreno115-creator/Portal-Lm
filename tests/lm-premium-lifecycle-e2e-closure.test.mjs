import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';

const ENV = { ADMIN_TOKEN: 'admin-token', PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED: 'true' };
const NOW = '2026-08-14T13:00:00.000Z';

async function withDatabase(run) {
  const directory = await mkdtemp(join(tmpdir(), 'premium-lifecycle-closure-'));
  const db = new SqliteD1(join(directory, 'test.db'));
  try { await initializeSchemaForTests(db); await run(db); }
  finally { db.close(); await rm(directory, { recursive: true, force: true }); }
}

async function http(db, method, pathname, body, { student, admin = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (student) {
    headers['x-student-email'] = student.email;
    headers['x-student-token'] = student.token;
  } else if (admin) headers['x-admin-token'] = ENV.ADMIN_TOKEN;
  const response = await worker.fetch(new Request(`https://portal.test${pathname}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, ...ENV });
  return { status: response.status, body: await response.json() };
}

const one = (db, sql, ...params) => db.prepare(sql).bind(...params).first();
const many = async (db, sql, ...params) => (await db.prepare(sql).bind(...params).all()).results;
const summary = async (db) => (await http(db, 'GET', '/api/admin/premium/workspace/summary')).body.data;
const containsStudent = (items, studentId) => items.some((item) => item.studentId === studentId);

test('F3.4.4 closes the canonical Premium lifecycle through real HTTP, D1 and read models', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  await withDatabase(async (db) => {
    // A. The Workspace command creates the only shared identity used by the scenario.
    const email = 'lifecycle-closure@example.test';
    const created = await http(db, 'POST', '/api/admin/premium/workspace/students', {
      name: 'Aluno Lifecycle Closure', email, whatsapp: '11999990000', planType: 'PREMIUM',
    });
    assert.equal(created.status, 201);
    const student = { id: created.body.data.studentId, email, token: created.body.data.token };
    assert.ok(student.id); assert.ok(student.token);
    const initialPremium = await one(db, 'SELECT * FROM premium_students WHERE student_id=?', student.id);
    const initialAccess = await one(db, 'SELECT * FROM student_access WHERE student_id=?', student.id);
    assert.equal(initialPremium.consultation_status, 'AWAITING_ANAMNESIS');
    assert.equal(initialPremium.access_status, 'ACTIVE');
    assert.deepEqual({ email: initialAccess.email, token: initialAccess.access_token, status: initialAccess.status }, { email, token: student.token, status: 'ACTIVE' });
    assert.equal((await one(db, 'SELECT COUNT(*) total FROM premium_students WHERE student_id=?', student.id)).total, 1);
    assert.equal((await one(db, 'SELECT COUNT(*) total FROM student_access WHERE student_id=?', student.id)).total, 1);

    let workspace = await summary(db);
    assert.ok(containsStudent(workspace.anamnesis.queues.onboarding, student.id));
    const onboardingAccess = await http(db, 'GET', '/api/portal/premium/access-state', undefined, { student });
    assert.deepEqual({ status: onboardingAccess.status, lifecycle: onboardingAccess.body.data.consultationStatus, experience: onboardingAccess.body.data.experience, access: onboardingAccess.body.data.accessState },
      { status: 200, lifecycle: 'AWAITING_ANAMNESIS', experience: 'ONBOARDING', access: 'INACTIVE' });
    assert.equal((await http(db, 'GET', '/api/portal/premium/weekly-feedback/current', undefined, { student })).status, 403);

    // B/C. Submission and professional analysis are separate lifecycle operations.
    const submitted = await http(db, 'POST', '/api/anamnese-premium', { answers: { objective: 'Saúde e constância' } }, { student });
    assert.equal(submitted.status, 200); assert.equal(submitted.body.data.alreadySubmitted, false);
    const anamnesisId = submitted.body.data.id;
    assert.deepEqual(await one(db, 'SELECT consultation_status FROM premium_students WHERE student_id=?', student.id), { consultation_status: 'UNDER_REVIEW' });
    assert.equal((await one(db, 'SELECT analyzed_at FROM premium_anamnesis WHERE id=?', anamnesisId)).analyzed_at, null);
    const anamnesisPending = await one(db, "SELECT * FROM premium_pending_items WHERE student_id=? AND type='ANALYZE_ANAMNESIS'", student.id);
    assert.equal(anamnesisPending.status, 'OPEN');
    assert.equal((await one(db, "SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='ANAMNESIS_SENT'", student.id)).total, 1);
    workspace = await summary(db);
    assert.equal(containsStudent(workspace.anamnesis.queues.onboarding, student.id), false);
    assert.ok(containsStudent(workspace.anamnesis.queues.underReview, student.id));
    assert.ok(workspace.pendingItems.items.some((item) => item.id === anamnesisPending.id && item.typeLabel === 'Analisar anamnese' && item.cta.label === 'Abrir anamnese'));

    const analyzed = await http(db, 'POST', `/api/admin/premium/anamnesis/${student.id}/analyze`, {});
    assert.equal(analyzed.status, 200); assert.equal(analyzed.body.data.changed, true);
    const analyzedAt = analyzed.body.data.analyzed_at; assert.ok(analyzedAt);
    assert.equal((await one(db, 'SELECT consultation_status FROM premium_students WHERE student_id=?', student.id)).consultation_status, 'UNDER_REVIEW');
    assert.deepEqual(await one(db, 'SELECT status,analyzed_at FROM premium_anamnesis WHERE id=?', anamnesisId), { status: 'ANALISADA', analyzed_at: analyzedAt });
    assert.equal((await one(db, 'SELECT status FROM premium_pending_items WHERE id=?', anamnesisPending.id)).status, 'RESOLVED');
    assert.equal((await one(db, "SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='ANAMNESIS_ANALYZED'", student.id)).total, 1);
    workspace = await summary(db);
    assert.ok(containsStudent(workspace.anamnesis.queues.underReview, student.id));
    assert.equal(workspace.pendingItems.items.some((item) => item.id === anamnesisPending.id), false);
    const analyzeRetry = await http(db, 'POST', `/api/admin/premium/anamnesis/${student.id}/analyze`, {});
    assert.deepEqual({ changed: analyzeRetry.body.data.changed, unchanged: analyzeRetry.body.data.unchanged, analyzedAt: analyzeRetry.body.data.analyzed_at }, { changed: false, unchanged: true, analyzedAt });
    assert.equal((await one(db, "SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='ANAMNESIS_ANALYZED'", student.id)).total, 1);

    // D/E. Planning readiness and release use their canonical commands.
    const ready = await http(db, 'POST', `/api/admin/premium/workspace/students/${student.id}/mark-ready`, {});
    assert.equal(ready.status, 200);
    assert.equal((await one(db, 'SELECT consultation_status FROM premium_students WHERE student_id=?', student.id)).consultation_status, 'READY_TO_RELEASE');
    workspace = await summary(db);
    assert.equal(containsStudent(workspace.anamnesis.queues.underReview, student.id), false);
    assert.ok(containsStudent(workspace.anamnesis.queues.readyToRelease, student.id));
    assert.equal((await one(db, 'SELECT analyzed_at FROM premium_anamnesis WHERE id=?', anamnesisId)).analyzed_at, analyzedAt);

    const released = await http(db, 'POST', `/api/admin/premium/workspace/students/${student.id}/release`, {});
    assert.equal(released.status, 200);
    assert.deepEqual(await one(db, 'SELECT consultation_status,access_status FROM premium_students WHERE student_id=?', student.id), { consultation_status: 'ACTIVE', access_status: 'ACTIVE' });
    // Add Projeto LM to the same shared identity once Premium onboarding is complete.
    await db.prepare("UPDATE student_access SET plan='projeto_lm',plan_type='PROJECT_LM' WHERE id=?").bind(initialAccess.id).run();
    await db.prepare(`INSERT INTO project_lm_profiles(user_id,name,goal,sex,weight_kg,height_cm,nutrition_plan_code,created_at,updated_at)
      VALUES(?,'Aluno Lifecycle Closure','Preservar isolamento','female',60,165,'F60',?,?)`).bind(initialAccess.id, NOW, NOW).run();
    const projectSnapshot = await one(db, 'SELECT * FROM project_lm_profiles WHERE user_id=?', initialAccess.id);
    for (const path of ['/api/portal/premium/weekly-feedback/current', '/api/portal/premium/nutrition-plan/current']) {
      assert.notEqual((await http(db, 'GET', path, undefined, { student })).status, 403);
    }
    assert.equal((await http(db, 'GET', '/api/portal/premium/access-state', undefined, { student })).body.data.accessState, 'ACTIVE');
    assert.equal((await http(db, 'GET', '/api/portal/project-lm/profile', undefined, { student })).status, 200);

    // F. Submit real weekly work and add only auxiliary persistence fixtures.
    const feedback = await http(db, 'POST', '/api/portal/premium/weekly-feedback/current', {
      trainingAdherence: 'Quatro treinos', nutritionAdherence: 'Boa', cardioAdherence: 'Três', sleepQuality: 'Boa', energyLevel: 'Alta', weeklyWeight: '60', mainDifficulty: 'Agenda', routineContext: 'Trabalho', supportNeeded: 'Planejamento',
    }, { student });
    assert.equal(feedback.status, 200);
    const checkinId = feedback.body.data.id;
    const weeklyPending = await one(db, "SELECT * FROM premium_pending_items WHERE student_id=? AND type='ANALYZE_WEEKLY_FEEDBACK'", student.id);
    assert.deepEqual({ related: weeklyPending.related_entity_id, status: weeklyPending.status }, { related: checkinId, status: 'OPEN' });
    const planId = 'lifecycle-preserved-plan';
    await db.prepare(`INSERT INTO nutrition_plans(id,student_id,student_email,title,status,is_active,version_number,meals_json,substitutions_json,adherence_rules_json,created_at,updated_at)
      VALUES(?,?,?,'Plano preservado','PUBLISHED',1,3,'[{"name":"Almoço"}]','[]','[]',?,?)`).bind(planId, student.id, email, NOW, NOW).run();
    await db.prepare(`INSERT INTO premium_followup_entries(id,student_id,entry_type,title,content,source,created_at,updated_at)
      VALUES('lifecycle-followup',?,'NOTE','Histórico preservado','Não excluir','test',?,?)`).bind(student.id, NOW, NOW).run();
    workspace = await summary(db);
    assert.ok(workspace.checkins.items.some((item) => item.checkinId === checkinId));
    assert.ok(workspace.pendingItems.items.some((item) => item.id === weeklyPending.id));

    const snapshot = {
      access: await one(db, 'SELECT * FROM student_access WHERE student_id=?', student.id),
      anamnesis: await one(db, 'SELECT * FROM premium_anamnesis WHERE id=?', anamnesisId),
      checkin: await one(db, 'SELECT * FROM student_checkins WHERE id=?', checkinId),
      pending: await many(db, 'SELECT * FROM premium_pending_items WHERE student_id=? ORDER BY id', student.id),
      plan: await one(db, 'SELECT * FROM nutrition_plans WHERE id=?', planId),
      followup: await one(db, "SELECT * FROM premium_followup_entries WHERE id='lifecycle-followup'"),
      project: await one(db, 'SELECT * FROM project_lm_profiles WHERE user_id=?', initialAccess.id),
    };

    // G. Ending Premium hides operational work, but preserves shared identity and history.
    const deactivated = await http(db, 'POST', `/api/admin/premium/workspace/students/${student.id}/deactivate`, {});
    assert.equal(deactivated.status, 200); assert.equal(deactivated.body.data.changed, true);
    const deactivatedAt = deactivated.body.data.deactivatedAt; assert.ok(deactivatedAt);
    assert.deepEqual(await one(db, 'SELECT consultation_status,access_status,deactivated_at FROM premium_students WHERE student_id=?', student.id), { consultation_status: 'ENDED', access_status: 'INACTIVE', deactivated_at: deactivatedAt });
    assert.deepEqual(await one(db, 'SELECT * FROM student_access WHERE student_id=?', student.id), snapshot.access);
    assert.equal((await http(db, 'GET', '/api/portal/premium/access-state', undefined, { student })).body.data.accessState, 'INACTIVE');
    for (const path of ['/api/portal/premium/weekly-feedback/current', '/api/portal/premium/nutrition-plan/current']) assert.equal((await http(db, 'GET', path, undefined, { student })).status, 403);
    assert.equal((await http(db, 'GET', '/api/portal/project-lm/profile', undefined, { student })).status, 200);
    workspace = await summary(db);
    for (const queue of Object.values(workspace.anamnesis.queues)) assert.equal(containsStudent(queue, student.id), false);
    assert.equal(workspace.checkins.items.some((item) => item.checkinId === checkinId), false);
    assert.equal(workspace.pendingItems.items.some((item) => item.id === weeklyPending.id), false);
    assert.equal((await one(db, 'SELECT status FROM premium_pending_items WHERE id=?', weeklyPending.id)).status, 'OPEN');
    const recordEnded = await http(db, 'GET', `/api/admin/premium/students/${student.id}/record`);
    assert.equal(recordEnded.status, 200); assert.equal(recordEnded.body.data.student.consultation_status, 'ENDED'); assert.equal(recordEnded.body.data.student.deactivated_at, deactivatedAt);
    assert.deepEqual(await one(db, 'SELECT * FROM premium_anamnesis WHERE id=?', anamnesisId), snapshot.anamnesis);
    assert.deepEqual(await one(db, 'SELECT * FROM student_checkins WHERE id=?', checkinId), snapshot.checkin);
    assert.deepEqual(await one(db, 'SELECT * FROM nutrition_plans WHERE id=?', planId), snapshot.plan);
    assert.deepEqual(await one(db, "SELECT * FROM premium_followup_entries WHERE id='lifecycle-followup'"), snapshot.followup);
    assert.deepEqual(await one(db, 'SELECT * FROM project_lm_profiles WHERE user_id=?', initialAccess.id), projectSnapshot);
    const deactivateRetry = await http(db, 'POST', `/api/admin/premium/workspace/students/${student.id}/deactivate`, {});
    assert.deepEqual({ changed: deactivateRetry.body.data.changed, unchanged: deactivateRetry.body.data.unchanged, at: deactivateRetry.body.data.deactivatedAt }, { changed: false, unchanged: true, at: deactivatedAt });

    // H. Reactivation restores authorization/read models without rebuilding anything.
    const reactivated = await http(db, 'POST', `/api/admin/premium/workspace/students/${student.id}/reactivate`, {});
    assert.equal(reactivated.status, 200); assert.equal(reactivated.body.data.changed, true);
    const reactivatedAt = reactivated.body.data.reactivatedAt; assert.ok(reactivatedAt);
    assert.deepEqual(await one(db, 'SELECT consultation_status,access_status,deactivated_at,reactivated_at FROM premium_students WHERE student_id=?', student.id), { consultation_status: 'ACTIVE', access_status: 'ACTIVE', deactivated_at: deactivatedAt, reactivated_at: reactivatedAt });
    assert.notEqual((await http(db, 'GET', '/api/portal/premium/weekly-feedback/current', undefined, { student })).status, 403);
    assert.equal((await http(db, 'GET', '/api/portal/project-lm/profile', undefined, { student })).status, 200);
    workspace = await summary(db);
    assert.ok(workspace.checkins.items.some((item) => item.checkinId === checkinId));
    assert.ok(workspace.pendingItems.items.some((item) => item.id === weeklyPending.id));
    assert.deepEqual(await one(db, 'SELECT * FROM student_access WHERE student_id=?', student.id), snapshot.access);
    assert.deepEqual(await one(db, 'SELECT * FROM premium_anamnesis WHERE id=?', anamnesisId), snapshot.anamnesis);
    assert.deepEqual(await one(db, 'SELECT * FROM student_checkins WHERE id=?', checkinId), snapshot.checkin);
    assert.deepEqual(await many(db, 'SELECT * FROM premium_pending_items WHERE student_id=? ORDER BY id', student.id), snapshot.pending);
    assert.deepEqual(await one(db, 'SELECT * FROM nutrition_plans WHERE id=?', planId), snapshot.plan);
    assert.deepEqual(await one(db, 'SELECT * FROM project_lm_profiles WHERE user_id=?', initialAccess.id), snapshot.project);
    assert.equal((await one(db, 'SELECT COUNT(*) total FROM premium_anamnesis WHERE student_id=?', student.id)).total, 1);
    assert.equal((await one(db, 'SELECT COUNT(*) total FROM student_checkins WHERE id=?', checkinId)).total, 1);
    assert.equal((await one(db, 'SELECT COUNT(*) total FROM nutrition_plans WHERE student_id=?', student.id)).total, 1);
    assert.equal((await one(db, 'SELECT COUNT(*) total FROM premium_pending_items WHERE id=?', weeklyPending.id)).total, 1);

    const reactivateRetry = await http(db, 'POST', `/api/admin/premium/workspace/students/${student.id}/reactivate`, {});
    assert.deepEqual({ changed: reactivateRetry.body.data.changed, unchanged: reactivateRetry.body.data.unchanged, at: reactivateRetry.body.data.reactivatedAt }, { changed: false, unchanged: true, at: reactivatedAt });
    for (const type of ['STUDENT_DEACTIVATED', 'STUDENT_REACTIVATED']) assert.equal((await one(db, 'SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type=?', student.id, type)).total, 1);
    const events = await many(db, 'SELECT event_type FROM activity_timeline WHERE student_id=? ORDER BY created_at,rowid', student.id);
    const positions = ['ANAMNESIS_SENT', 'ANAMNESIS_ANALYZED', 'STUDENT_DEACTIVATED', 'STUDENT_REACTIVATED'].map((type) => events.findIndex((event) => event.event_type === type));
    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  });
});
