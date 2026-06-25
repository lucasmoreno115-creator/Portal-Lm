import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/api.js';

const migrationSql = await readFile('migrations/0018_project_lm_v5_foundation.sql', 'utf8');
const apiSource = await readFile('workers/api.js', 'utf8');
const requiredTables = [
  'project_lm_journeys',
  'project_lm_stage1_actions',
  'project_lm_plan_b',
  'project_lm_victories',
  'project_lm_recovery_protocols',
  'project_lm_maintenance_goals'
];

for (const table of requiredTables) {
  test(`official V5 migration creates ${table}`, async () => {
    await withMigratedDb(async (db) => {
      const row = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first();
      assert.equal(row?.name, table);
    });
  });
}

test('V5 tables are not created redundantly by ensureSchema', () => {
  for (const table of requiredTables) {
    assert.doesNotMatch(apiSource, new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\b`));
  }
});

test('V5 happy path applies migration and progresses from stage 1 to maintenance', async () => {
  await withMigratedDb(async (db) => {
    await seedStudent(db, { plan: 'projeto_lm', planType: 'PROJECT_LM' });

    const initial = await api(db, 'GET', '/api/project-lm/journey');
    assert.equal(initial.status, 200);
    assert.equal(initial.body.data.journey.status, 'active');
    assert.equal(initial.body.data.journey.current_stage, 1);

    const stage1 = await api(db, 'POST', '/api/project-lm/stage-1/actions', {
      actions: [{ title: 'Água' }, { title: 'Caminhar' }, { title: 'Proteína' }]
    });
    assert.equal(stage1.status, 201);
    assert.equal(stage1.body.data.stages.stage_1.items.length, 3);

    for (const action of stage1.body.data.stages.stage_1.items) {
      assert.equal((await api(db, 'POST', `/api/project-lm/stage-1/actions/${action.id}/complete`)).status, 200);
    }
    assert.equal((await api(db, 'GET', '/api/project-lm/journey')).body.data.journey.current_stage, 2);

    const planB = await api(db, 'POST', '/api/project-lm/plan-b', {
      emergency_meal: 'Ovos e fruta',
      minimum_workout: '10 minutos',
      minimum_movement: 'Caminhada curta',
      minimum_self_care: 'Dormir mais cedo'
    });
    assert.equal(planB.status, 200);
    assert.equal(planB.body.data.journey.current_stage, 3);

    for (let index = 1; index <= 7; index += 1) {
      const victory = await api(db, 'POST', '/api/project-lm/victories', { description: `Vitória ${index}` });
      assert.equal(victory.status, 201);
    }
    assert.equal((await api(db, 'GET', '/api/project-lm/journey')).body.data.journey.current_stage, 4);

    const recovery = await api(db, 'POST', '/api/project-lm/recovery', {
      overeating: 'Voltar na próxima refeição',
      missed_workout: 'Fazer treino mínimo',
      travel: 'Priorizar proteína',
      difficult_week: 'Reduzir meta sem zerar',
      lack_of_motivation: 'Executar ação mínima'
    });
    assert.equal(recovery.status, 200);
    assert.equal(recovery.body.data.journey.status, 'maintenance');
    assert.ok(recovery.body.data.journey.maintenance_started_at);

    const goal = await api(db, 'POST', '/api/project-lm/maintenance-goals', { goal: 'Manter 3 ações mínimas por semana' });
    assert.equal(goal.status, 201);
    assert.equal(goal.body.data.stages.maintenance.items[0].goal, 'Manter 3 ações mínimas por semana');

    await assertDbIntegrity(db, recovery.body.data.journey.id);
  });
});

test('V5 progression blockers reject invalid order and duplicate submissions', async () => {
  await withMigratedDb(async (db) => {
    await seedStudent(db, { plan: 'projeto_lm', planType: 'PROJECT_LM' });

    assert.equal((await postPlanB(db)).status, 403);
    assert.equal((await postVictory(db, 'cedo')).status, 403);
    assert.equal((await postRecovery(db)).status, 403);
    assert.equal((await api(db, 'POST', '/api/project-lm/maintenance-goals', { goal: 'cedo' })).status, 403);

    assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: 'Duas' }] })).status, 400);
    assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: 'Duas' }, { title: 'Três' }, { title: 'Quatro' }] })).status, 400);
    assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: '   ' }, { title: 'Três' }] })).status, 400);

    const stage1 = await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: 'Duas' }, { title: 'Três' }] });
    assert.equal(stage1.status, 201);
    assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] })).status, 409);

    for (const action of stage1.body.data.stages.stage_1.items) await api(db, 'POST', `/api/project-lm/stage-1/actions/${action.id}/complete`);
    assert.equal((await postPlanB(db)).status, 200);
    for (let index = 1; index <= 7; index += 1) assert.equal((await postVictory(db, `Vitória ${index}`)).status, 201);
    assert.equal((await postVictory(db, 'oitava')).status, 403);
    assert.equal((await postRecovery(db)).status, 200);
    assert.equal((await postRecovery(db)).status, 403);
  });
});

test('V5 endpoints are isolated from Premium users', async () => {
  await withMigratedDb(async (db) => {
    await seedStudent(db, { plan: 'premium', planType: 'PREMIUM' });
    const checks = [
      ['GET', '/api/project-lm/journey'],
      ['POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] }],
      ['POST', '/api/project-lm/plan-b', planBBody()],
      ['POST', '/api/project-lm/victories', { description: 'x' }],
      ['POST', '/api/project-lm/recovery', recoveryBody()],
      ['POST', '/api/project-lm/maintenance-goals', { goal: 'x' }]
    ];
    for (const [method, path, body] of checks) assert.equal((await api(db, method, path, body)).status, 403, path);
  });
});

async function withMigratedDb(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'portal-lm-v5-'));
  const file = join(dir, 'test.db');
  try {
    execFileSync('sqlite3', [file], { input: 'PRAGMA foreign_keys=ON;\n' + migrationSql + `\nCREATE TABLE student_access (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  email TEXT NOT NULL UNIQUE,\n  access_token TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'ACTIVE',\n  plan_type TEXT,\n  plan TEXT DEFAULT 'premium',\n  whatsapp TEXT,\n  created_at TEXT NOT NULL\n);` });
    await fn(new SqliteD1(file));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function seedStudent(db, { plan, planType }) {
  await db.prepare(`INSERT INTO student_access (id, name, email, access_token, status, plan_type, plan, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`)
    .bind('student-1', 'Student', 'student@example.com', 'token', planType, plan, new Date().toISOString()).run();
}

async function api(db, method, pathname, body) {
  const response = await worker.fetch(new Request(`https://portal.test${pathname}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-student-email': 'student@example.com', 'x-student-token': 'token' },
    body: body ? JSON.stringify(body) : undefined
  }), { DB: db });
  return { status: response.status, body: await response.json() };
}

const planBBody = () => ({ emergency_meal: 'Ovos', minimum_workout: '10 min', minimum_movement: 'Passos', minimum_self_care: 'Sono' });
const recoveryBody = () => ({ overeating: 'Retomar', missed_workout: 'Mínimo', travel: 'Proteína', difficult_week: 'Reduzir', lack_of_motivation: 'Ação mínima' });
const postPlanB = (db) => api(db, 'POST', '/api/project-lm/plan-b', planBBody());
const postVictory = (db, description) => api(db, 'POST', '/api/project-lm/victories', { description });
const postRecovery = (db) => api(db, 'POST', '/api/project-lm/recovery', recoveryBody());

async function assertDbIntegrity(db, journeyId) {
  assert.equal((await db.prepare('SELECT COUNT(*) total FROM project_lm_journeys WHERE student_id=?').bind('student-1').first()).total, 1);
  assert.equal((await db.prepare('SELECT COUNT(*) total FROM project_lm_plan_b WHERE journey_id=?').bind(journeyId).first()).total, 1);
  assert.equal((await db.prepare('SELECT COUNT(*) total FROM project_lm_recovery_protocols WHERE journey_id=?').bind(journeyId).first()).total, 1);
  assert.equal((await db.prepare('SELECT COUNT(*) total FROM project_lm_journeys WHERE current_stage NOT BETWEEN 1 AND 4').first()).total, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) total FROM project_lm_journeys WHERE status NOT IN ('active', 'maintenance')").first()).total, 0);
  for (const table of ['project_lm_stage1_actions', 'project_lm_victories', 'project_lm_maintenance_goals']) {
    assert.equal((await db.prepare(`SELECT COUNT(*) total FROM ${table} WHERE journey_id<>?`).bind(journeyId).first()).total, 0);
  }
}

class SqliteD1 {
  constructor(file) { this.file = file; }
  prepare(sql) { return new SqliteD1Statement(this.file, sql); }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; }
}

class SqliteD1Statement {
  constructor(file, sql, params = []) { this.file = file; this.sql = sql; this.params = params; }
  bind(...params) { return new SqliteD1Statement(this.file, this.sql, params); }
  async run() { execFileSync('sqlite3', [this.file], { input: render(this.sql, this.params) }); return { meta: { changes: 0 } }; }
  async first() { return (await this.all()).results[0] || null; }
  async all() {
    const output = execFileSync('sqlite3', ['-json', this.file], { input: render(this.sql, this.params) }).toString().trim();
    return { results: output ? JSON.parse(output) : [] };
  }
}

function render(sql, params) {
  let index = 0;
  return 'PRAGMA foreign_keys=ON;\n' + sql.replaceAll('?', () => literal(params[index++])) + ';';
}

function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}
