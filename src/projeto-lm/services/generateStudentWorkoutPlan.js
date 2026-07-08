import { generateWorkoutPlan } from '../engines/training/engine.js';

export function generateStudentWorkoutPlan(input) {
  return generateWorkoutPlan(input).student_visible;
}
