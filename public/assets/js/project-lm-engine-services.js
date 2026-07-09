const nutritionModule = await import('../../../' + 'src/projeto-lm/services/generateStudentNutritionPlan.js');
const workoutModule = await import('../../../' + 'src/projeto-lm/services/generateStudentWorkoutPlan.js');
const rendererModule = await import('../../../' + 'src/projeto-lm/ui/studentPlanRenderers.js');
const adapterModule = await import('../../../' + 'src/projeto-lm/adapters/studentProfileAdapter.js');
const continuityModule = await import('../../../' + 'src/projeto-lm/adapters/continuityCheckinAdapter.js');

const { generateStudentNutritionPlan } = nutritionModule;
const { generateStudentWorkoutPlan } = workoutModule;
const { renderNutritionPlan, renderWorkoutPlan, renderWeeklyPlan, renderContinuityCheckin, renderPlanError, logPlanError } = rendererModule;
const { adaptStudentProfile } = adapterModule;
const { adaptContinuityCheckin } = continuityModule;

function resolveStudentProfile(student = {}, options = {}) {
  return adaptStudentProfile(student || {}, options);
}

function sanitizeWeeklyPlan(weeklyPlan) {
  return {
    today: weeklyPlan?.today ? { label: weeklyPlan.today.label, title: weeklyPlan.today.title, type: weeklyPlan.today.type, message: weeklyPlan.today.message } : null,
    week: Array.isArray(weeklyPlan?.week) ? weeklyPlan.week.map((day) => ({ weekday: day.weekday, label: day.label, title: day.title, type: day.type, isToday: day.isToday, message: day.message })) : [],
    nextWorkouts: Array.isArray(weeklyPlan?.nextWorkouts) ? weeklyPlan.nextWorkouts.map((day) => ({ label: day.label, title: day.title, type: day.type })) : []
  };
}

function createRestDayPlan(workoutInput) {
  return {
    rest_day: true,
    display_name: 'Descanso ativo',
    guidance: workoutInput.rest_guidance || 'Hoje é dia de descanso. Uma caminhada leve já é suficiente.',
    exercises: []
  };
}

function safeGenerate(generator, input) {
  try {
    return generator(input);
  } catch (error) {
    logPlanError(error, window.location?.hostname === 'localhost' ? 'development' : 'production');
    return null;
  }
}

window.ProjectLmEngineServices = Object.freeze({
  generateStudentNutritionPlan,
  generateStudentWorkoutPlan,
  renderNutritionPlan,
  renderWorkoutPlan,
  renderWeeklyPlan,
  renderContinuityCheckin,
  renderPlanError,
  resolveStudentProfile,
  resolveContinuityCheckin: (input) => adaptContinuityCheckin(input).student_visible,
  getStudentNutritionPlan: (student, options) => {
    const { nutritionInput } = resolveStudentProfile(student, options);
    return safeGenerate(generateStudentNutritionPlan, nutritionInput);
  },
  getStudentWorkoutPlan: (student, options) => {
    const { workoutInput, weeklyPlan } = resolveStudentProfile(student, options);
    const dayKey = weeklyPlan?.today?.dayKey || workoutInput.day;
    if (workoutInput.rest_day) return createRestDayPlan(workoutInput);
    return safeGenerate(generateStudentWorkoutPlan, { ...workoutInput, day: dayKey });
  },
  getStudentWeeklyPlan: (student, options) => {
    const { weeklyPlan } = resolveStudentProfile(student, options);
    return sanitizeWeeklyPlan(weeklyPlan);
  },
  getDefaultNutritionPlan: () => {
    const { nutritionInput } = resolveStudentProfile();
    return safeGenerate(generateStudentNutritionPlan, nutritionInput);
  },
  getDefaultWorkoutPlan: () => {
    const { workoutInput } = resolveStudentProfile();
    if (workoutInput.rest_day) return createRestDayPlan(workoutInput);
    return safeGenerate(generateStudentWorkoutPlan, workoutInput);
  }
});

window.dispatchEvent(new CustomEvent('project-lm-engine-services-ready'));
