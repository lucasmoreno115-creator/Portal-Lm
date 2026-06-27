(function initializeProjectLm2State(global) {
  const initialState = Object.freeze({
    name: '',
    goal: '',
    sex: '',
    weight_kg: null,
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
    week_2_minimum_response: ''
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
