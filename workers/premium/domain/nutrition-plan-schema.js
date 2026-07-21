export function safeJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return fallback;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; }
}
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function arrayField(value, path, errors) { if (value != null && !Array.isArray(value)) errors.push(`${path}_MUST_BE_ARRAY`); return Array.isArray(value) ? value : []; }
function scalarField(value, path, type, errors) { if (value != null && typeof value !== type) errors.push(`${path}_MUST_BE_${type.toUpperCase()}`); }
function stringOrNumberField(value, path, errors) { if (value != null && typeof value !== 'string' && typeof value !== 'number') errors.push(`${path}_MUST_BE_STRING_OR_NUMBER`); }
function idField(value, path, errors) { stringOrNumberField(value, `${path}_ID`, errors); }
function substitutionFields(substitution, path, errors) {
  if (!isObject(substitution)) { errors.push(`${path}_MUST_BE_OBJECT`); return; }
  idField(substitution.id, path, errors);
  scalarField(substitution.food, `${path}_FOOD`, 'string', errors);
  scalarField(substitution.name, `${path}_NAME`, 'string', errors);
  stringOrNumberField(substitution.quantity, `${path}_QUANTITY`, errors);
  scalarField(substitution.unit, `${path}_UNIT`, 'string', errors);
  scalarField(substitution.notes, `${path}_NOTES`, 'string', errors);
  scalarField(substitution.note, `${path}_NOTE`, 'string', errors);
  scalarField(substitution.observation, `${path}_OBSERVATION`, 'string', errors);
  scalarField(substitution.text, `${path}_TEXT`, 'string', errors);
}
// Drafts may be clinically incomplete, but must still be safe to serialize and persist.
export function validateNutritionPlanDraftStructure(input = {}) {
  const errors = [];
  if (!isObject(input)) return { ok:false, errors:['PLAN_MUST_BE_OBJECT'] };
  for (const field of ['title','goal','strategy','notes','whatsapp_message','expected_updated_at']) scalarField(input[field], field.toUpperCase(), 'string', errors);
  const meals = arrayField(input.meals ?? input.meals_json, 'MEALS', errors);
  const substitutions = arrayField(input.substitutions ?? input.substitutions_json, 'SUBSTITUTIONS', errors);
  arrayField(input.adherenceRules ?? input.adherence_rules ?? input.adherence_rules_json, 'ADHERENCE_RULES', errors);
  substitutions.forEach((substitution, index) => substitutionFields(substitution, `SUBSTITUTION_${index + 1}`, errors));
  meals.forEach((meal, mealIndex) => {
    if (!isObject(meal)) { errors.push(`MEAL_${mealIndex + 1}_MUST_BE_OBJECT`); return; }
    const mealPath = `MEAL_${mealIndex + 1}`;
    idField(meal.id, mealPath, errors);
    for (const field of ['name','title','time','notes','guidance','orientation','primary_text']) scalarField(meal[field], `${mealPath}_${field.toUpperCase()}`, 'string', errors);
    const items = arrayField(meal.items, `${mealPath}_ITEMS`, errors);
    const mealSubstitutions = arrayField(meal.substitutions, `${mealPath}_SUBSTITUTIONS`, errors);
    mealSubstitutions.forEach((substitution, index) => substitutionFields(substitution, `${mealPath}_SUBSTITUTION_${index + 1}`, errors));
    items.forEach((item, itemIndex) => {
      const itemPath = `${mealPath}_ITEM_${itemIndex + 1}`;
      if (!isObject(item)) { errors.push(`${itemPath}_MUST_BE_OBJECT`); return; }
      idField(item.id, itemPath, errors);
      for (const field of ['food','name','unit','notes','note','observation']) scalarField(item[field], `${itemPath}_${field.toUpperCase()}`, 'string', errors);
      stringOrNumberField(item.quantity, `${itemPath}_QUANTITY`, errors);
      const itemSubstitutions = arrayField(item.substitutions, `${itemPath}_SUBSTITUTIONS`, errors);
      itemSubstitutions.forEach((substitution, index) => substitutionFields(substitution, `${itemPath}_SUBSTITUTION_${index + 1}`, errors));
    });
  });
  return { ok:errors.length === 0, errors };
}
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
      // Schema v2 is additive: textual meals coexist with the structured v1 items.
      // Keep legacy item data intact so loading and saving a legacy plan never erases it.
      primary_text: text(meal?.primary_text ?? meal?.primaryText) || null,
      items: safeJsonArray(meal?.items).map((item) => ({ ...item, id: text(item?.id) || undefined, food: text(item?.food ?? item?.name), quantity: text(item?.quantity), unit: text(item?.unit), note: text(item?.note ?? item?.observation) || null })),
      substitutions: safeJsonArray(meal?.substitutions).map((substitution) => ({ ...substitution, id: text(substitution?.id) || undefined, text: text(substitution?.text) || undefined })),
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
    const hasPrimaryText = Boolean(text(meal.primary_text));
    const hasGuidance = Boolean(text(meal.guidance));
    const items = Array.isArray(meal.items) ? meal.items : [];
    // v2 requires a real primary meal for newly textual plans. Structured v1 meals
    // remain publishable for backwards compatibility.
    if (!hasPrimaryText && items.length === 0 && !hasGuidance) errors.push(`MEAL_${mealIndex + 1}_PRIMARY_TEXT_REQUIRED`);
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
