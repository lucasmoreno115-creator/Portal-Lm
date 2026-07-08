const nutritionModule = await import('../../../' + 'src/projeto-lm/services/generateStudentNutritionPlan.js');
const workoutModule = await import('../../../' + 'src/projeto-lm/services/generateStudentWorkoutPlan.js');
const rendererModule = await import('../../../' + 'src/projeto-lm/ui/studentPlanRenderers.js');

const { generateStudentNutritionPlan } = nutritionModule;
const { generateStudentWorkoutPlan } = workoutModule;
const { renderNutritionPlan, renderWorkoutPlan, renderPlanError, logPlanError } = rendererModule;
const DEFAULT_NUTRITION_INPUT = Object.freeze({ profile: 'M2', breakfast: 'breakfast_01', lunch: 'lunch_01', snack: 'snack_03', dinner: 'dinner_01' });
const DEFAULT_WORKOUT_INPUT = Object.freeze({ profile: 'GYM_FEMALE', day: 'lower_a' });

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
  getDefaultNutritionPlan: () => safeGenerate(generateStudentNutritionPlan, DEFAULT_NUTRITION_INPUT),
  getDefaultWorkoutPlan: () => safeGenerate(generateStudentWorkoutPlan, DEFAULT_WORKOUT_INPUT)
});

window.dispatchEvent(new CustomEvent('project-lm-engine-services-ready'));
