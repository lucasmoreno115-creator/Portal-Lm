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
  assert.equal(initial.body.data.journey.current_stage, 1);
  assert.equal(initial.body.data.journey.status, 'active');

  const stage1 = await api(db, 'POST', '/api/project-lm/stage-1/actions', {
    actions: [{ title: 'Água' }, { title: 'Caminhar' }, { title: 'Proteína' }]
  });
  assert.equal(stage1.status, 201);
  assert.equal(stage1.body.data.stages.stage_1.items.length, 3);
  assert.equal(db.tables.project_lm_stage1_actions.length, 3);
  assert.equal(db.batchCalls, 1);

  for (const action of stage1.body.data.stages.stage_1.items) {
    const completed = await api(db, 'POST', `/api/project-lm/stage-1/actions/${action.id}/complete`);
    assert.equal(completed.status, 200);
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

  const goal = await api(db, 'POST', '/api/project-lm/maintenance-goals', { goal: 'Manter 3 ações mínimas por semana' });
  assert.equal(goal.status, 201);
  assert.equal(goal.body.data.stages.maintenance.items.length, 1);
});

test('V5 journey contract exposes frontend-ready shape, progress, statuses and next action', async () => {
  const db = new FakeD1('projeto_lm');

  const initial = await api(db, 'GET', '/api/project-lm/journey');
  assert.deepEqual(Object.keys(initial.body.data), ['journey', 'progress', 'stages', 'view_model']);
  assert.equal(initial.body.data.progress.percentage, 0);
  assert.equal(initial.body.data.progress.next_required_action, 'choose_stage_1_actions');
  assert.deepEqual(initial.body.data.progress.locked_stages, [2, 3, 4]);
  assert.ok(initial.body.data.progress.locked_stages.every((stage) => Number.isInteger(stage)));
  assert.ok(!initial.body.data.progress.locked_stages.includes('maintenance'));
  assert.equal(initial.body.data.stages.stage_1.status, 'active');
  assert.equal(initial.body.data.stages.stage_2.status, 'locked');
  assert.equal(initial.body.data.stages.maintenance.status, 'locked');
  assert.equal(initial.body.data.view_model.status_label, 'Jornada em andamento');
  assert.equal(initial.body.data.view_model.progress_label, 'Você está no começo da jornada.');
  assert.equal(initial.body.data.view_model.primary_message, 'Escolha 3 ações simples que você consegue fazer mesmo em dias difíceis.');
  assert.deepEqual(initial.body.data.view_model.primary_cta, { label: 'Escolher minhas 3 ações', action: 'open_stage_1_actions' });
  assert.deepEqual(initial.body.data.view_model.stage_cards.map((card) => card.key), ['stage_1', 'stage_2', 'stage_3', 'stage_4', 'maintenance']);
  assert.equal(initial.body.data.view_model.stage_cards[0].status, 'active');
  assert.equal(initial.body.data.view_model.stage_cards[0].status_label, 'Em andamento');
  assert.deepEqual(initial.body.data.view_model.stage_cards[0].cta, { label: 'Concluir ações mínimas', action: 'open_stage_1_actions' });
  assert.equal(initial.body.data.view_model.stage_cards[0].progress_text, '0/3 ações concluídas');
  assert.equal(initial.body.data.view_model.stage_cards[0].empty_state, 'Você ainda não escolheu suas 3 ações mínimas.');
  assert.equal(initial.body.data.view_model.stage_cards[1].cta, null);
  assert.equal(initial.body.data.view_model.stage_cards[2].empty_state, 'Você ainda não registrou vitórias.');
  assert.equal(initial.body.data.view_model.stage_cards[4].cta, null);
  assert.equal(initial.body.data.view_model.stage_cards[4].empty_state, 'Você ainda não definiu metas de manutenção.');
  assert.equal(initial.body.data.view_model.stage_cards[4].progress_text, '0 metas de manutenção');

  const stage1 = await api(db, 'POST', '/api/project-lm/stage-1/actions', {
    actions: [{ title: 'Água' }, { title: 'Caminhar' }, { title: 'Proteína' }]
  });
  assert.equal(stage1.body.data.progress.next_required_action, 'complete_stage_1_actions');
  assert.equal(stage1.body.data.progress.percentage, 0);
  assert.equal(stage1.body.data.view_model.primary_message, 'Agora conclua suas 3 ações mínimas para desbloquear o próximo passo.');
  assert.deepEqual(stage1.body.data.view_model.primary_cta, { label: 'Concluir ações mínimas', action: 'open_stage_1_actions' });
  assert.equal(stage1.body.data.view_model.stage_cards[0].empty_state, null);
  assert.deepEqual(Object.keys(stage1.body.data), ['journey', 'progress', 'stages', 'view_model']);

  const firstCompleted = await api(db, 'POST', `/api/project-lm/stage-1/actions/${stage1.body.data.stages.stage_1.items[0].id}/complete`);
  assert.equal(firstCompleted.body.data.progress.percentage, 10);
  assert.equal(firstCompleted.body.data.view_model.progress_label, 'Você já iniciou sua base de continuidade.');
  const secondCompleted = await api(db, 'POST', `/api/project-lm/stage-1/actions/${stage1.body.data.stages.stage_1.items[1].id}/complete`);
  assert.equal(secondCompleted.body.data.progress.percentage, 20);
  const stage2 = await api(db, 'POST', `/api/project-lm/stage-1/actions/${stage1.body.data.stages.stage_1.items[2].id}/complete`);
  assert.equal(stage2.body.data.progress.percentage, 25);
  assert.equal(stage2.body.data.progress.next_required_action, 'fill_plan_b');
  assert.equal(stage2.body.data.view_model.progress_label, 'Você desbloqueou seu Plano B.');
  assert.deepEqual(stage2.body.data.view_model.primary_cta, { label: 'Construir meu Plano B', action: 'open_plan_b' });
  assert.equal(stage2.body.data.stages.stage_1.status, 'completed');
  assert.equal(stage2.body.data.view_model.stage_cards[0].cta, null);
  assert.equal(stage2.body.data.stages.stage_2.status, 'active');
  assert.deepEqual(stage2.body.data.view_model.stage_cards[1].cta, { label: 'Construir meu Plano B', action: 'open_plan_b' });
  assert.ok(!stage2.body.data.progress.locked_stages.includes('maintenance'));

  const stage3 = await api(db, 'POST', '/api/project-lm/plan-b', {
    emergency_meal: 'Ovos e fruta',
    minimum_workout: '10 minutos',
    minimum_movement: 'Caminhada curta',
    minimum_self_care: 'Dormir mais cedo'
  });
  assert.equal(stage3.body.data.progress.percentage, 50);
  assert.equal(stage3.body.data.progress.next_required_action, 'record_victories');
  assert.equal(stage3.body.data.view_model.progress_label, 'Você está acumulando vitórias reais.');
  assert.deepEqual(stage3.body.data.view_model.primary_cta, { label: 'Registrar uma vitória', action: 'open_victories' });
  assert.equal(stage3.body.data.view_model.stage_cards[1].progress_text, '4/4 campos preenchidos');
  assert.equal(stage3.body.data.stages.stage_2.status, 'completed');
  assert.equal(stage3.body.data.stages.stage_3.status, 'active');
  assert.ok(!stage3.body.data.progress.locked_stages.includes('maintenance'));

  const oneVictory = await api(db, 'POST', '/api/project-lm/victories', { description: 'Vitória 1' });
  assert.ok(oneVictory.body.data.progress.percentage > 50);
  assert.ok(oneVictory.body.data.progress.percentage < 75);
  for (let index = 2; index <= 7; index += 1) await api(db, 'POST', '/api/project-lm/victories', { description: `Vitória ${index}` });
  const stage4 = await api(db, 'GET', '/api/project-lm/journey');
  assert.equal(stage4.body.data.progress.percentage, 75);
  assert.equal(stage4.body.data.progress.next_required_action, 'fill_recovery_protocols');
  assert.equal(stage4.body.data.view_model.progress_label, 'Você está preparando seus protocolos de recuperação.');
  assert.deepEqual(stage4.body.data.view_model.primary_cta, { label: 'Criar protocolos de recuperação', action: 'open_recovery_protocols' });
  assert.equal(stage4.body.data.view_model.stage_cards[2].progress_text, '7/7 vitórias registradas');
  assert.equal(stage4.body.data.stages.stage_3.status, 'completed');
  assert.equal(stage4.body.data.view_model.stage_cards[2].cta, null);
  assert.equal(stage4.body.data.stages.stage_4.status, 'active');

  const maintenance = await api(db, 'POST', '/api/project-lm/recovery', {
    overeating: 'Voltar na próxima refeição',
    missed_workout: 'Fazer treino mínimo',
    travel: 'Priorizar proteína',
    difficult_week: 'Reduzir meta sem zerar',
    lack_of_motivation: 'Executar ação mínima'
  });
  assert.equal(maintenance.body.data.progress.percentage, 100);
  assert.equal(maintenance.body.data.progress.next_required_action, 'maintenance');
  assert.equal(maintenance.body.data.view_model.status_label, 'Manutenção ativa');
  assert.equal(maintenance.body.data.view_model.progress_label, 'Você concluiu a jornada e entrou em manutenção.');
  assert.equal(maintenance.body.data.view_model.primary_message, 'Você concluiu a jornada. Agora o foco é manter o que foi construído.');
  assert.deepEqual(maintenance.body.data.view_model.primary_cta, { label: 'Definir meta de manutenção', action: 'open_maintenance_goals' });
  assert.equal(maintenance.body.data.view_model.stage_cards[3].progress_text, '5/5 protocolos criados');
  assert.equal(maintenance.body.data.view_model.stage_cards[3].cta, null);
  assert.equal(maintenance.body.data.view_model.stage_cards[4].status, 'active');
  assert.deepEqual(maintenance.body.data.view_model.stage_cards[4].cta, { label: 'Definir meta de manutenção', action: 'open_maintenance_goals' });
  assert.equal(maintenance.body.data.view_model.stage_cards[4].progress_text, '0 metas de manutenção');
  assert.equal(maintenance.body.data.stages.stage_4.status, 'completed');
  assert.equal(maintenance.body.data.stages.maintenance.status, 'active');
  assert.deepEqual(maintenance.body.data.progress.locked_stages, []);

  const firstGoal = await api(db, 'POST', '/api/project-lm/maintenance-goals', { goal: 'Manter 3 ações mínimas por semana' });
  assert.equal(firstGoal.body.data.view_model.stage_cards[4].progress_text, '1 meta de manutenção');
  const secondGoal = await api(db, 'POST', '/api/project-lm/maintenance-goals', { goal: 'Revisar Plano B quinzenalmente' });
  assert.equal(secondGoal.body.data.view_model.stage_cards[4].progress_text, '2 metas de manutenção');
});

