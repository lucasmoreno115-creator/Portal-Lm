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

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getAuthHeaders() {
    const storage = globalScope.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return {};
    const email = storage.getItem('lm_student_email') || '';
    const token = storage.getItem('lm_student_token') || '';
    if (!email || !token) return {};
    return { 'x-student-email': email, 'x-student-token': token };
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

    return {
      ok: true,
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
      return { ok: false, error: 'Cliente HTTP indisponível.', code: NETWORK_ERROR_CODE };
    }

    const hasBody = Object.prototype.hasOwnProperty.call(options, 'body') && options.body !== undefined;
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
        body: hasBody ? JSON.stringify(options.body) : undefined
      });
    } catch (error) {
      return { ok: false, error: error?.message || 'Erro de rede ao acessar a Jornada V5.', code: NETWORK_ERROR_CODE };
    }

    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      return { ok: false, error: 'Resposta inválida da Jornada V5.', code: INVALID_JSON_CODE };
    }

    if (!response.ok || payload?.ok === false) {
      return {
        ok: false,
        error: payload?.error || 'Erro ao acessar a Jornada V5.',
        code: payload?.code || null
      };
    }

    return normalizeJourneyResponse(payload);
  }

  function createProjectLmV5State(config = {}) {
    let state = { ...INITIAL_STATE };
    const listeners = new Set();
    const fetchImpl = config.fetchImpl;

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

    function applySuccess(data) {
      setState({
        loading: false,
        saving: false,
        error: null,
        last_error_code: null,
        journey: data.journey,
        progress: data.progress,
        stages: data.stages,
        view_model: data.view_model,
        last_updated_at: nowIso()
      });
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
      setState({ [mode]: true, error: null, last_error_code: null });
      const result = await requestProjectLmV5(path, { ...options, fetchImpl });
      if (result.ok) applySuccess(result.data);
      else applyFailure(result);
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
      createStage1Actions,
      completeStage1Action,
      savePlanB,
      createVictory,
      saveRecovery,
      createMaintenanceGoal,
      selectors,
      normalizeJourneyResponse,
      requestProjectLmV5
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
