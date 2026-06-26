import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile('public/assets/js/project-lm-v5-state.js', 'utf8');

function createModule(fetchImpl) {
  const context = {
    console,
    structuredClone,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl,
    localStorage: {
      getItem(key) {
        if (key === 'lm_student_email') return 'student@example.com';
        if (key === 'lm_student_token') return 'token';
        return '';
      }
    }
  };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(source, context, { filename: 'project-lm-v5-state.js' });
  return context;
}

function okResponse(data = sampleContract()) {
  return {
    ok: true,
    async json() {
      return { ok: true, data };
    }
  };
}

function apiErrorResponse(error = 'Falha controlada', code = 'CONTROLLED_ERROR', statusOk = false) {
  return {
    ok: statusOk,
    async json() {
      return { ok: false, error, code };
    }
  };
}

function sampleContract(overrides = {}) {
  const contract = {
    journey: { id: 'journey-1', status: 'active', current_stage: 2 },
    progress: { current_stage: 2, status: 'active', percentage: 25, next_required_action: 'fill_plan_b' },
    stages: {
      stage_1: { key: 'stage_1', status: 'completed' },
      stage_2: { key: 'stage_2', status: 'active' },
      stage_3: { key: 'stage_3', status: 'locked' },
      stage_4: { key: 'stage_4', status: 'locked' },
      maintenance: { key: 'maintenance', status: 'locked' }
    },
    view_model: {
      primary_cta: { label: 'Construir meu Plano B', action: 'open_plan_b' },
      stage_cards: [
        { key: 'stage_1', status: 'completed', cta: null },
        { key: 'stage_2', status: 'active', cta: { label: 'Construir meu Plano B', action: 'open_plan_b' } },
        { key: 'stage_3', status: 'locked', cta: null }
      ]
    }
  };
  return { ...contract, ...overrides };
}

test('Project LM V5 state exposes the initial state and safe subscribe/unsubscribe', () => {
  const { createProjectLmV5State } = createModule(async () => okResponse());
  const store = createProjectLmV5State();

  assert.deepEqual(store.getState(), {
    loading: false,
    saving: false,
    error: null,
    last_error_code: null,
    journey: null,
    progress: null,
    stages: null,
    view_model: null,
    last_updated_at: null
  });

  let calls = 0;
  const unsubscribe = store.subscribe((state) => {
    calls += 1;
    state.loading = true;
  });
  store.subscribe(() => {
    throw new Error('listener failure should not break notify');
  });
  assert.equal(calls, 1);
  assert.equal(store.getState().loading, false);
  unsubscribe();
});

test('loadJourney success normalizes the V5 contract and updates state', async () => {
  const requests = [];
  const { createProjectLmV5State } = createModule(async (path, options) => {
    requests.push({ path, options });
    return okResponse();
  });
  const store = createProjectLmV5State();

  const result = await store.loadJourney();
  const state = store.getState();

  assert.equal(result.ok, true);
  assert.equal(requests[0].path, '/api/project-lm/journey');
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.credentials, 'same-origin');
  assert.equal(requests[0].options.headers['x-student-email'], 'student@example.com');
  assert.equal(state.loading, false);
  assert.equal(state.error, null);
  assert.equal(state.journey.current_stage, 2);
  assert.equal(state.progress.next_required_action, 'fill_plan_b');
  assert.equal(state.view_model.primary_cta.action, 'open_plan_b');
  assert.ok(state.last_updated_at);
});

test('POST actions send JSON payloads and update the official contract', async () => {
  const requests = [];
  const { createProjectLmV5State } = createModule(async (path, options) => {
    requests.push({ path, options });
    return okResponse(sampleContract({ progress: { current_stage: 3, status: 'active', percentage: 50, next_required_action: 'record_victories' } }));
  });
  const store = createProjectLmV5State();

  await store.createStage1Actions([{ title: 'Água' }, { title: 'Caminhar' }, { title: 'Proteína' }]);
  await store.completeStage1Action('action 1');
  await store.savePlanB({ emergency_meal: 'Ovos' });
  await store.createVictory({ description: 'Vitória' });
  await store.saveRecovery({ overeating: 'Voltar' });
  await store.createMaintenanceGoal({ goal: 'Manter' });

  assert.equal(requests[0].path, '/api/project-lm/stage-1/actions');
  assert.equal(JSON.parse(requests[0].options.body).actions.length, 3);
  assert.equal(requests[1].path, '/api/project-lm/stage-1/actions/action%201/complete');
  assert.equal(requests[2].path, '/api/project-lm/plan-b');
  assert.equal(requests[3].path, '/api/project-lm/victories');
  assert.equal(requests[4].path, '/api/project-lm/recovery');
  assert.equal(requests[5].path, '/api/project-lm/maintenance-goals');
  assert.equal(store.getState().progress.next_required_action, 'record_victories');
});

