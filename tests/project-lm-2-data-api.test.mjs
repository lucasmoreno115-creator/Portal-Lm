import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/api.js';

const apiSource = await readFile('workers/api.js', 'utf8');
const migration = await readFile('migrations/0019_lm2_data_layer.sql', 'utf8');

test('LM 2.0 schema is isolated and created by migration and ensureSchema', () => {
  for (const source of [apiSource, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS lm2_profiles/);
    assert.match(source, /student_id TEXT PRIMARY KEY/);
    assert.match(source, /nutrition_plan_id TEXT NOT NULL/);
    assert.match(source, /training_plan_id TEXT NOT NULL/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS lm2_journeys/);
    assert.match(source, /current_week INTEGER NOT NULL DEFAULT 1/);
    assert.match(source, /status TEXT NOT NULL DEFAULT 'active'/);
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
  assert.equal(plan.body.data.next_action, 'checkin_pending_placeholder');
  assert.equal(plan.body.data.plan_b_completed, true);

  const home = await api(db, 'GET', '/api/project-lm-2/home');
  assert.equal(home.body.data.next_action, 'checkin_pending_placeholder');
});

test('LM 2.0 API is isolated from V5, Premium and Admin namespaces', () => {
  assert.match(apiSource, /\/api\/project-lm-2\/onboarding/);
  assert.match(apiSource, /\/api\/project-lm-2\/home/);
  const lm2Block = apiSource.slice(apiSource.indexOf("if (url.pathname === '/api/project-lm-2/onboarding'"), apiSource.indexOf("if (url.pathname === '/api/project-lm/journey'"));
  assert.doesNotMatch(lm2Block, /admin_/);
  assert.doesNotMatch(lm2Block, /premium_/);
});

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
  constructor(plan) { this.plan = plan; this.tables = { lm2_profiles: [], lm2_journeys: [], lm2_week_1_foundation: [] }; }
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
    if (s.startsWith('INSERT INTO lm2_journeys')) { this.db.tables.lm2_journeys.push({ student_id: p[0], current_week: 1, status: 'active', started_at: p[1], completed_at: null, created_at: p[2], updated_at: p[3] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('INSERT INTO lm2_week_1_foundation')) { this.db.tables.lm2_week_1_foundation.push({ student_id: p[0], video_completed: 0, unable_to_train: null, overeating: null, no_motivation: null, video_completed_at: null, plan_b_saved_at: null, created_at: p[1], updated_at: p[2] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('UPDATE lm2_week_1_foundation SET video_completed=1')) { const r = this.db.tables.lm2_week_1_foundation.find(x => x.student_id === p[2]); Object.assign(r, { video_completed: 1, video_completed_at: r.video_completed_at || p[0], updated_at: p[1] }); return { meta: { changes: 1 } }; }
    if (s.startsWith('UPDATE lm2_week_1_foundation SET unable_to_train')) { const r = this.db.tables.lm2_week_1_foundation.find(x => x.student_id === p[5]); Object.assign(r, { unable_to_train: p[0], overeating: p[1], no_motivation: p[2], plan_b_saved_at: p[3], updated_at: p[4] }); return { meta: { changes: 1 } }; }
    return { meta: { changes: 0 } };
  }
  async first() {
    const s = this.sql, p = this.params;
    if (s.startsWith('SELECT id, name, email, plan_type, plan FROM student_access')) return { id: 'student-1', name: 'Student', email: 'student@example.com', plan_type: this.db.plan === 'premium' ? 'PREMIUM' : 'PROJECT_LM', plan: this.db.plan };
    if (s.startsWith('SELECT * FROM lm2_profiles')) return this.db.tables.lm2_profiles.find(x => x.student_id === p[0]) || null;
    if (s.startsWith('SELECT * FROM lm2_journeys')) return this.db.tables.lm2_journeys.find(x => x.student_id === p[0]) || null;
    if (s.startsWith('SELECT * FROM lm2_week_1_foundation')) return this.db.tables.lm2_week_1_foundation.find(x => x.student_id === p[0]) || null;
    return null;
  }
  async all() { return { results: [] }; }
}
