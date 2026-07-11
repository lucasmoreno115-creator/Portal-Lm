const nutritionModule = await import('./project-lm-runtime/services/generateStudentNutritionPlan.js');
const workoutModule = await import('./project-lm-runtime/services/generateStudentWorkoutPlan.js');
const rendererModule = await import('./project-lm-runtime/ui/studentPlanRenderers.js');
const adapterModule = await import('./project-lm-runtime/adapters/studentProfileAdapter.js');
const continuityModule = await import('./project-lm-runtime/adapters/continuityCheckinAdapter.js');
const consistencyModule = await import('./project-lm-runtime/adapters/consistencyAdapter.js');

const { generateStudentNutritionPlan } = nutritionModule;
const { generateStudentWorkoutPlan } = workoutModule;
const { renderNutritionPlan, renderWorkoutPlan, renderWeeklyPlan, renderContinuityCheckin, renderWeeklyConsistency, renderPlanError, logPlanError, estimateWorkoutDuration } = rendererModule;
const { adaptStudentProfile } = adapterModule;
const { adaptContinuityCheckin } = continuityModule;
const { adaptWeeklyConsistency } = consistencyModule;

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
  renderWeeklyConsistency,
  renderPlanError,
  estimateWorkoutDuration,
  resolveStudentProfile,
  resolveContinuityCheckin: (input) => adaptContinuityCheckin(input).student_visible,
  resolveWeeklyConsistency: (checkins) => adaptWeeklyConsistency(checkins).student_visible,
  getStudentNutritionPlan: (student, options) => {
    const { nutritionInput } = resolveStudentProfile(student, options);
    return safeGenerate(generateStudentNutritionPlan, nutritionInput);
  },
  getStudentWorkoutPlan: (student, options) => {
    const { workoutInput, weeklyPlan } = resolveStudentProfile(student, options);
    const dayKey = options?.day || options?.dayKey || weeklyPlan?.today?.dayKey || workoutInput.day;
    if ((options?.day || options?.dayKey) && dayKey !== 'rest_day') return safeGenerate(generateStudentWorkoutPlan, { ...workoutInput, rest_day: false, day: dayKey });
    if (workoutInput.rest_day) return createRestDayPlan(workoutInput);
    return safeGenerate(generateStudentWorkoutPlan, { ...workoutInput, day: dayKey });
  },
  getStudentWeeklyPlan: (student, options) => {
    const { weeklyPlan } = resolveStudentProfile(student, options);
    return sanitizeWeeklyPlan(weeklyPlan);
  },
  getStudentWorkoutProgram: (student, options) => {
    const { workoutInput, weeklyPlan } = resolveStudentProfile(student, options);
    const seen = new Set();
    return (weeklyPlan?.week || [])
      .filter((day) => day?.dayKey && day.dayKey !== 'rest_day')
      .filter((day) => {
        if (seen.has(day.dayKey)) return false;
        seen.add(day.dayKey);
        return true;
      })
      .map((day) => {
        const workout = day.dayKey === 'rest_day' ? createRestDayPlan(workoutInput) : safeGenerate(generateStudentWorkoutPlan, { ...workoutInput, rest_day: false, day: day.dayKey });
        const exerciseCount = Array.isArray(workout?.exercises) ? workout.exercises.length : 0;
        return { weekday: day.weekday, label: day.label, dayKey: day.dayKey, title: day.title, type: day.type, isToday: day.isToday, exerciseCount, duration: estimateWorkoutDuration(workout) };
      });
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