test('API errors set error and last_error_code without throwing raw errors', async () => {
  const { createProjectLmV5State } = createModule(async () => apiErrorResponse('Etapa bloqueada.', 'PLAN_B_STAGE_LOCKED'));
  const store = createProjectLmV5State();

  const result = await store.savePlanB({ emergency_meal: 'Ovos' });

  assert.deepEqual(result, { ok: false, error: 'Etapa bloqueada.', code: 'PLAN_B_STAGE_LOCKED' });
  assert.equal(store.getState().error, 'Etapa bloqueada.');
  assert.equal(store.getState().last_error_code, 'PLAN_B_STAGE_LOCKED');
});

test('invalid contracts and invalid JSON are handled defensively', async () => {
  const invalidContractModule = createModule(async () => okResponse({ journey: {}, progress: {}, stages: {} }));
  const invalidContractStore = invalidContractModule.createProjectLmV5State();
  const invalidContract = await invalidContractStore.loadJourney();
  assert.equal(invalidContract.ok, false);
  assert.equal(invalidContract.code, 'PROJECT_LM_V5_INVALID_CONTRACT');
  assert.equal(invalidContractStore.getState().last_error_code, 'PROJECT_LM_V5_INVALID_CONTRACT');

  const invalidJsonModule = createModule(async () => ({ ok: true, async json() { throw new Error('bad json'); } }));
  const invalidJsonStore = invalidJsonModule.createProjectLmV5State();
  const invalidJson = await invalidJsonStore.loadJourney();
  assert.equal(invalidJson.ok, false);
  assert.equal(invalidJson.code, 'PROJECT_LM_V5_INVALID_JSON');
});

test('network errors and missing action payloads are normalized', async () => {
  const { createProjectLmV5State } = createModule(async () => {
    throw new Error('network down');
  });
  const store = createProjectLmV5State();

  const network = await store.loadJourney();
  assert.equal(network.ok, false);
  assert.equal(network.code, 'PROJECT_LM_V5_NETWORK_ERROR');
  assert.equal(store.getState().last_error_code, 'PROJECT_LM_V5_NETWORK_ERROR');

  const validation = await store.createVictory();
  assert.equal(validation.ok, false);
  assert.equal(validation.code, 'PROJECT_LM_V5_ACTION_VALIDATION_ERROR');
});

test('selectors are pure and return frontend state values', async () => {
  const { createProjectLmV5State } = createModule(async () => okResponse());
  const store = createProjectLmV5State();
  await store.loadJourney();

  const state = store.getState();
  assert.equal(store.selectors.getCurrentStage(state), 2);
  assert.equal(store.selectors.getStatus(state), 'active');
  assert.equal(store.selectors.getProgressPercentage(state), 25);
  assert.equal(store.selectors.getNextRequiredAction(state), 'fill_plan_b');
  assert.equal(store.selectors.getPrimaryCta(state).action, 'open_plan_b');
  assert.equal(store.selectors.getStageCards(state).length, 3);
  assert.equal(store.selectors.getActiveStageCard(state).key, 'stage_2');
  assert.equal(store.selectors.isMaintenance(state), false);
  assert.equal(store.selectors.hasError(state), false);
  assert.equal(store.selectors.canSubmit(state), true);
  assert.equal(store.selectors.isLoading(state), false);
  assert.equal(store.selectors.isSaving(state), false);
});

test('canSubmit is false during loading or saving', async () => {
  let resolveFetch;
  const pendingFetch = new Promise((resolve) => { resolveFetch = resolve; });
  const { createProjectLmV5State } = createModule(() => pendingFetch);
  const store = createProjectLmV5State();

  const loadingPromise = store.loadJourney();
  assert.equal(store.selectors.isLoading(store.getState()), true);
  assert.equal(store.selectors.canSubmit(store.getState()), false);
  resolveFetch(okResponse());
  await loadingPromise;

  let resolvePost;
  const pendingPost = new Promise((resolve) => { resolvePost = resolve; });
  const postModule = createModule(() => pendingPost);
  const postStore = postModule.createProjectLmV5State();
  const savingPromise = postStore.createMaintenanceGoal({ goal: 'Manter' });
  assert.equal(postStore.selectors.isSaving(postStore.getState()), true);
  assert.equal(postStore.selectors.canSubmit(postStore.getState()), false);
  resolvePost(okResponse());
  await savingPromise;
});

test('state layer does not manipulate the DOM or register visual events', () => {
  assert.doesNotMatch(source, /document\.querySelector/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /addEventListener/);
});

test('API failures 400, 404, 409 and 500 preserve last_error_code when backend omits code', async () => {
  for (const status of [400, 404, 409, 500]) {
    const { createProjectLmV5State } = createModule(async () => ({
      ok: false,
      status,
      async json() {
        return { ok: false, error: `HTTP ${status}` };
      }
    }));
    const store = createProjectLmV5State();
    const result = await store.loadJourney();
    assert.equal(result.ok, false);
    assert.equal(result.code, `HTTP_${status}`);
    assert.equal(store.getState().error, `HTTP ${status}`);
    assert.equal(store.getState().last_error_code, `HTTP_${status}`);
  }
});

