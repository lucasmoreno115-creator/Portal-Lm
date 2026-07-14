export function safeJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return fallback;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; }
}
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
export function toCanonicalNutritionPlan(input = {}) {
  return {
    title: text(input.title) || 'Plano alimentar',
    goal: text(input.goal),
    strategy: text(input.strategy),
    generalGuidance: text(input.generalGuidance ?? input.general_guidance),
    meals: safeJsonArray(input.meals ?? input.meals_json).map((meal, index) => ({
      id: text(meal?.id) || `meal-${index + 1}`,
      name: text(meal?.name ?? meal?.title),
      time: text(meal?.time) || null,
      guidance: text(meal?.guidance ?? meal?.orientation) || null,
      items: safeJsonArray(meal?.items).map((item) => ({ food: text(item?.food ?? item?.name), quantity: text(item?.quantity), unit: text(item?.unit), note: text(item?.note ?? item?.observation) || null })),
      substitutions: safeJsonArray(meal?.substitutions),
    })),
    substitutions: safeJsonArray(input.substitutions ?? input.substitutions_json),
    adherenceRules: safeJsonArray(input.adherenceRules ?? input.adherence_rules ?? input.adherence_rules_json),
    notes: text(input.notes),
    whatsappMessage: text(input.whatsappMessage ?? input.whatsapp_message),
  };
}
export function validateNutritionPlanStructure(input = {}) {
  const plan = toCanonicalNutritionPlan(input);
  const errors = [];
  if (!text(plan.title)) errors.push('TITLE_REQUIRED');
  if (!Array.isArray(plan.meals) || plan.meals.length === 0) errors.push('MEALS_REQUIRED');
  for (const [mealIndex, meal] of (plan.meals || []).entries()) {
    if (!text(meal.name)) errors.push(`MEAL_${mealIndex + 1}_NAME_REQUIRED`);
    const hasGuidance = Boolean(text(meal.guidance));
    const items = Array.isArray(meal.items) ? meal.items : [];
    if (!hasGuidance && items.length === 0) errors.push(`MEAL_${mealIndex + 1}_ITEM_OR_GUIDANCE_REQUIRED`);
    for (const [itemIndex, item] of items.entries()) {
      if (!text(item.food)) errors.push(`MEAL_${mealIndex + 1}_ITEM_${itemIndex + 1}_FOOD_REQUIRED`);
      if (!text(item.quantity) && !hasGuidance && !text(item.note)) errors.push(`MEAL_${mealIndex + 1}_ITEM_${itemIndex + 1}_QUANTITY_OR_GUIDANCE_REQUIRED`);
    }
  }
  return { ok: errors.length === 0, errors, plan };
}
export function serializeCanonicalNutritionPlan(input = {}) {
  const plan = toCanonicalNutritionPlan(input);
  return { title: plan.title, goal: plan.goal, strategy: plan.strategy, meals_json: JSON.stringify(plan.meals), substitutions_json: JSON.stringify(plan.substitutions), adherence_rules_json: JSON.stringify(plan.adherenceRules), notes: plan.notes, whatsapp_message: plan.whatsappMessage };
}
