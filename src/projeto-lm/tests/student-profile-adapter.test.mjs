import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { adaptStudentProfile } from '../adapters/studentProfileAdapter.js';
import { generateStudentNutritionPlan } from '../services/generateStudentNutritionPlan.js';
import { generateStudentWorkoutPlan } from '../services/generateStudentWorkoutPlan.js';

const monday = '2026-07-06T10:00:00.000Z';
const wednesday = '2026-07-08T10:00:00.000Z';
const sunday = '2026-07-12T10:00:00.000Z';

function text(value) {
  return JSON.stringify(value).toLowerCase();
}

test('adapter resolve perfis nutricionais por sexo e peso', () => {
  assert.equal(adaptStudentProfile({ sex: 'female', weight: 69.9 }, { date: monday }).nutritionInput.profile, 'M1');
  assert.equal(adaptStudentProfile({ sex: 'female', weight: 70 }, { date: monday }).nutritionInput.profile, 'M2');
  assert.equal(adaptStudentProfile({ sex: 'female', weight: 90 }, { date: monday }).nutritionInput.profile, 'M3');
  assert.equal(adaptStudentProfile({ sex: 'male', weight: 79.9 }, { date: monday }).nutritionInput.profile, 'H1');
  assert.equal(adaptStudentProfile({ sex: 'male', weight: 80 }, { date: monday }).nutritionInput.profile, 'H2');
  assert.equal(adaptStudentProfile({ sex: 'male', weight: 100 }, { date: monday }).nutritionInput.profile, 'H3');
});

test('adapter aceita sexo em português e abreviado', () => {
  assert.equal(adaptStudentProfile({ sexo: 'feminino', peso: 72 }, { date: monday }).studentMeta.sex, 'female');
  assert.equal(adaptStudentProfile({ sexo: 'masculino', peso: 85 }, { date: monday }).studentMeta.sex, 'male');
  assert.equal(adaptStudentProfile({ sex: 'F', weight: 72 }, { date: monday }).nutritionInput.profile, 'M2');
  assert.equal(adaptStudentProfile({ sex: 'M', weight: 85 }, { date: monday }).nutritionInput.profile, 'H2');
});

test('adapter usa fallback nutricional correto quando faltam peso ou sexo', () => {
  assert.equal(adaptStudentProfile({ sex: 'female' }, { date: monday }).nutritionInput.profile, 'M2');
  assert.equal(adaptStudentProfile({ sex: 'male' }, { date: monday }).nutritionInput.profile, 'H2');
  assert.equal(adaptStudentProfile({ weight: 85 }, { date: monday }).nutritionInput.profile, 'M2');
});

test('adapter resolve perfil e dia de treino pela estrutura semanal', () => {
  assert.equal(adaptStudentProfile({ sex: 'female', weight: 72 }, { date: monday }).workoutInput.profile, 'GYM_FEMALE');
  assert.equal(adaptStudentProfile({ sex: 'male', weight: 85 }, { date: monday }).workoutInput.profile, 'GYM_MALE');
  assert.equal(adaptStudentProfile({ sex: 'female' }, { date: monday }).workoutInput.day, 'lower_a');
  assert.equal(adaptStudentProfile({ sex: 'male' }, { date: monday }).workoutInput.day, 'upper_a');
  assert.equal(adaptStudentProfile({ sex: 'female' }, { date: wednesday }).workoutInput.day, 'cardio_day');
});

test('adapter trata domingo, data ausente e sexo ausente com fallback seguro', () => {
  assert.equal(adaptStudentProfile({ sex: 'female' }, { date: sunday }).workoutInput.rest_day, true);
  assert.equal(Boolean(adaptStudentProfile({ sex: 'female' }).workoutInput.day), true);
  const fallback = adaptStudentProfile({}, { date: monday });
  assert.equal(fallback.workoutInput.profile, 'GYM_FEMALE');
  assert.equal(fallback.workoutInput.day, 'lower_a');
});

test('adapter concentra refeições padrão e metadados sem misturar códigos na UI', () => {
  const result = adaptStudentProfile({ nome: 'Ana', sexo: 'feminino', objetivo: 'emagrecimento', peso: 72 }, { date: monday });
  assert.deepEqual(result.nutritionInput, {
    profile: 'M2',
    breakfast: 'breakfast_01',
    lunch: 'lunch_01',
    snack: 'snack_01',
    dinner: 'dinner_01'
  });
  assert.deepEqual(result.studentMeta, { name: 'Ana', sex: 'female', goal: 'emagrecimento' });
});

