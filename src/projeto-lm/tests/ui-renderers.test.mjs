import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStudentNutritionPlan } from '../services/generateStudentNutritionPlan.js';
import { generateStudentWorkoutPlan } from '../services/generateStudentWorkoutPlan.js';
import { renderNutritionPlan, renderWorkoutPlan } from '../ui/studentPlanRenderers.js';

const forbiddenNutrition = ['calories', 'macros', 'profile_internal', 'M2', 'breakfast_01', 'lunch_01', 'snack_03', 'dinner_01'];
const forbiddenWorkout = ['rir', 'rpe', '%', 'percentual', 'profile_internal', 'GYM_FEMALE', 'lower_a'];

function nutritionPlan() {
  return generateStudentNutritionPlan({ profile: 'M2', breakfast: 'breakfast_01', lunch: 'lunch_01', snack: 'snack_03', dinner: 'dinner_01' });
}

function visibleText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('Nutrition UI renderiza refeições, alimentos, quantidades, substituições e Plano B sem dados internos', () => {
  const html = renderNutritionPlan(nutritionPlan());
  const text = visibleText(html);

  assert.match(text, /Café da manhã/);
  assert.match(text, /Almoço/);
  assert.match(text, /Lanche/);
  assert.match(text, /Jantar/);
  assert.match(text, /3 unidades Ovos/);
  assert.match(text, /Trocas disponíveis/);
  assert.match(text, /Iogurte natural/);
  assert.match(text, /Direção/);
  assert.match(text, /Plano B/);
  assert.match(text, /Se o dia sair do plano, não compense/);
  assert.match(html, /lm2-nutrition-meal-card/);
  assert.match(html, /id="lm2-plan-b"/);
  assert.doesNotMatch(text, /Alimentos:/);
  assert.doesNotMatch(text, /Observação/);
  assert.doesNotMatch(text, /Substituições/);
  assert.doesNotMatch(text, /undefined|null|student_notes/);

  const lower = text.toLowerCase();
  for (const forbidden of forbiddenNutrition) {
    assert.equal(lower.includes(forbidden.toLowerCase()), false, `não deve renderizar ${forbidden}`);
  }
});

test('Workout UI renderiza treino, substituições, cardio e progressão sem dados técnicos internos', () => {
  const html = renderWorkoutPlan(generateStudentWorkoutPlan({ profile: 'GYM_FEMALE', day: 'lower_a' }));
  const text = visibleText(html);

  assert.match(text, /Leg press/);
  assert.match(text, /4 × 10 a 12/);
  assert.match(text, /Descanso • 60–90 s/);
  assert.match(text, /Substituição:/);
  assert.match(text, /Agachamento no smith/);
  assert.match(text, /Cardio/);
  assert.match(text, /30 min/);
  assert.match(text, /Progresso futuro/);
  assert.match(text, /aumente um pouco a carga/);
  assert.match(html, /class="lm2-workout-media"/);
  assert.match(html, /src="\/assets\/exercise-library\/leg-press-45\.gif"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /onerror="this\.closest\('\.lm2-workout-media'\)\?\.remove\(\)"/);
  assert.doesNotMatch(html, /src="undefined"|src=""|undefined/);

  const lower = text.toLowerCase();
  for (const forbidden of forbiddenWorkout) {
    assert.equal(lower.includes(forbidden.toLowerCase()), false, `não deve renderizar ${forbidden}`);
  }
});

test('Workout UI mantém exercício sem GIF sem imagem quebrada e sem alterar prescrição', () => {
  const html = renderWorkoutPlan({
    display_name: 'Treino sem mídia',
    exercises: [
      {
        name: 'Exercício manual',
        sets: 3,
        reps: '12',
        rest: '60 segundos',
        observations: 'Controle o movimento.',
        substitutions: ['Opção segura']
      }
    ]
  });
  const text = visibleText(html);

  assert.doesNotMatch(html, /lm2-workout-media|<img/);
  assert.doesNotMatch(html, /undefined|src=""/);
  assert.match(text, /Exercício manual/);
  assert.match(text, /3 × 12/);
  assert.match(text, /Descanso • 60 s/);
  assert.match(text, /Controle o movimento/);
  assert.match(text, /Substituição: Opção segura/);
});

test('UI renderiza fallback simples quando o plano não está disponível', () => {
  assert.match(renderNutritionPlan(null), /Não foi possível carregar este plano agora/);
  assert.match(renderWorkoutPlan(null), /Não foi possível carregar este plano agora/);
});

test('Weekly UI renderiza plano semanal sem códigos internos visíveis', () => {
  const weeklyPlan = {
    today: { label: 'Cardio e mobilidade', title: 'Cardio e mobilidade', type: 'cardio', rest_day: false },
    nextWorkouts: [
      { label: 'Quinta', title: 'Inferiores B', type: 'strength' },
      { label: 'Sexta', title: 'Superiores B', type: 'strength' },
      { label: 'Sábado', title: 'Cardio opcional', type: 'cardio' }
    ]
  };
  return import('../ui/studentPlanRenderers.js').then(({ renderWeeklyPlan }) => {
    const text = visibleText(renderWeeklyPlan(weeklyPlan));
    assert.match(text, /Hoje/);
    assert.match(text, /Cardio e mobilidade/);
    assert.match(text, /40 a 60 minutos/);
    assert.match(text, /Quinta — Inferiores B/);
    const lower = text.toLowerCase();
    for (const code of ['gym_female', 'gym_male', 'lower_a', 'upper_a', 'cardio_day', 'rest_day']) {
      assert.equal(lower.includes(code), false, `não deve renderizar ${code}`);
    }
  });
});
