const nutritionModule = await import('../../../' + 'src/projeto-lm/services/generateStudentNutritionPlan.js');
const workoutModule = await import('../../../' + 'src/projeto-lm/services/generateStudentWorkoutPlan.js');
const rendererModule = await import('../../../' + 'src/projeto-lm/ui/studentPlanRenderers.js');
const adapterModule = await import('../../../' + 'src/projeto-lm/adapters/studentProfileAdapter.js');

const { generateStudentNutritionPlan } = nutritionModule;
const { generateStudentWorkoutPlan } = workoutModule;
const { renderNutritionPlan, renderWorkoutPlan, renderPlanError, logPlanError } = rendererModule;
const { adaptStudentProfile } = adapterModule;

function resolveStudentProfile(student = {}, options = {}) {
  return adaptStudentProfile(student || {}, options);
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
  renderPlanError,
  resolveStudentProfile,
  getStudentNutritionPlan: (student, options) => {
    const { nutritionInput } = resolveStudentProfile(student, options);
    return safeGenerate(generateStudentNutritionPlan, nutritionInput);
  },
  getStudentWorkoutPlan: (student, options) => {
    const { workoutInput } = resolveStudentProfile(student, options);
    if (workoutInput.rest_day) return createRestDayPlan(workoutInput);
    return safeGenerate(generateStudentWorkoutPlan, workoutInput);
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
