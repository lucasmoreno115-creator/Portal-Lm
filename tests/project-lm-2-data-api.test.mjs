import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/api.js';

const apiSource = await readFile('workers/api.js', 'utf8');
const migration = `${await readFile('migrations/0019_lm2_data_layer.sql', 'utf8')}
${await readFile('migrations/0020_lm2_daily_checkins.sql', 'utf8')}`;

test('LM 2.0 schema is isolated and created by migration and ensureSchema', () => {
  for (const source of [apiSource, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS lm2_profiles/);
    assert.match(source, /student_id TEXT PRIMARY KEY/);
    assert.match(source, /nutrition_plan_id TEXT NOT NULL/);
    assert.match(source, /training_plan_id TEXT NOT NULL/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS lm2_journeys/);
    assert.match(source, /current_week INTEGER NOT NULL DEFAULT 1/);
    assert.match(source, /status TEXT NOT NULL DEFAULT 'active'/);
    assert.match(source, /week_started_at TEXT/);
    assert.match(source, /week_completed_at TEXT/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS lm2_checkins/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS lm2_week_2_foundation/);
    assert.match(source, /minimum_response TEXT/);
    assert.match(source, /student_id TEXT NOT NULL/);
    assert.match(source, /checkin_date TEXT NOT NULL/);
    assert.match(source, /week_number INTEGER NOT NULL/);
    assert.match(source, /continuity_point INTEGER NOT NULL/);
    assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS idx_lm2_checkins_student_date/);
  }
});

test('LM 2.0 onboarding creates profile and journey with selected plans', async () => {
  const db = new FakeD1('projeto_lm');
  const res = await api(db, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.current_week, 1);
  assert.equal(res.body.data.next_action, 'week_1_video');
  assert.equal(res.body.data.nutrition_ready, true);
  assert.equal(res.body.data.training_ready, true);
  assert.equal(db.tables.lm2_profiles[0].nutrition_plan_id, 'H2');
  assert.equal(db.tables.lm2_profiles[0].training_plan_id, 'gym_male');
  assert.equal(db.tables.lm2_journeys.length, 1);
  assert.doesNotMatch(JSON.stringify(res.body), /\b[MH][123]\b/);
});

test('LM 2.0 onboarding selects all nutrition and training plan bands', async () => {
  const cases = [
    ['female', 69.9, 'M1', 'gym_female'], ['female', 70, 'M2', 'gym_female'], ['female', 90, 'M3', 'gym_female'],
    ['male', 79.9, 'H1', 'gym_male'], ['male', 80, 'H2', 'gym_male'], ['male', 100, 'H3', 'gym_male']
  ];
  for (const [sex, weight_kg, nutrition, training] of cases) {
    const db = new FakeD1('projeto_lm');
    await api(db, 'POST', '/api/project-lm-2/onboarding', { name: 'Aluno', goal: 'emagrecer', sex, weight_kg });
    assert.equal(db.tables.lm2_profiles[0].nutrition_plan_id, nutrition);
    assert.equal(db.tables.lm2_profiles[0].training_plan_id, training);
  }
});

