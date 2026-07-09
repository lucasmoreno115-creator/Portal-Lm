(function initializeProjectLm2NutritionNormalizer(global) {
  function slugifyNutritionKey(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'refeicao';
  }

  function parseNutritionItem(item) {
    const text = String(item || '').trim();
    return { name: text, quantity: text, text };
  }

  function inferNutritionSubstitutions() {
    return [];
  }

  function normalizeNutritionMeal(name, items = []) {
    return { key: slugifyNutritionKey(name), name, foods: items.map(parseNutritionItem) };
  }

  function resolveNutritionPlan() {
    return null;
  }

  global.ProjectLm2NutritionNormalizer = Object.freeze({
    slugifyNutritionKey,
    parseNutritionItem,
    inferNutritionSubstitutions,
    normalizeNutritionMeal,
    resolveNutritionPlan
  });
})(window);
