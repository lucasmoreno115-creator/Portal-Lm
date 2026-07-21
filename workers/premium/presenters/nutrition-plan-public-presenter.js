import { safeJsonArray } from '../domain/nutrition-plan-schema.js';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function publicValue(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function presentMeal(meal) {
  const source = meal && typeof meal === 'object' ? meal : {};
  return {
    name: text(source.name ?? source.title),
    time: text(source.time) || null,
    primary_text: text(source.primary_text ?? source.primaryText) || null,
    guidance: text(source.guidance ?? source.orientation) || null,
    // Keep v1 items until every portal consumer has moved to primary_text.
    items: safeJsonArray(source.items),
    substitutions: safeJsonArray(source.substitutions),
  };
}

export function presentPublicNutritionPlan(plan) {
  // A draft, archived version, or inactive published version must never reach the student portal.
  const isPublished = plan?.status === 'PUBLISHED';
  const isLegacyActive = plan?.status == null;
  if (!plan || Number(plan.is_active) !== 1 || (!isPublished && !isLegacyActive)) return null;

  return {
    title: text(plan.title) || 'Plano alimentar',
    goal: text(plan.goal),
    strategy: text(plan.strategy),
    status: isPublished ? 'PUBLISHED' : null,
    meals: safeJsonArray(plan.meals ?? plan.meals_json).map(presentMeal),
    substitutions: safeJsonArray(plan.substitutions ?? plan.substitutions_json),
    observations: text(plan.observations ?? plan.notes),
    hydration: plan.hydration ?? publicValue(plan.hydration_json, ''),
    supplements: plan.supplements ?? publicValue(plan.supplements_json, []),
    adherence_rules: safeJsonArray(plan.adherence_rules ?? plan.adherence_rules_json),
    // Legacy portal fields remain public aliases while clients migrate to observations.
    notes: text(plan.observations ?? plan.notes),
    whatsapp_message: text(plan.whatsapp_message),
    updated_at: plan.published_at ?? plan.updated_at ?? null,
  };
}