test('V5 blocks future resources, invalid Stage 1 sizes and Premium users', async () => {
  const db = new FakeD1('projeto_lm');

  const lockedPlanB = await api(db, 'POST', '/api/project-lm/plan-b', {
    emergency_meal: 'x', minimum_workout: 'x', minimum_movement: 'x', minimum_self_care: 'x'
  });
  assert.equal(lockedPlanB.status, 403);
  assert.deepEqual(Object.keys(lockedPlanB.body), ['ok', 'error', 'code']);
  assert.equal(lockedPlanB.body.ok, false);
  assert.equal(lockedPlanB.body.code, 'PLAN_B_STAGE_LOCKED');
  assert.equal((await api(db, 'POST', '/api/project-lm/victories', { description: 'x' })).status, 403);
  assert.equal((await api(db, 'POST', '/api/project-lm/recovery', {
    overeating: 'x', missed_workout: 'x', travel: 'x', difficult_week: 'x', lack_of_motivation: 'x'
  })).status, 403);
  assert.equal((await api(db, 'POST', '/api/project-lm/maintenance-goals', { goal: 'x' })).status, 403);

  assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: 'Duas' }] })).status, 400);
  assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: 'Duas' }, { title: 'Três' }, { title: 'Quatro' }] })).status, 400);
  assert.equal((await api(db, 'POST', '/api/project-lm/stage-1/actions', { actions: [{ title: 'Uma' }, { title: '   ' }, { title: 'Três' }] })).status, 400);

  const premiumDb = new FakeD1('premium');
  const premium = await api(premiumDb, 'GET', '/api/project-lm/journey');
  assert.equal(premium.status, 403);
  assert.equal(premium.body.code, 'PROJECT_LM_ONLY');
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