test('state layer blocks duplicate saves while a POST is already in progress', async () => {
  let resolveFetch;
  let calls = 0;
  const pendingFetch = new Promise((resolve) => { resolveFetch = resolve; });
  const { createProjectLmV5State } = createModule(() => {
    calls += 1;
    return pendingFetch;
  });
  const store = createProjectLmV5State();

  const first = store.createVictory({ description: 'Primeira vitória' });
  const duplicate = await store.createVictory({ description: 'Primeira vitória duplicada' });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'PROJECT_LM_V5_SAVE_IN_PROGRESS');
  assert.equal(calls, 1);

  resolveFetch(okResponse());
  assert.equal((await first).ok, true);
});

test('state layer blocks duplicate journey loads while a GET is already in progress', async () => {
  let resolveFetch;
  let calls = 0;
  const pendingFetch = new Promise((resolve) => { resolveFetch = resolve; });
  const { createProjectLmV5State } = createModule(() => {
    calls += 1;
    return pendingFetch;
  });
  const store = createProjectLmV5State();

  const first = store.loadJourney();
  const duplicate = await store.loadJourney();
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'PROJECT_LM_V5_LOAD_IN_PROGRESS');
  assert.equal(calls, 1);

  resolveFetch(okResponse());
  assert.equal((await first).ok, true);
});

test('request timeouts abort stalled V5 API calls and emit operational telemetry', async () => {
  const events = [];
  const { createProjectLmV5State } = createModule((path, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    });
  }));
  const store = createProjectLmV5State({ onTelemetry: (event) => events.push(event), requestTimeoutMs: 1 });

  const result = await store.loadJourney();

  assert.equal(result.ok, false);
  assert.equal(result.code, 'PROJECT_LM_V5_REQUEST_TIMEOUT');
  assert.equal(store.getState().last_error_code, 'PROJECT_LM_V5_REQUEST_TIMEOUT');
  assert.ok(events.some((event) => event.event === 'api_error' && event.error_code === 'PROJECT_LM_V5_REQUEST_TIMEOUT'));
});

test('state emits V5 telemetry, load timing and diagnostics without changing UX state', async () => {
  const events = [];
  const { createProjectLmV5State } = createModule(async () => okResponse(sampleContract({ journey: { id: 'journey-1', student_id: 'student-1', status: 'active', current_stage: 2 } })));
  const store = createProjectLmV5State({ onTelemetry: (event) => events.push(event) });

  await store.loadJourney();
  await store.savePlanB({ emergency_meal: 'Ovos' });

  assert.equal(events[0].namespace, 'project_lm_v5');
  assert.ok(events.some((event) => event.event === 'journey_load_time' && Number.isFinite(event.duration_ms) && event.request_start && event.request_end));
  assert.ok(events.some((event) => event.event === 'journey_loaded' && event.student_id === 'student-1' && event.current_stage === 2 && event.journey_status === 'active'));
  assert.ok(events.some((event) => event.event === 'stage_2_completed'));
  assert.deepEqual(JSON.parse(JSON.stringify(store.getJourneyDiagnostics())), {
    route: '#project-lm/journey',
    current_stage: 2,
    journey_status: 'active',
    next_required_action: 'fill_plan_b',
    loading: false,
    saving: false,
    last_error_code: null
  });
});

test('invalid current_stage and status produce contract warnings without rejecting renderable data', async () => {
  const events = [];
  const warnings = [];
  const context = createModule(async () => okResponse(sampleContract({
    journey: { id: 'journey-1', status: 'mystery', current_stage: 99 },
    progress: { current_stage: 99, status: 'mystery', percentage: 0, next_required_action: 'fill_plan_b' }
  })));
  context.console = { warn: (...args) => warnings.push(args) };
  context.ProjectLmV5Telemetry = (event) => events.push(event);
  const store = context.createProjectLmV5State({ onTelemetry: (event) => events.push(event) });

  const result = await store.loadJourney();

  assert.equal(result.ok, true);
  assert.equal(store.getState().journey.current_stage, 99);
  assert.ok(events.some((event) => event.event === 'contract_warning' && event.code === 'PROJECT_LM_V5_INVALID_CURRENT_STAGE'));
  assert.ok(events.some((event) => event.event === 'contract_warning' && event.code === 'PROJECT_LM_V5_INVALID_STATUS'));
  assert.equal(warnings.length >= 2, true);
});

test('api_error telemetry captures endpoint, status_code and error_code', async () => {
  const events = [];
  const { createProjectLmV5State } = createModule(async () => ({
    ok: false,
    status: 500,
    async json() {
      return { ok: false, error: 'Falha', code: 'SERVER_DOWN' };
    }
  }));
  const store = createProjectLmV5State({ onTelemetry: (event) => events.push(event) });

  await store.loadJourney();

  assert.ok(events.some((event) => event.event === 'api_error' && event.endpoint === '/api/project-lm/journey' && event.status_code === 500 && event.error_code === 'SERVER_DOWN'));
});
