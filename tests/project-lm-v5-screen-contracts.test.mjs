import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const sourcePath = 'public/assets/js/project-lm-v5-screen-contracts.js';
const source = await readFile(sourcePath, 'utf8');

function createModule() {
  const context = {};
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(source, context, { filename: 'project-lm-v5-screen-contracts.js' });
  return context.ProjectLmV5ScreenContracts;
}

function sampleState(overrides = {}) {
  const state = {
    journey: { id: 'journey-1', status: 'active', current_stage: 2 },
    progress: { current_stage: 2, status: 'active', percentage: 25, next_required_action: 'fill_plan_b' },
    stages: {
      stage_1: { key: 'stage_1', status: 'completed' },
      stage_2: { key: 'stage_2', status: 'active' },
      stage_3: { key: 'stage_3', status: 'locked' },
      stage_4: { key: 'stage_4', status: 'locked' },
      maintenance: { key: 'maintenance', status: 'locked' }
    },
    view_model: { primary_cta: { label: 'Construir Plano B', action: 'open_plan_b' } },
    loading: false,
    saving: false,
    error: null,
    last_error_code: null
  };

  return {
    ...state,
    ...overrides,
    stages: { ...state.stages, ...(overrides.stages || {}) },
    progress: { ...state.progress, ...(overrides.progress || {}) },
    view_model: { ...state.view_model, ...(overrides.view_model || {}) }
  };
}

const contracts = createModule();

const expectedRoutes = {
  journey_overview: '#project-lm/journey',
  stage_1_actions: '#project-lm/stage-1-actions',
  stage_2_plan_b: '#project-lm/plan-b',
  stage_3_victories: '#project-lm/victories',
  stage_4_recovery: '#project-lm/recovery',
  maintenance_goals: '#project-lm/maintenance-goals'
};

test('exposes all official screens with the correct routes', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(contracts.screens.map((screen) => screen.key))), Object.keys(expectedRoutes));
  for (const [screenKey, route] of Object.entries(expectedRoutes)) {
    assert.equal(contracts.getScreenByKey(screenKey).route, route);
  }
});

test('maps Stage to Screen correctly', () => {
  assert.equal(contracts.getScreenForStage('stage_1').key, 'stage_1_actions');
  assert.equal(contracts.getScreenForStage('stage_2').key, 'stage_2_plan_b');
  assert.equal(contracts.getScreenForStage('stage_3').key, 'stage_3_victories');
  assert.equal(contracts.getScreenForStage('stage_4').key, 'stage_4_recovery');
  assert.equal(contracts.getScreenForStage('maintenance').key, 'maintenance_goals');
});

test('maps Next Required Action to Screen correctly and returns null for unknown actions', () => {
  assert.equal(contracts.getScreenForNextRequiredAction('choose_stage_1_actions').key, 'stage_1_actions');
  assert.equal(contracts.getScreenForNextRequiredAction('complete_stage_1_actions').key, 'stage_1_actions');
  assert.equal(contracts.getScreenForNextRequiredAction('fill_plan_b').key, 'stage_2_plan_b');
  assert.equal(contracts.getScreenForNextRequiredAction('record_victories').key, 'stage_3_victories');
  assert.equal(contracts.getScreenForNextRequiredAction('fill_recovery_protocols').key, 'stage_4_recovery');
  assert.equal(contracts.getScreenForNextRequiredAction('maintenance').key, 'maintenance_goals');
  assert.equal(contracts.getScreenForNextRequiredAction('unknown_next_action'), null);
});

test('maps CTA Action to Flow correctly and returns null for unknown actions', () => {
  assert.equal(contracts.getFlowForAction('open_stage_1_actions').key, 'stage_1_actions');
  assert.equal(contracts.getFlowForAction('open_plan_b').key, 'stage_2_plan_b');
  assert.equal(contracts.getFlowForAction('open_victories').key, 'stage_3_victories');
  assert.equal(contracts.getFlowForAction('open_recovery_protocols').key, 'stage_4_recovery');
  assert.equal(contracts.getFlowForAction('open_maintenance_goals').key, 'maintenance_goals');
  assert.equal(contracts.getFlowForAction('unknown_action'), null);
});

test('buildScreenState returns loading and error states', () => {
  const loading = contracts.buildScreenState('stage_2_plan_b', sampleState({ loading: true }));
  assert.equal(loading.status, 'loading');
  assert.equal(loading.can_submit, false);
  assert.equal(loading.message, 'Carregando sua jornada.');

  const error = contracts.buildScreenState('stage_2_plan_b', sampleState({ error: 'Falha' }));
  assert.equal(error.status, 'error');
  assert.equal(error.can_access, false);
  assert.equal(error.message, 'Não foi possível carregar esta etapa agora.');
});

