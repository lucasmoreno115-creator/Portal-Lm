import test from 'node:test';
import assert from 'node:assert/strict';
import { generateNutritionPlan } from '../engines/nutrition/engine.js';
import { generateWorkoutPlan } from '../engines/training/engine.js';
import { generateStudentNutritionPlan } from '../services/generateStudentNutritionPlan.js';
import { generateStudentWorkoutPlan } from '../services/generateStudentWorkoutPlan.js';

const nutritionInput = (profile) => ({
  profile,
  breakfast: 'breakfast_01',
  lunch: 'lunch_01',
  snack: 'snack_03',
  dinner: 'dinner_01'
});

function visibleText(value) {
  return JSON.stringify(value).toLowerCase();
}

test('Nutrition Engine gera planos M1, M2, H1 e H2 sem dados internos visíveis', () => {
  for (const profile of ['M1', 'M2', 'H1', 'H2']) {
    const output = generateNutritionPlan(nutritionInput(profile));
    assert.equal(output.product, 'Projeto LM');
    assert.equal(output.profile_internal, profile);
    assert.equal(output.student_visible.meals.length, 4);

    const text = visibleText(output.student_visible);
    assert.equal(text.includes('calories'), false);
    assert.equal(text.includes('macros'), false);
    assert.equal(text.includes('profile_internal'), false);
    assert.equal(output.student_visible.meals.every((meal) => meal.plan_b.length > 0), true);
    assert.equal(output.student_visible.meals.every((meal) => meal.foods.every((food) => food.substitutions.length > 0)), true);
  }
});

test('Nutrition service retorna apenas student_visible', () => {
  const plan = generateStudentNutritionPlan(nutritionInput('M2'));
  assert.equal(Boolean(plan.meals), true);
  assert.equal(Object.hasOwn(plan, 'profile_internal'), false);
});

test('Workout Engine gera lower_a feminino com cardio pós-treino de 30 minutos', () => {
  const output = generateWorkoutPlan({ profile: 'GYM_FEMALE', day: 'lower_a' });
  assert.equal(output.product, 'Projeto LM');
  assert.equal(output.type, 'workout_plan');
  assert.equal(output.student_visible.display_name, 'Lower A');
  assert.equal(output.student_visible.cardio.minutes, 30);
  assert.equal(output.progression_internal.basis, 'last_set');
});

test('Workout Engine gera upper_a masculino com maior volume inicial para superiores', () => {
  const output = generateWorkoutPlan({ profile: 'GYM_MALE', day: 'upper_a' });
  assert.equal(output.student_visible.display_name, 'Upper A');
  assert.equal(output.student_visible.exercises[0].sets, 4);
  assert.equal(output.student_visible.exercises[1].sets, 4);
});

test('Workout Engine gera Cardio Day com 40–60 minutos e mobilidade', () => {
  const output = generateWorkoutPlan({ profile: 'GYM_FEMALE', day: 'cardio_day' });
  assert.equal(output.type, 'cardio_day');
  assert.equal(output.student_visible.cardio.minutes, '40–60 minutos');
  assert.equal(Boolean(output.student_visible.cardio.mobility), true);
});

test('Workout Engine não expõe RIR, RPE ou percentuais', () => {
  const outputs = [
    generateWorkoutPlan({ profile: 'GYM_FEMALE', day: 'lower_a' }),
    generateWorkoutPlan({ profile: 'GYM_MALE', day: 'upper_a' }),
    generateWorkoutPlan({ profile: 'GYM_FEMALE', day: 'cardio_day' })
  ];

  for (const output of outputs) {
    const text = visibleText(output.student_visible);
    assert.equal(text.includes('rir'), false);
    assert.equal(text.includes('rpe'), false);
    assert.equal(text.includes('%'), false);
    assert.equal(text.includes('percentual'), false);
  }
});

test('Workout service retorna apenas student_visible', () => {
  const plan = generateStudentWorkoutPlan({ profile: 'GYM_MALE', day: 'upper_a' });
  assert.equal(Boolean(plan.exercises), true);
  assert.equal(Object.hasOwn(plan, 'profile_internal'), false);
});
