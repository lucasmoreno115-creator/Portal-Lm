import { generateNutritionPlan } from '../engines/nutrition/engine.js';

export function generateStudentNutritionPlan(input) {
  return generateNutritionPlan(input).student_visible;
}
