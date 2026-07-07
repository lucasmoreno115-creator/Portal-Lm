(function initializeProjectLm2NutritionNormalizer(global) {
  function getNutritionData() {
    return global.ProjectLm2NutritionData || {};
  }

  function slugifyNutritionKey(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'refeicao';
  }

  function parseNutritionItem(item) {
    const text = String(item || '').trim();
    const optionMatch = text.match(/^(Opção [^:]+):\s*(.+)$/i);
    if (optionMatch) return { name: optionMatch[1], quantity: optionMatch[2], text };
    const amountMatch = text.match(/^((?:\d+(?:[.,]\d+)?\s*)?(?:g|kg|ml|unidade|unidades|fatia|fatias|concha|colheres?|pão|ovos?|fruta)\b)\s+(.+)$/i);
    if (amountMatch) return { name: amountMatch[2], quantity: amountMatch[1], text };
    return { name: text, quantity: text, text };
  }

  function inferNutritionSubstitutions(item) {
    const { nutritionEquivalenceGroups = {} } = getNutritionData();
    const normalized = item.text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/proteina|ovo|ovos|iogurte/.test(normalized)) return nutritionEquivalenceGroups.Proteínas || [];
    if (/arroz|feijao|pao|frances|batata|macarrao|mandioca|cuscuz/.test(normalized)) return nutritionEquivalenceGroups.Carboidratos || [];
    if (/fruta|banana|maca|mamao|melao|melancia|manga|laranja|pera/.test(normalized)) return nutritionEquivalenceGroups.Frutas || [];
    return [];
  }

  function normalizeNutritionMeal(name, items) {
    const { nutritionMealIcons = {} } = getNutritionData();
    const foods = items.map(parseNutritionItem).map(food => ({ ...food, substitutions: inferNutritionSubstitutions(food) }));
    return { key: slugifyNutritionKey(name), icon: nutritionMealIcons[name] || '🍽', name, foods };
  }

  function resolveNutritionPlan(state = {}) {
    const { nutritionPlans = {}, nutritionPlanNotes = [] } = getNutritionData();
    const source = nutritionPlans[state.nutrition_plan_id];
    if (!source) return null;
    const meals = Object.entries(source.meals).map(([name, items]) => normalizeNutritionMeal(name, items));
    return { title: source.title, meals, notes: nutritionPlanNotes };
  }

  global.ProjectLm2NutritionNormalizer = Object.freeze({
    slugifyNutritionKey,
    parseNutritionItem,
    inferNutritionSubstitutions,
    normalizeNutritionMeal,
    resolveNutritionPlan
  });
})(window);
