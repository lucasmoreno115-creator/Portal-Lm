import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/api.js';

const apiSource = await readFile('workers/api.js', 'utf8');
const migration = await readFile('migrations/0018_project_lm_v5_foundation.sql', 'utf8');

const requiredTables = [
  'project_lm_journeys',
  'project_lm_stage1_actions',
  'project_lm_plan_b',
  'project_lm_victories',
  'project_lm_recovery_protocols',
  'project_lm_maintenance_goals'
];

const requiredEndpoints = [
  '/api/project-lm/journey',
  '/api/project-lm/stage-1/actions',
  '/api/project-lm/plan-b',
  '/api/project-lm/victories',
  '/api/project-lm/recovery',
  '/api/project-lm/maintenance-goals'
];

test('V5 foundation migration creates the specified Project LM tables and constraints', () => {
  for (const table of requiredTables) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }

  assert.match(migration, /status TEXT NOT NULL DEFAULT 'active' CHECK \(status IN \('active', 'maintenance'\)\)/);
  assert.match(migration, /current_stage INTEGER NOT NULL DEFAULT 1 CHECK \(current_stage BETWEEN 1 AND 4\)/);
  assert.match(migration, /FOREIGN KEY \(journey_id\) REFERENCES project_lm_journeys\(id\) ON DELETE CASCADE/);
  assert.match(migration, /journey_id TEXT NOT NULL UNIQUE/);
});

test('V5 foundation endpoints are declared in the isolated namespace', () => {
  for (const endpoint of requiredEndpoints) {
    assert.match(apiSource, new RegExp(endpoint.replaceAll('/', '\\/')));
  }

  assert.match(apiSource, /stage-1\\\/actions\\\/\(\[\^\/\]\+\)\\\/complete/);
});

test('V5 code is isolated from legacy Project LM flows', () => {
  assert.match(apiSource, /Projeto LM V5 foundation: isolated from legacy library, weekly missions, current mission, streak, hard day mode, and consistency flows/);
  assert.doesNotMatch(apiSource, /projectLmV5[A-Za-z0-9_]*\([^)]*getProjectLmLibrary/);
  assert.doesNotMatch(apiSource, /projectLmV5[A-Za-z0-9_]*\([^)]*getProjectLmCurrentMission/);
  assert.doesNotMatch(apiSource, /projectLmV5[A-Za-z0-9_]*\([^)]*getProjectLmConsistency/);
});

test('V5 happy path progresses from stage 1 to maintenance', async () => {
  const db = new FakeD1('projeto_lm');

  const initial = await api(db, 'GET', '/api/project-lm/journey');
  assert.equal(initial.status, 200);
  assert.equal(initial.body.data.current_stage, 1);
  assert.equal(initial.body.data.status, 'active');

  const stage1 = await api(db, 'POST', '/api/project-lm/stage-1/actions', {
    actions: [{ title: 'Água' }, { title: 'Caminhar' }, { title: 'Proteína' }]
  });
  assert.equal(stage1.status, 201);
  assert.equal(stage1.body.data.actions.length, 3);
  assert.equal(db.tables.project_lm_stage1_actions.length, 3);
  assert.equal(db.batchCalls, 1);

  for (const action of stage1.body.data.actions) {
    const completed = await api(db, 'POST', `/api/project-lm/stage-1/actions/${action.id}/complete`);
    assert.equal(completed.status, 200);
  }
  assert.equal((await api(db, 'GET', '/api/project-lm/journey')).body.data.current_stage, 2);

  const planB = await api(db, 'POST', '/api/project-lm/plan-b', {
    emergency_meal: 'Ovos e fruta',
    minimum_workout: '10 minutos',
    minimum_movement: 'Caminhada curta',
    minimum_self_care: 'Dormir mais cedo'
  });
  assert.equal(planB.status, 200);
  assert.equal(planB.body.data.current_stage, 3);

  for (let index = 1; index <= 7; index += 1) {
    const victory = await api(db, 'POST', '/api/project-lm/victories', { description: `Vitória ${index}` });
    assert.equal(victory.status, 201);
  }
  assert.equal((await api(db, 'GET', '/api/project-lm/journey')).body.data.current_stage, 4);

  const recovery = await api(db, 'POST', '/api/project-lm/recovery', {
    overeating: 'Voltar na próxima refeição',
    missed_workout: 'Fazer treino mínimo',
    travel: 'Priorizar proteína',
    difficult_week: 'Reduzir meta sem zerar',
    lack_of_motivation: 'Executar ação mínima'
  });
  assert.equal(recovery.status, 200);
  assert.equal(recovery.body.data.status, 'maintenance');

  const goal = await api(db, 'POST', '/api/project-lm/maintenance-goals', { goal: 'Manter 3 ações mínimas por semana' });
  assert.equal(goal.status, 201);
  assert.equal(goal.body.data.maintenance_goals.length, 1);
});

