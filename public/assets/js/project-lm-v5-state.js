(function initProjectLmV5State(globalScope) {
  const INITIAL_STATE = Object.freeze({
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

  const INVALID_CONTRACT_CODE = 'PROJECT_LM_V5_INVALID_CONTRACT';
  const NETWORK_ERROR_CODE = 'PROJECT_LM_V5_NETWORK_ERROR';
  const INVALID_JSON_CODE = 'PROJECT_LM_V5_INVALID_JSON';
  const VALIDATION_ERROR_CODE = 'PROJECT_LM_V5_ACTION_VALIDATION_ERROR';
  const REQUEST_TIMEOUT_CODE = 'PROJECT_LM_V5_REQUEST_TIMEOUT';
  const TELEMETRY_NAMESPACE = 'project_lm_v5';
  const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
  const VALID_STAGES = new Set([1, 2, 3, 4, '1', '2', '3', '4', 'maintenance']);
  const VALID_STATUSES = new Set(['active', 'completed', 'locked', 'maintenance', 'loading', 'error']);

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getStudentId() {
    const storage = globalScope.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return null;
    return storage.getItem('lm_student_id') || storage.getItem('lm_student_email') || null;
  }

  function emitTelemetry(event, payload = {}, telemetry = globalScope.ProjectLmV5Telemetry) {
    const entry = { namespace: TELEMETRY_NAMESPACE, event, timestamp: nowIso(), ...payload };
    if (!entry.student_id) entry.student_id = getStudentId();
    try {
      if (typeof telemetry === 'function') telemetry(entry);
      else if (telemetry && typeof telemetry.track === 'function') telemetry.track(TELEMETRY_NAMESPACE, event, entry);
      else if (typeof globalScope.dispatchEvent === 'function' && typeof globalScope.CustomEvent === 'function') {
        globalScope.dispatchEvent(new globalScope.CustomEvent('project_lm_v5:telemetry', { detail: entry }));
      }
    } catch (_) {
      // Telemetry must never affect the Jornada.
    }
    return entry;
  }

  function getAuthHeaders() {
    const storage = globalScope.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return {};
    const email = storage.getItem('lm_student_email') || '';
    const token = storage.getItem('lm_student_token') || '';
    if (!email || !token) return {};
    return { 'x-student-email': email, 'x-student-token': token };
  }

  function validateJourneyContract(data) {
    const warnings = [];
    const currentStage = data?.journey?.current_stage ?? data?.progress?.current_stage;
    const status = data?.journey?.status ?? data?.progress?.status;
    if (currentStage != null && !VALID_STAGES.has(currentStage)) warnings.push({ field: 'current_stage', value: currentStage, code: 'PROJECT_LM_V5_INVALID_CURRENT_STAGE' });
    if (status != null && !VALID_STATUSES.has(status)) warnings.push({ field: 'status', value: status, code: 'PROJECT_LM_V5_INVALID_STATUS' });
    for (const warning of warnings) {
      emitTelemetry('contract_warning', warning);
      if (globalScope.console && typeof globalScope.console.warn === 'function') globalScope.console.warn('[project_lm_v5] contract warning', warning);
    }
    return warnings;
  }

  function normalizeJourneyResponse(response) {
    const data = response && response.ok === true ? response.data : null;
    if (!data || !data.journey || !data.progress || !data.stages || !data.view_model) {
      return {
        ok: false,
        error: 'Contrato da Jornada V5 inválido.',
        code: INVALID_CONTRACT_CODE
      };
    }

    const warnings = validateJourneyContract(data);

    return {
      ok: true,
      warnings,
      data: {
        journey: data.journey,
        progress: data.progress,
        stages: data.stages,
        view_model: data.view_model
      }
    };
  }

  async function requestProjectLmV5(path, options = {}) {
    const fetchImpl = options.fetchImpl || globalScope.fetch;
    if (typeof fetchImpl !== 'function') {
      const result = { ok: false, error: 'Cliente HTTP indisponível.', code: NETWORK_ERROR_CODE, status_code: null, endpoint: path };
      emitTelemetry('api_error', { endpoint: path, status_code: null, error_code: result.code }, options.telemetry);
      return result;
    }

    const hasBody = Object.prototype.hasOwnProperty.call(options, 'body') && options.body !== undefined;
    const timeoutMs = Number(options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    const canTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 && typeof globalScope.AbortController === 'function';
    const controller = canTimeout ? new globalScope.AbortController() : null;
    const timeoutId = controller ? globalScope.setTimeout(() => controller.abort(), timeoutMs) : null;
    const headers = {
      ...getAuthHeaders(),
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    };

    let response;
    try {
      response = await fetchImpl(path, {
        method: options.method || 'GET',
        credentials: options.credentials || 'same-origin',
        headers,
        signal: controller?.signal,
        body: hasBody ? JSON.stringify(options.body) : undefined
      });
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      const result = {
        ok: false,
        error: timedOut ? 'Tempo limite ao acessar a Jornada V5.' : error?.message || 'Erro de rede ao acessar a Jornada V5.',
        code: timedOut ? REQUEST_TIMEOUT_CODE : NETWORK_ERROR_CODE,
        status_code: null,
        endpoint: path
      };
      emitTelemetry('api_error', { endpoint: path, status_code: null, error_code: result.code }, options.telemetry);
      return result;
    } finally {
      if (timeoutId) globalScope.clearTimeout(timeoutId);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      const result = { ok: false, error: 'Resposta inválida da Jornada V5.', code: INVALID_JSON_CODE, status_code: response.status, endpoint: path };
      emitTelemetry('api_error', { endpoint: path, status_code: response.status, error_code: result.code }, options.telemetry);
      return result;
    }

    if (!response.ok || payload?.ok === false) {
      const result = {
        ok: false,
        error: payload?.error || 'Erro ao acessar a Jornada V5.',
        code: payload?.code || `HTTP_${response.status}`,
        status_code: response.status,
        endpoint: path
      };
      emitTelemetry('api_error', { endpoint: path, status_code: response.status, error_code: result.code }, options.telemetry);
      return { ok: false, error: result.error, code: result.code };
    }

    return normalizeJourneyResponse(payload);
  }

  function createProjectLmV5State(config = {}) {
    let state = { ...INITIAL_STATE };
    const telemetry = config.telemetry || config.onTelemetry || globalScope.ProjectLmV5Telemetry;
    const listeners = new Set();
    const fetchImpl = config.fetchImpl;
    const requestTimeoutMs = config.requestTimeoutMs;

    function getState() {
      return clone(state);
    }

    function notify() {
      const snapshot = getState();
      for (const listener of listeners) {
        try {
          listener(snapshot);
        } catch (_) {
          // Subscribers must not break state updates for other listeners.
        }
      }
    }

    function setState(patch) {
      state = { ...state, ...patch };
      notify();
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') return function noopUnsubscribe() {};
      listeners.add(listener);
      try {
        listener(getState());
      } catch (_) {
        // Initial subscriber delivery follows the same resilience as notify.
      }
      return function unsubscribe() {
        listeners.delete(listener);
      };
    }

    function baseTelemetryPayload(nextState = state) {
      return {
        student_id: nextState?.journey?.student_id || nextState?.journey?.studentId || getStudentId(),
        journey_status: nextState?.journey?.status ?? nextState?.progress?.status ?? null,
        current_stage: nextState?.journey?.current_stage ?? nextState?.progress?.current_stage ?? null
      };
    }

    function track(event, payload = {}) {
      return emitTelemetry(event, { ...baseTelemetryPayload(), ...payload }, telemetry);
    }

    function getJourneyDiagnostics() {
      return {
        route: globalScope.location?.hash || '#project-lm/journey',
        current_stage: selectors.getCurrentStage(state),
        journey_status: selectors.getStatus(state),
        next_required_action: selectors.getNextRequiredAction(state),
        loading: Boolean(state.loading),
        saving: Boolean(state.saving),
        last_error_code: state.last_error_code
      };
    }

    function applySuccess(data) {
      const nextState = {
        loading: false,
        saving: false,
        error: null,
        last_error_code: null,
        journey: data.journey,
        progress: data.progress,
        stages: data.stages,
        view_model: data.view_model,
        last_updated_at: nowIso()
      };
      setState(nextState);
    }

    function applyFailure(result) {
      setState({
        loading: false,
        saving: false,
        error: result.error || 'Erro ao acessar a Jornada V5.',
        last_error_code: result.code || null
      });
    }

    async function runRequest(path, options, mode) {
      if (mode === 'loading' && state.loading) {
        return clone({ ok: false, error: 'Já existe um carregamento em andamento.', code: 'PROJECT_LM_V5_LOAD_IN_PROGRESS' });
      }
      if (mode === 'saving' && state.saving) {
        return clone({ ok: false, error: 'Já existe um salvamento em andamento.', code: 'PROJECT_LM_V5_SAVE_IN_PROGRESS' });
      }
      setState({ [mode]: true, error: null, last_error_code: null });
      const request_start = nowIso();
      const started = Date.now();
      const result = await requestProjectLmV5(path, { ...options, fetchImpl, telemetry, timeoutMs: requestTimeoutMs });
      const request_end = nowIso();
      if (path === '/api/project-lm/journey') track('journey_load_time', { request_start, request_end, duration_ms: Date.now() - started });
      if (result.ok) {
        applySuccess(result.data);
        if (path === '/api/project-lm/journey') track('journey_loaded');
        else if (path.includes('/stage-1/')) track('stage_1_completed');
        else if (path.includes('/plan-b')) track('stage_2_completed');
        else if (path.includes('/victories')) track('stage_3_completed');
        else if (path.includes('/recovery')) track('stage_4_completed');
        else if (path.includes('/maintenance-goals')) track('journey_completed');
      } else applyFailure(result);
      return clone(result);
    }

    function validationError(message) {
      const result = { ok: false, error: message, code: VALIDATION_ERROR_CODE };
      applyFailure(result);
      return Promise.resolve(result);
    }

    function loadJourney() {
      return runRequest('/api/project-lm/journey', { method: 'GET' }, 'loading');
    }

    function createStage1Actions(actions) {
      if (!Array.isArray(actions) || actions.length === 0) return validationError('Informe as ações mínimas da Etapa 1.');
      return runRequest('/api/project-lm/stage-1/actions', { method: 'POST', body: { actions } }, 'saving');
    }

    function completeStage1Action(actionId) {
      const id = String(actionId || '').trim();
      if (!id) return validationError('Informe a ação mínima que será concluída.');
      return runRequest(`/api/project-lm/stage-1/actions/${encodeURIComponent(id)}/complete`, { method: 'POST' }, 'saving');
    }

    function savePlanB(payload) {
      if (!payload || typeof payload !== 'object') return validationError('Informe os dados do Plano B.');
      return runRequest('/api/project-lm/plan-b', { method: 'POST', body: payload }, 'saving');
    }

    function createVictory(payload) {
      if (!payload || typeof payload !== 'object') return validationError('Informe a vitória que será registrada.');
      return runRequest('/api/project-lm/victories', { method: 'POST', body: payload }, 'saving');
    }

    function saveRecovery(payload) {
      if (!payload || typeof payload !== 'object') return validationError('Informe os protocolos de recuperação.');
      return runRequest('/api/project-lm/recovery', { method: 'POST', body: payload }, 'saving');
    }

    function createMaintenanceGoal(payload) {
      if (!payload || typeof payload !== 'object') return validationError('Informe a meta de manutenção.');
      return runRequest('/api/project-lm/maintenance-goals', { method: 'POST', body: payload }, 'saving');
    }

    return {
      getState,
      subscribe,
      loadJourney,
      getJourneyDiagnostics,
      track,
      createStage1Actions,
      completeStage1Action,
      savePlanB,
      createVictory,
      saveRecovery,
      createMaintenanceGoal,
      selectors,
      normalizeJourneyResponse,
      requestProjectLmV5,
      emitTelemetry
    };
  }

  const selectors = Object.freeze({
    getCurrentStage(state) {
      return state?.journey?.current_stage ?? state?.progress?.current_stage ?? null;
    },
    getStatus(state) {
      return state?.journey?.status ?? state?.progress?.status ?? null;
    },
    getProgressPercentage(state) {
      return state?.progress?.percentage ?? 0;
    },
    getNextRequiredAction(state) {
      return state?.progress?.next_required_action ?? null;
    },
    getPrimaryCta(state) {
      return state?.view_model?.primary_cta ?? null;
    },
    getStageCards(state) {
      return state?.view_model?.stage_cards || [];
    },
    getActiveStageCard(state) {
      return selectors.getStageCards(state).find((card) => card.status === 'active') || null;
    },
    isMaintenance(state) {
      return selectors.getStatus(state) === 'maintenance';
    },
    hasError(state) {
      return Boolean(state?.error || state?.last_error_code);
    },
    canSubmit(state) {
      return !state?.loading && !state?.saving;
    },
    isLoading(state) {
      return Boolean(state?.loading);
    },
    isSaving(state) {
      return Boolean(state?.saving);
    }
  });

  const defaultStore = createProjectLmV5State();
  globalScope.ProjectLmV5State = defaultStore;
  globalScope.createProjectLmV5State = createProjectLmV5State;
})(typeof window !== 'undefined' ? window : globalThis);
