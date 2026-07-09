(function initializeProjectLm2NutritionData(global) {
  const nutritionPlans = Object.freeze({ H1: null, H2: null, H3: null, M1: null, M2: null, M3: null });
  const nutritionEquivalenceGroups = Object.freeze({});
  const nutritionMealIcons = Object.freeze({});
  const nutritionPlanNotes = Object.freeze([]);

  global.ProjectLm2NutritionData = Object.freeze({
    nutritionPlans,
    nutritionEquivalenceGroups,
    nutritionMealIcons,
    nutritionPlanNotes
  });
})(window);
