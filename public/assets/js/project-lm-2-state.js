(function initializeProjectLm2State(global) {
  const storageKey = 'project-lm-2-state';
  const initialState = Object.freeze({
    name: '',
    goal: '',
    sex: '',
    weight_kg: null,
    height_cm: null,
    nutrition_plan_id: '',
    training_plan_id: '',
    onboarding_completed: false,
    current_week: 1,
    week_started_at: null,
    week_completed_at: null,
    continuity_days_count: 0,
    required_days_count: 5,
    goal_reached: false,
    today_checkin_completed: false,
    next_action: 'start_onboarding',
    next_action_label: '',
    week_status: null,
    week_completed: false,
    next_week_available: false,
    home_loaded: false,
    home_data: null,
    direction_loaded: false,
    home: null,
    week_1_video_completed: false,
    plan_b_completed: false,
    plan_b: { unable_to_train: '', overeating: '', no_motivation: '' },
    week_2_status: null,
    week_2_video_completed: false,
    week_2_reflection_completed: false,
    week_2_response_completed: false,
    week_2_reflection: '',
    week_2_minimum_response: '',
    week_2_completed: false,
    week_3_available: false,
    week_3_video_completed: false,
    week_3_reflection: '',
    week_3_reflection_completed: false,
    week_3_minimum_response: '',
    week_3_response_completed: false,
    week_3_completed: false,
    week_4_video_completed: false,
    week_4_reflection: '',
    week_4_reflection_completed: false,
    week_4_minimum_response: '',
    week_4_response_completed: false,
    week_4_completed: false,
    program_completed: false
  });

  const booleanFields = [
    'onboarding_completed', 'goal_reached', 'today_checkin_completed', 'week_completed', 'next_week_available',
    'home_loaded', 'direction_loaded', 'week_1_video_completed', 'plan_b_completed', 'week_2_video_completed',
    'week_2_reflection_completed', 'week_2_response_completed', 'week_2_completed', 'week_3_available',
    'week_3_video_completed', 'week_3_reflection_completed', 'week_3_response_completed', 'week_3_completed',
    'week_4_video_completed', 'week_4_reflection_completed', 'week_4_response_completed', 'week_4_completed',
    'program_completed'
  ];

  function readStoredState() {
    try {
      if (!global.localStorage) return {};
      const raw = global.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function normalizeNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    if (typeof min === 'number' && number < min) return fallback;
    if (typeof max === 'number' && number > max) return fallback;
    return number;
  }

  function sanitizeState(candidate = {}) {
    const safe = { ...initialState, ...candidate };
    safe.name = String(safe.name || '').slice(0, 120);
    safe.goal = String(safe.goal || '');
    safe.sex = String(safe.sex || '');
    safe.weight_kg = safe.weight_kg === null || safe.weight_kg === '' ? null : normalizeNumber(safe.weight_kg, null, 1, 500);
    safe.height_cm = safe.height_cm === null || safe.height_cm === '' ? null : normalizeNumber(safe.height_cm, null, 1, 300);
    safe.nutrition_plan_id = String(safe.nutrition_plan_id || '');
    safe.training_plan_id = String(safe.training_plan_id || '');
    safe.current_week = normalizeNumber(safe.current_week, initialState.current_week, 1, 4);
    safe.continuity_days_count = normalizeNumber(safe.continuity_days_count, 0, 0, 31);
    safe.required_days_count = normalizeNumber(safe.required_days_count, initialState.required_days_count, 1, 31);
    safe.next_action = String(safe.next_action || initialState.next_action);
    safe.next_action_label = String(safe.next_action_label || '');
    safe.plan_b = typeof safe.plan_b === 'object' && safe.plan_b !== null ? { ...initialState.plan_b, ...safe.plan_b } : initialState.plan_b;
    for (const field of booleanFields) safe[field] = Boolean(safe[field]);
    return safe;
  }

  function persistState(nextState) {
    try {
      if (global.localStorage) global.localStorage.setItem(storageKey, JSON.stringify(nextState));
    } catch (error) {
      // Storage can be unavailable in private browsing or embedded contexts; state remains in memory.
    }
  }

  let state = sanitizeState({ ...readStoredState(), home_loaded: false, direction_loaded: false });

  function createState(overrides = {}) {
    return Object.freeze(sanitizeState({ ...state, ...overrides }));
  }

  function getState() {
    return createState();
  }

  function updateState(patch = {}) {
    state = sanitizeState({ ...state, ...patch });
    persistState(state);
    return getState();
  }

  function resetState(overrides = {}) {
    state = sanitizeState({ ...initialState, ...overrides });
    persistState(state);
    return getState();
  }

  global.ProjectLm2State = {
    initialState,
    createState,
    getState,
    updateState,
    resetState
  };
})(window);
