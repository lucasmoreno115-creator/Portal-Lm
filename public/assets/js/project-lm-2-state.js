(function initializeProjectLm2State(global) {
  const initialState = Object.freeze({
    onboarding_completed: false,
    current_week: 1,
    continuity_days_count: 0,
    required_days_count: 5,
    next_action: 'start_onboarding'
  });

  function createState(overrides = {}) {
    return Object.freeze({ ...initialState, ...overrides });
  }

  global.ProjectLm2State = {
    initialState,
    createState
  };
})(window);
