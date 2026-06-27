(function initializeProjectLm2State(global) {
  const initialState = Object.freeze({
    name: '',
    goal: '',
    sex: '',
    weight_kg: null,
    onboarding_completed: false,
    current_week: 1,
    continuity_days_count: 0,
    required_days_count: 5,
    next_action: 'start_onboarding',
    home_loaded: false,
    home_data: null,
    direction_loaded: false,
    home: null,
    week_1_video_completed: false,
    plan_b_completed: false,
    plan_b: { unable_to_train: '', overeating: '', no_motivation: '' }
  });

  let state = { ...initialState };

  function createState(overrides = {}) {
    return Object.freeze({ ...initialState, ...state, ...overrides });
  }

  function getState() {
    return createState();
  }

  function updateState(patch = {}) {
    state = { ...state, ...patch };
    return getState();
  }

  function resetState(overrides = {}) {
    state = { ...initialState, ...overrides };
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
