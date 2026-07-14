import { safeJsonArray } from '../domain/nutrition-plan-schema.js';
export function presentPublicNutritionPlan(plan) {
  if (!plan || plan.status === 'DRAFT' || plan.status === 'ARCHIVED') return null;
  return { title: plan.title, goal: plan.goal, strategy: plan.strategy, meals: safeJsonArray(plan.meals ?? plan.meals_json), substitutions: safeJsonArray(plan.substitutions ?? plan.substitutions_json), adherence_rules: safeJsonArray(plan.adherence_rules ?? plan.adherence_rules_json), notes: plan.notes ?? '', whatsapp_message: plan.whatsapp_message ?? '', updated_at: plan.published_at ?? plan.updated_at ?? null };
}