test('journey_overview has no required status and is always accessible', () => {
  assert.equal(contracts.getScreenByKey('journey_overview').required_status, null);
  const state = contracts.buildScreenState('journey_overview', sampleState({ loading: true, error: 'Falha' }));
  assert.equal(state.can_access, true);
});

test('buildScreenState current screen resolution prioritizes next action, CTA fallback and active stage fallback', () => {
  const nextActionState = sampleState({
    progress: { next_required_action: 'record_victories' },
    view_model: { primary_cta: { label: 'Construir Plano B', action: 'open_plan_b' } },
    stages: { stage_3: { key: 'stage_3', status: 'active' } }
  });
  assert.equal(contracts.buildScreenState('stage_3_victories', nextActionState).is_current, true);
  assert.equal(contracts.buildScreenState('stage_2_plan_b', nextActionState).is_current, false);

  const ctaFallbackState = sampleState({
    progress: { next_required_action: 'unknown_next_action' },
    view_model: { primary_cta: { label: 'Protocolos', action: 'open_recovery_protocols' } },
    stages: { stage_4: { key: 'stage_4', status: 'active' } }
  });
  assert.equal(contracts.buildScreenState('stage_4_recovery', ctaFallbackState).is_current, true);

  const activeStageFallbackState = sampleState({
    progress: { next_required_action: 'unknown_next_action' },
    view_model: { primary_cta: { label: 'Desconhecido', action: 'unknown_cta_action' } },
    stages: { stage_2: { key: 'stage_2', status: 'locked' }, stage_3: { key: 'stage_3', status: 'active' } }
  });
  assert.equal(contracts.buildScreenState('stage_3_victories', activeStageFallbackState).is_current, true);
});

test('buildScreenState reflects locked, active and completed stage access', () => {
  const locked = contracts.buildScreenState('stage_3_victories', sampleState());
  assert.equal(locked.status, 'locked');
  assert.equal(locked.can_access, false);

  const active = contracts.buildScreenState('stage_2_plan_b', sampleState());
  assert.equal(active.status, 'active');
  assert.equal(active.can_access, true);
  assert.equal(active.is_current, true);

  const completed = contracts.buildScreenState('stage_1_actions', sampleState());
  assert.equal(completed.status, 'completed');
  assert.equal(completed.can_access, true);
});

test('maintenance active returns maintenance status', () => {
  const state = sampleState({ stages: { maintenance: { key: 'maintenance', status: 'active' } } });
  const screenState = contracts.buildScreenState('maintenance_goals', state);
  assert.equal(screenState.status, 'maintenance');
  assert.equal(screenState.can_access, true);
});

test('can_submit is false during loading or saving', () => {
  assert.equal(contracts.buildScreenState('stage_2_plan_b', sampleState({ loading: true })).can_submit, false);
  assert.equal(contracts.buildScreenState('stage_2_plan_b', sampleState({ saving: true })).can_submit, false);
});

test('form contracts contain required fields', () => {
  const screensWithForms = contracts.screens.filter((screen) => screen.form_contract);
  assert.equal(screensWithForms.length, 5);
  for (const screen of screensWithForms) {
    assert.ok(screen.form_contract.type);
    assert.ok(screen.form_contract.submit_action);
    assert.ok(screen.form_contract.fields.length > 0);
    for (const field of screen.form_contract.fields) {
      assert.ok(field.name);
      assert.ok(field.label);
      assert.match(field.type, /^(text|textarea)$/);
      assert.equal(field.required, true);
      assert.ok(field.placeholder);
    }
  }
});

test('action contracts contain success and fallback messages', () => {
  const actionKeys = contracts.actions.map((action) => action.key);
  assert.deepEqual(JSON.parse(JSON.stringify(actionKeys)), ['createStage1Actions', 'completeStage1Action', 'savePlanB', 'createVictory', 'saveRecovery', 'createMaintenanceGoal']);
  for (const action of contracts.actions) {
    assert.equal(action.state_action, action.key);
    assert.ok(action.success_message);
    assert.ok(action.error_fallback);
  }
});

test('screen contracts source does not contain forbidden browser/API operations', () => {
  assert.equal(source.includes('document.querySelector'), false);
  assert.equal(source.includes('innerHTML'), false);
  assert.equal(source.includes('addEventListener'), false);
  assert.equal(source.includes('fetch'), false);
});