test('services retornam apenas student_visible e não expõem códigos internos', () => {
  const adapted = adaptStudentProfile({ sex: 'female', weight: 72 }, { date: monday });
  const nutrition = generateStudentNutritionPlan(adapted.nutritionInput);
  const workout = generateStudentWorkoutPlan(adapted.workoutInput);

  assert.equal(Object.hasOwn(nutrition, 'profile_internal'), false);
  assert.equal(Object.hasOwn(workout, 'profile_internal'), false);
  assert.equal(text(nutrition).includes('m2'), false);
  assert.equal(text(workout).includes('gym_female'), false);
  assert.equal(text(workout).includes('lower_a'), false);
});

test('bridge retorna student_visible e não expõe códigos internos na saída final', async () => {
  const events = [];
  global.window = {
    location: { hostname: 'example.com' },
    dispatchEvent: (event) => events.push(event.type)
  };
  global.CustomEvent = class CustomEvent {
    constructor(type) { this.type = type; }
  };

  await import(`${pathToFileURL(process.cwd() + '/public/assets/js/project-lm-engine-services.js').href}?student-profile-adapter-test=${Date.now()}`);

  const nutrition = global.window.ProjectLmEngineServices.getStudentNutritionPlan({ sex: 'female', weight: 72 }, { date: monday });
  const workout = global.window.ProjectLmEngineServices.getStudentWorkoutPlan({ sex: 'male', weight: 85 }, { date: monday });
  const finalText = text({ nutrition, workout });

  assert.equal(events.includes('project-lm-engine-services-ready'), true);
  assert.equal(Object.hasOwn(nutrition, 'profile_internal'), false);
  assert.equal(Object.hasOwn(workout, 'profile_internal'), false);
  for (const code of ['m2', 'h2', 'gym_female', 'gym_male', 'lower_a', 'upper_a', 'breakfast_01']) {
    assert.equal(finalText.includes(code), false);
  }
});

test('student adapter usa refeições selecionadas quando válidas', () => {
  const result = adaptStudentProfile(
    { sex: 'female', weight: 72 },
    { date: monday, selectedMeals: { breakfast: 'breakfast_02', lunch: 'lunch_03', snack: 'snack_03', dinner: 'dinner_02' } }
  );
  assert.deepEqual(result.nutritionInput, {
    profile: 'M2',
    breakfast: 'breakfast_02',
    lunch: 'lunch_03',
    snack: 'snack_03',
    dinner: 'dinner_02'
  });
});

test('student adapter usa fallback quando refeições são inválidas e mantém perfil/workout', () => {
  const result = adaptStudentProfile(
    { sex: 'male', weight: 85 },
    { date: monday, mealSelections: { cafe_da_manha: 'lunch_03', almoco: 'lunch_03', lanche: 'invalid', jantar: 'dinner_02' } }
  );
  assert.deepEqual(result.nutritionInput, {
    profile: 'H2',
    breakfast: 'breakfast_01',
    lunch: 'lunch_03',
    snack: 'snack_01',
    dinner: 'dinner_02'
  });
  assert.deepEqual(result.workoutInput, {
    profile: 'GYM_MALE',
    day: 'upper_a',
    rest_day: false,
    rest_guidance: undefined
  });
});

test('bridge aceita fontes defensivas de seleção e mantém saída final segura', async () => {
  const events = [];
  global.window = {
    location: { hostname: 'example.com' },
    dispatchEvent: (event) => events.push(event.type)
  };
  global.CustomEvent = class CustomEvent {
    constructor(type) { this.type = type; }
  };

  await import(`${pathToFileURL(process.cwd() + '/public/assets/js/project-lm-engine-services.js').href}?meal-selection-bridge-test=${Date.now()}`);

  assert.equal(global.window.ProjectLmEngineServices.resolveStudentProfile({ sex: 'female', weight: 72, selectedMeals: { breakfast: 'breakfast_02' } }, { date: monday }).nutritionInput.breakfast, 'breakfast_02');
  assert.equal(global.window.ProjectLmEngineServices.resolveStudentProfile({ sex: 'female', weight: 72, mealSelections: { almoco: 'lunch_03' } }, { date: monday }).nutritionInput.lunch, 'lunch_03');
  assert.equal(global.window.ProjectLmEngineServices.resolveStudentProfile({ sex: 'female', weight: 72, profile: { selectedMeals: { dinner: 'dinner_02' } } }, { date: monday }).nutritionInput.dinner, 'dinner_02');

  const nutrition = global.window.ProjectLmEngineServices.getStudentNutritionPlan(
    { sex: 'female', weight: 72, selectedMeals: { breakfast: 'breakfast_02', lunch: 'lunch_03', snack: 'snack_03', dinner: 'dinner_02' } },
    { date: monday }
  );
  const finalText = text(nutrition);

  assert.equal(events.includes('project-lm-engine-services-ready'), true);
  assert.equal(Object.hasOwn(nutrition, 'profile_internal'), false);
  for (const code of ['breakfast_02', 'lunch_03', 'snack_03', 'dinner_02']) {
    assert.equal(finalText.includes(code), false);
  }
});