test('LM 2.0 onboarding updates existing profile without duplicating journey', async () => {
  const db = new FakeD1('projeto_lm');
  await api(db, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  await api(db, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas M', goal: 'secar', sex: 'male', weight_kg: 101 });
  assert.equal(db.tables.lm2_profiles.length, 1);
  assert.equal(db.tables.lm2_journeys.length, 1);
  assert.equal(db.tables.lm2_profiles[0].name, 'Lucas M');
  assert.equal(db.tables.lm2_profiles[0].nutrition_plan_id, 'H3');
});

test('LM 2.0 onboarding rejects invalid payloads', async () => {
  assert.equal((await api(new FakeD1('projeto_lm'), 'POST', '/api/project-lm-2/onboarding', { name: '', goal: 'x', sex: 'male', weight_kg: 87 })).status, 400);
  assert.equal((await api(new FakeD1('projeto_lm'), 'POST', '/api/project-lm-2/onboarding', { name: 'A', goal: 'x', sex: 'other', weight_kg: 87 })).status, 400);
  assert.equal((await api(new FakeD1('projeto_lm'), 'POST', '/api/project-lm-2/onboarding', { name: 'A', goal: 'x', sex: 'male', weight_kg: 250 })).status, 400);
});

test('LM 2.0 home returns onboarding_required before profile and week 1 after onboarding', async () => {
  const db = new FakeD1('projeto_lm');
  const before = await api(db, 'GET', '/api/project-lm-2/home');
  assert.equal(before.status, 200);
  assert.equal(before.body.data.state, 'onboarding_required');
  await api(db, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  const after = await api(db, 'GET', '/api/project-lm-2/home');
  assert.equal(after.body.data.current_week, 1);
  assert.equal(after.body.data.next_action, 'week_1_video');
  assert.doesNotMatch(JSON.stringify(after.body), /\b[MH][123]\b/);
});


test('LM 2.0 Week 1 video and Plano B update next action', async () => {
  const db = new FakeD1('projeto_lm');
  await api(db, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  const video = await api(db, 'POST', '/api/project-lm-2/week-1/video-complete');
  assert.equal(video.status, 200);
  assert.equal(video.body.data.next_action, 'create_plan_b');
  assert.equal(video.body.data.week_1_video_completed, true);

  const plan = await api(db, 'POST', '/api/project-lm-2/plan-b', { unable_to_train: 'caminhar 10 min', overeating: 'voltar na próxima refeição', no_motivation: 'fazer o mínimo' });
  assert.equal(plan.status, 200);
  assert.equal(plan.body.data.next_action, 'daily_checkin');
  assert.equal(plan.body.data.plan_b_completed, true);

  const home = await api(db, 'GET', '/api/project-lm-2/home');
  assert.equal(home.body.data.next_action, 'daily_checkin');
});


test('LM 2.0 daily check-in scores continuity and blocks duplicate daily submissions', async () => {
  const db = new FakeD1('projeto_lm');
  await api(db, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  const first = await api(db, 'POST', '/api/project-lm-2/checkin', { answer: 'on_track' });
  assert.equal(first.status, 201);
  assert.equal(first.body.data.continuity_days_count, 1);
  assert.equal(first.body.data.required_days_count, 5);
  assert.equal(first.body.data.remaining_days, 4);
  assert.equal(first.body.data.goal_reached, false);
  assert.equal(db.tables.lm2_checkins[0].continuity_point, 1);
  const duplicate = await api(db, 'POST', '/api/project-lm-2/checkin', { answer: 'adapted' });
  assert.equal(duplicate.status, 409);
  assert.equal(db.tables.lm2_checkins.length, 1);
});

test('LM 2.0 check-in maps adapted to 1, off_track to 0, and returns progress', async () => {
  const adaptedDb = new FakeD1('projeto_lm');
  await api(adaptedDb, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  const adapted = await api(adaptedDb, 'POST', '/api/project-lm-2/checkin', { answer: 'adapted' });
  assert.equal(adapted.status, 201);
  assert.equal(adaptedDb.tables.lm2_checkins[0].continuity_point, 1);

  const offTrackDb = new FakeD1('projeto_lm');
  await api(offTrackDb, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  const offTrack = await api(offTrackDb, 'POST', '/api/project-lm-2/checkin', { answer: 'off_track' });
  assert.equal(offTrack.status, 201);
  assert.equal(offTrackDb.tables.lm2_checkins[0].continuity_point, 0);
  const progress = await api(offTrackDb, 'GET', '/api/project-lm-2/progress');
  assert.deepEqual(progress.body.data, { continuity_days_count: 0, required_days_count: 5, remaining_days: 5, goal_reached: false, today_checkin_completed: true });
});


test('LM 2.0 week-status returns incomplete with less than 5 days and completed with 5 or more days', async () => {
  const db = new FakeD1('projeto_lm');
  await completeFoundation(db);
  addCheckins(db, ['on_track', 'adapted', 'off_track', 'on_track']);
  const incomplete = await api(db, 'GET', '/api/project-lm-2/week-status');
  assert.equal(incomplete.status, 200);
  assert.deepEqual(incomplete.body.data, { current_week: 1, week_completed: false, video_completed: true, plan_b_completed: true, continuity_days_count: 3, required_days_count: 5, remaining_days: 2, next_week_available: false });

  addCheckins(db, ['adapted', 'on_track'], 5);
  const complete = await api(db, 'GET', '/api/project-lm-2/week-status');
  assert.equal(complete.body.data.week_completed, true);
  assert.equal(complete.body.data.continuity_days_count, 5);
  assert.equal(complete.body.data.remaining_days, 0);
  assert.equal(complete.body.data.next_week_available, true);

  addCheckins(db, ['on_track'], 8);
  const over = await api(db, 'GET', '/api/project-lm-2/week-status');
  assert.equal(over.body.data.week_completed, true);
  assert.equal(over.body.data.continuity_days_count, 6);
  assert.equal(over.body.data.remaining_days, 0);
});

test('LM 2.0 week-status requires video, Plano B and 5 continuity days', async () => {
  const noVideo = new FakeD1('projeto_lm');
  await api(noVideo, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  await api(noVideo, 'POST', '/api/project-lm-2/plan-b', { unable_to_train: 'caminhar', overeating: 'retomar', no_motivation: 'mínimo' });
  addCheckins(noVideo, ['on_track', 'adapted', 'on_track', 'adapted', 'on_track']);
  assert.equal((await api(noVideo, 'GET', '/api/project-lm-2/week-status')).body.data.week_completed, false);

  const noPlan = new FakeD1('projeto_lm');
  await api(noPlan, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  await api(noPlan, 'POST', '/api/project-lm-2/week-1/video-complete');
  addCheckins(noPlan, ['on_track', 'adapted', 'on_track', 'adapted', 'on_track']);
  assert.equal((await api(noPlan, 'GET', '/api/project-lm-2/week-status')).body.data.week_completed, false);

  const noDays = new FakeD1('projeto_lm');
  await completeFoundation(noDays);
  addCheckins(noDays, ['on_track', 'adapted', 'off_track', 'on_track']);
  const status = await api(noDays, 'GET', '/api/project-lm-2/week-status');
  assert.equal(status.body.data.week_completed, false);
  assert.equal(status.body.data.continuity_days_count, 3);
});

test('LM 2.0 home returns week_1_complete when all Week 1 criteria are fulfilled', async () => {
  const db = new FakeD1('projeto_lm');
  await completeFoundation(db);
  addCheckins(db, ['on_track', 'adapted', 'on_track', 'adapted', 'on_track']);
  const home = await api(db, 'GET', '/api/project-lm-2/home');
  assert.equal(home.body.data.next_action, 'week_1_complete');
  assert.equal(home.body.data.next_action_label, 'Continuar para Semana 2');
  assert.equal(home.body.data.week_completed, true);
});

test('LM 2.0 activate-week-2 rejects incomplete Week 1', async () => {
  const db = new FakeD1('projeto_lm');
  await completeFoundation(db);
  addCheckins(db, ['on_track', 'adapted', 'on_track']);
  const activation = await api(db, 'POST', '/api/project-lm-2/activate-week-2');
  assert.equal(activation.status, 409);
  assert.equal(activation.body.code, 'WEEK_1_NOT_COMPLETED');
  assert.equal(db.tables.lm2_journeys[0].current_week, 1);
});

test('LM 2.0 activate-week-2 promotes journey once and persists week timestamps', async () => {
  const db = new FakeD1('projeto_lm');
  await completeFoundation(db);
  addCheckins(db, ['on_track', 'adapted', 'on_track', 'adapted', 'on_track']);

  const first = await api(db, 'POST', '/api/project-lm-2/activate-week-2');
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.data, { current_week: 2, activated: true });
  assert.equal(db.tables.lm2_journeys[0].current_week, 2);
  assert.ok(db.tables.lm2_journeys[0].week_started_at);
  assert.ok(db.tables.lm2_journeys[0].week_completed_at);
  const startedAt = db.tables.lm2_journeys[0].week_started_at;
  const completedAt = db.tables.lm2_journeys[0].week_completed_at;

  const second = await api(db, 'POST', '/api/project-lm-2/activate-week-2');
  assert.equal(second.status, 200);
  assert.deepEqual(second.body.data, { current_week: 2, activated: true });
  assert.equal(db.tables.lm2_journeys[0].current_week, 2);
  assert.equal(db.tables.lm2_journeys[0].week_started_at, startedAt);
  assert.equal(db.tables.lm2_journeys[0].week_completed_at, completedAt);
});

test('LM 2.0 home switches to Week 2 flow after official activation', async () => {
  const db = new FakeD1('projeto_lm');
  await completeFoundation(db);
  addCheckins(db, ['on_track', 'adapted', 'on_track', 'adapted', 'on_track']);
  await api(db, 'POST', '/api/project-lm-2/activate-week-2');
  const home = await api(db, 'GET', '/api/project-lm-2/home');
  assert.equal(home.body.data.current_week, 2);
  assert.equal(home.body.data.next_action, 'week_2_video');
  assert.equal(home.body.data.week_2_video_completed, false);
  assert.ok(home.body.data.week_started_at);
  assert.ok(home.body.data.week_completed_at);
});

test('LM 2.0 Week 2 video, reflection, minimum response and status are isolated', async () => {
  const db = new FakeD1('projeto_lm');
  await completeFoundation(db);
  db.tables.lm2_journeys[0].current_week = 2;

  const video = await api(db, 'POST', '/api/project-lm-2/week-2/video-complete');
  assert.equal(video.status, 200);
  assert.equal(video.body.data.next_action, 'week_2_reflection');
  assert.equal(video.body.data.week_2_video_completed, true);

  const reflection = await api(db, 'POST', '/api/project-lm-2/week-2/reflection', { reflection: 'Viagem costuma bagunçar minha rotina.' });
  assert.equal(reflection.status, 200);
  assert.equal(reflection.body.data.next_action, 'week_2_minimum_response');
  assert.equal(reflection.body.data.week_2_reflection_completed, true);

  const response = await api(db, 'POST', '/api/project-lm-2/week-2/reflection', { minimum_response: 'Caminhar 10 minutos e fazer uma refeição simples.' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.next_action, 'daily_checkin');
  assert.equal(response.body.data.week_2_response_completed, true);

  const status = await api(db, 'GET', '/api/project-lm-2/week-2/status');
  assert.deepEqual(status.body.data, { video_completed: true, reflection_completed: true, minimum_response_completed: true, week_completed: true });

  const home = await api(db, 'GET', '/api/project-lm-2/home');
  assert.equal(home.body.data.current_week, 2);
  assert.equal(home.body.data.next_action, 'daily_checkin');
});

test('LM 2.0 API is isolated from V5, Premium and Admin namespaces', () => {
  assert.match(apiSource, /\/api\/project-lm-2\/onboarding/);
  assert.match(apiSource, /\/api\/project-lm-2\/home/);
  const lm2Block = apiSource.slice(apiSource.indexOf("if (url.pathname === '/api/project-lm-2/onboarding'"), apiSource.indexOf("if (url.pathname === '/api/project-lm/journey'"));
  assert.doesNotMatch(lm2Block, /admin_/);
  assert.doesNotMatch(lm2Block, /premium_/);
});

async function completeFoundation(db) {
  await api(db, 'POST', '/api/project-lm-2/onboarding', { name: 'Lucas', goal: 'emagrecer', sex: 'male', weight_kg: 87 });
  await api(db, 'POST', '/api/project-lm-2/week-1/video-complete');
  await api(db, 'POST', '/api/project-lm-2/plan-b', { unable_to_train: 'caminhar 10 min', overeating: 'voltar na próxima refeição', no_motivation: 'fazer o mínimo' });
}

function addCheckins(db, answers, startDay = 1) {
  const student_id = 'student-1';
  answers.forEach((answer, index) => {
    db.tables.lm2_checkins.push({ student_id, checkin_date: `2026-06-${String(startDay + index).padStart(2, '0')}`, week_number: 1, answer, continuity_point: answer === 'off_track' ? 0 : 1, created_at: '2026-06-01T00:00:00.000Z', updated_at: '2026-06-01T00:00:00.000Z' });
  });
}

async function api(db, method, pathname, body) {
  const request = new Request(`https://portal.test${pathname}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-student-email': 'student@example.com', 'x-student-token': 'token' },
    body: body ? JSON.stringify(body) : undefined
  });
  const response = await worker.fetch(request, { DB: db });
  return { status: response.status, body: await response.json() };
}

class FakeD1 {
  constructor(plan) { this.plan = plan; this.tables = { lm2_profiles: [], lm2_journeys: [], lm2_week_1_foundation: [], lm2_week_2_foundation: [], lm2_checkins: [] }; }
  prepare(sql) { return new FakeD1Statement(this, sql); }
}
class FakeD1Statement {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql.replace(/\s+/g, ' ').trim(); this.params = params; }
  bind(...params) { return new FakeD1Statement(this.db, this.sql, params); }
  async run() {
    const s = this.sql, p = this.params;
    if (/^(CREATE|ALTER|DROP) /i.test(s) || /^CREATE (UNIQUE )?INDEX/i.test(s) || /^INSERT OR IGNORE/i.test(s)) return { meta: { changes: 0 } };
    if (s.startsWith('INSERT INTO lm2_profiles')) { this.db.tables.lm2_profiles.push({ student_id: p[0], name: p[1], goal: p[2], sex: p[3], weight_kg: p[4], nutrition_plan_id: p[5], training_plan_id: p[6], created_at: p[7], updated_at: p[8] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('UPDATE lm2_profiles')) { const r = this.db.tables.lm2_profiles.find(x => x.student_id === p[7]); Object.assign(r, { name: p[0], goal: p[1], sex: p[2], weight_kg: p[3], nutrition_plan_id: p[4], training_plan_id: p[5], updated_at: p[6] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('INSERT INTO lm2_journeys')) { this.db.tables.lm2_journeys.push({ student_id: p[0], current_week: 1, status: 'active', started_at: p[1], completed_at: null, week_started_at: null, week_completed_at: null, created_at: p[2], updated_at: p[3] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('UPDATE lm2_journeys SET current_week=2')) { const r = this.db.tables.lm2_journeys.find(x => x.student_id === p[3] && x.current_week === 1); if (r) Object.assign(r, { current_week: 2, week_completed_at: r.week_completed_at || p[0], week_started_at: r.week_started_at || p[1], updated_at: p[2] }); return { meta: { changes: r ? 1 : 0 } }; }
    if (s.startsWith('INSERT INTO lm2_week_1_foundation')) { this.db.tables.lm2_week_1_foundation.push({ student_id: p[0], video_completed: 0, unable_to_train: null, overeating: null, no_motivation: null, video_completed_at: null, plan_b_saved_at: null, created_at: p[1], updated_at: p[2] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('INSERT INTO lm2_week_2_foundation')) { this.db.tables.lm2_week_2_foundation.push({ student_id: p[0], video_completed: 0, reflection: null, minimum_response: null, created_at: p[1], updated_at: p[2] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('UPDATE lm2_week_2_foundation SET video_completed=1')) { const r = this.db.tables.lm2_week_2_foundation.find(x => x.student_id === p[1]); Object.assign(r, { video_completed: 1, updated_at: p[0] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('UPDATE lm2_week_2_foundation SET reflection=')) { const r = this.db.tables.lm2_week_2_foundation.find(x => x.student_id === p[2]); Object.assign(r, { reflection: p[0], updated_at: p[1] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('UPDATE lm2_week_2_foundation SET minimum_response=')) { const r = this.db.tables.lm2_week_2_foundation.find(x => x.student_id === p[2]); Object.assign(r, { minimum_response: p[0], updated_at: p[1] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('UPDATE lm2_week_1_foundation SET video_completed=1')) { const r = this.db.tables.lm2_week_1_foundation.find(x => x.student_id === p[2]); Object.assign(r, { video_completed: 1, video_completed_at: r.video_completed_at || p[0], updated_at: p[1] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('INSERT INTO lm2_checkins')) { this.db.tables.lm2_checkins.push({ student_id: p[0], checkin_date: p[1], week_number: p[2], answer: p[3], continuity_point: p[4], created_at: p[5], updated_at: p[6] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('UPDATE lm2_week_1_foundation SET unable_to_train')) { const r = this.db.tables.lm2_week_1_foundation.find(x => x.student_id === p[5]); Object.assign(r, { unable_to_train: p[0], overeating: p[1], no_motivation: p[2], plan_b_saved_at: p[3], updated_at: p[4] }); return { meta: { changes: 1 } }; }
    return { meta: { changes: 0 } };
  }
  async first() {
    const s = this.sql, p = this.params;
    if (s.startsWith('SELECT id, name, email, plan_type, plan FROM student_access')) return { id: 'student-1', name: 'Student', email: 'student@example.com', plan_type: this.db.plan === 'premium' ? 'PREMIUM' : 'PROJECT_LM', plan: this.db.plan };
    if (s.startsWith('SELECT * FROM lm2_profiles')) return this.db.tables.lm2_profiles.find(x => x.student_id === p[0]) || null;
    if (s.startsWith('SELECT * FROM lm2_journeys')) return this.db.tables.lm2_journeys.find(x => x.student_id === p[0]) || null;
    if (s.startsWith('SELECT * FROM lm2_week_1_foundation')) return this.db.tables.lm2_week_1_foundation.find(x => x.student_id === p[0]) || null;
    if (s.startsWith('SELECT * FROM lm2_week_2_foundation')) return this.db.tables.lm2_week_2_foundation.find(x => x.student_id === p[0]) || null;
    if (s.startsWith('SELECT COALESCE(SUM(continuity_point)')) return { total: this.db.tables.lm2_checkins.filter(x => x.student_id === p[0] && x.week_number === p[1]).reduce((sum, x) => sum + x.continuity_point, 0) };
    if (s.startsWith('SELECT answer FROM lm2_checkins')) return this.db.tables.lm2_checkins.find(x => x.student_id === p[0] && x.checkin_date === p[1]) || null;
    return null;
  }
  async all() { return { results: [] }; }
}