test('V5 blocks future resources, invalid Stage 1 sizes and Premium users', async () => {
  const db = new FakeD1('projeto_lm');

  assert.equal((await api(db, 'POST', '/api/project-lm/plan-b', {
    emergency_meal: 'x', minimum_workout: 'x', minimum_movement: 'x', minimum_self_care: 'x'
  })).status, 403);
  assert.equal((await api(db, 'POST', '/api/project-lm/victories', { description: 'x' })).status, 403);
  assert.equal((await api(db, 'POST', '/api/project-lm/recovery', {
    overeating: 'x', missed_workout: 'x', travel: 'x', difficult_week: 'x', lack_of_motivation: 'x'
  })).status, 403);
  assert.equal((await api(db, 'POST', '/api/project-lm/maintenance-goals', { goal: 'x' })).status, 403);

  assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: 'Duas' }] })).status, 400);
  assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: 'Duas' }, { title: 'Três' }, { title: 'Quatro' }] })).status, 400);
  assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: '   ' }, { title: 'Três' }] })).status, 400);

  const premiumDb = new FakeD1('premium');
  assert.equal((await api(premiumDb, 'GET', '/api/project-lm/journey')).status, 403);
});

async function api(db, method, pathname, body) {
  const request = new Request(`https://portal.test${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-student-email': 'student@example.com',
      'x-student-token': 'token'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const response = await worker.fetch(request, { DB: db });
  return { status: response.status, body: await response.json() };
}

class FakeD1 {
  constructor(plan) {
    this.plan = plan;
    this.batchCalls = 0;
    this.tables = {
      project_lm_journeys: [],
      project_lm_stage1_actions: [],
      project_lm_plan_b: [],
      project_lm_victories: [],
      project_lm_recovery_protocols: [],
      project_lm_maintenance_goals: []
    };
  }

  prepare(sql) {
    return new FakeD1Statement(this, sql);
  }

  async batch(statements) {
    this.batchCalls += 1;
    const snapshot = structuredClone(this.tables);
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    } catch (error) {
      this.tables = snapshot;
      throw error;
    }
  }
}

class FakeD1Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, ' ').trim();
    this.params = params;
  }

  bind(...params) {
    return new FakeD1Statement(this.db, this.sql, params);
  }

  async run() {
    const sql = this.sql;
    const p = this.params;
    if (/^(CREATE|ALTER|DROP) /i.test(sql) || /^CREATE (UNIQUE )?INDEX/i.test(sql) || /^INSERT OR IGNORE INTO project_lm_/i.test(sql)) return { meta: { changes: 0 } };

    if (sql.startsWith('INSERT INTO project_lm_journeys')) {
      this.db.tables.project_lm_journeys.push({ id: p[0], student_id: p[1], student_email: p[2], status: 'active', current_stage: 1, stage_2_unlocked_at: null, stage_3_unlocked_at: null, stage_4_unlocked_at: null, maintenance_started_at: null, created_at: p[3], updated_at: p[4] });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO project_lm_stage1_actions')) {
      this.db.tables.project_lm_stage1_actions.push({ id: p[0], journey_id: p[1], student_id: p[2], student_email: p[3], title: p[4], completed: 0, completed_at: null, created_at: p[5], updated_at: p[6] });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE project_lm_stage1_actions')) {
      const row = this.db.tables.project_lm_stage1_actions.find((item) => item.id === p[2]);
      if (row) Object.assign(row, { completed: 1, completed_at: row.completed_at || p[0], updated_at: p[1] });
      return { meta: { changes: row ? 1 : 0 } };
    }
    if (sql.startsWith('UPDATE project_lm_journeys')) {
      const row = this.db.tables.project_lm_journeys.find((item) => item.id === p[7]);
      if (row) {
        row.current_stage = p[0];
        row.status = p[1] || row.status;
        row.stage_2_unlocked_at ||= p[2];
        row.stage_3_unlocked_at ||= p[3];
        row.stage_4_unlocked_at ||= p[4];
        row.maintenance_started_at ||= p[5];
        row.updated_at = p[6];
      }
      return { meta: { changes: row ? 1 : 0 } };
    }
    if (sql.startsWith('INSERT INTO project_lm_plan_b')) {
      this.db.tables.project_lm_plan_b.push({ id: p[0], journey_id: p[1], student_id: p[2], student_email: p[3], emergency_meal: p[4], minimum_workout: p[5], minimum_movement: p[6], minimum_self_care: p[7], created_at: p[8], updated_at: p[9] });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE project_lm_plan_b')) {
      const row = this.db.tables.project_lm_plan_b.find((item) => item.id === p[5]);
      if (row) Object.assign(row, { emergency_meal: p[0], minimum_workout: p[1], minimum_movement: p[2], minimum_self_care: p[3], updated_at: p[4] });
      return { meta: { changes: row ? 1 : 0 } };
    }
    if (sql.startsWith('INSERT INTO project_lm_victories')) {
      this.db.tables.project_lm_victories.push({ id: p[0], journey_id: p[1], student_id: p[2], student_email: p[3], description: p[4], created_at: p[5] });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO project_lm_recovery_protocols')) {
      this.db.tables.project_lm_recovery_protocols.push({ id: p[0], journey_id: p[1], student_id: p[2], student_email: p[3], overeating: p[4], missed_workout: p[5], travel: p[6], difficult_week: p[7], lack_of_motivation: p[8], created_at: p[9], updated_at: p[10] });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE project_lm_recovery_protocols')) {
      const row = this.db.tables.project_lm_recovery_protocols.find((item) => item.id === p[6]);
      if (row) Object.assign(row, { overeating: p[0], missed_workout: p[1], travel: p[2], difficult_week: p[3], lack_of_motivation: p[4], updated_at: p[5] });
      return { meta: { changes: row ? 1 : 0 } };
    }
    if (sql.startsWith('INSERT INTO project_lm_maintenance_goals')) {
      this.db.tables.project_lm_maintenance_goals.push({ id: p[0], journey_id: p[1], student_id: p[2], student_email: p[3], goal: p[4], created_at: p[5], updated_at: p[6] });
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  }

  async first() {
    const sql = this.sql;
    const p = this.params;
    if (sql.startsWith('SELECT id, name, email, plan_type, plan FROM student_access')) return { id: 'student-1', name: 'Student', email: 'student@example.com', plan_type: this.db.plan === 'premium' ? 'PREMIUM' : 'PROJECT_LM', plan: this.db.plan };
    if (sql.startsWith('SELECT * FROM project_lm_journeys')) return this.db.tables.project_lm_journeys.find((item) => item.student_id === p[0]) || null;
    if (sql.startsWith('SELECT id, emergency_meal')) return this.db.tables.project_lm_plan_b.find((item) => item.journey_id === p[0]) || null;
    if (sql.startsWith('SELECT id, overeating')) return this.db.tables.project_lm_recovery_protocols.find((item) => item.journey_id === p[0]) || null;
    if (sql.startsWith('SELECT COUNT(*) AS total FROM project_lm_stage1_actions WHERE journey_id=? AND completed=1')) return { total: this.db.tables.project_lm_stage1_actions.filter((item) => item.journey_id === p[0] && item.completed === 1).length };
    if (sql.startsWith('SELECT COUNT(*) AS total FROM project_lm_stage1_actions')) return { total: this.db.tables.project_lm_stage1_actions.filter((item) => item.journey_id === p[0]).length };
    if (sql.startsWith('SELECT COUNT(*) AS total FROM project_lm_victories')) return { total: this.db.tables.project_lm_victories.filter((item) => item.journey_id === p[0]).length };
    if (sql.startsWith('SELECT id FROM project_lm_stage1_actions')) return this.db.tables.project_lm_stage1_actions.find((item) => item.id === p[0] && item.journey_id === p[1]) || null;
    if (sql.startsWith('SELECT id FROM project_lm_plan_b')) return this.db.tables.project_lm_plan_b.find((item) => item.journey_id === p[0]) || null;
    if (sql.startsWith('SELECT id FROM project_lm_recovery_protocols')) return this.db.tables.project_lm_recovery_protocols.find((item) => item.journey_id === p[0]) || null;
    return null;
  }

  async all() {
    const sql = this.sql;
    const p = this.params;
    if (sql.startsWith('SELECT id, title, completed')) return { results: this.db.tables.project_lm_stage1_actions.filter((item) => item.journey_id === p[0]) };
    if (sql.startsWith('SELECT id, description')) return { results: this.db.tables.project_lm_victories.filter((item) => item.journey_id === p[0]) };
    if (sql.startsWith('SELECT id, goal')) return { results: this.db.tables.project_lm_maintenance_goals.filter((item) => item.journey_id === p[0]).toReversed() };
    return { results: [] };
  }
}
