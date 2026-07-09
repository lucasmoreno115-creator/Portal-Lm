import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { adaptStudentProfile } from '../adapters/studentProfileAdapter.js';
import { generateStudentWorkoutPlan } from '../services/generateStudentWorkoutPlan.js';
import { generateStudentNutritionPlan } from '../services/generateStudentNutritionPlan.js';
import { renderNutritionPlan, renderPlanError, renderWeeklyPlan, renderWorkoutPlan } from '../ui/studentPlanRenderers.js';

const appSource = readFileSync(new URL('../../../public/assets/js/project-lm-2-app.js', import.meta.url), 'utf8');
const officialProfiles = ['M1', 'M2', 'M3', 'H1', 'H2', 'H3'];
const profileFixtures = {
  M1: { profile: 'M1', sex: 'female', weight_kg: 62 },
  M2: { profile: 'M2', sex: 'female', weight_kg: 78 },
  M3: { profile: 'M3', sex: 'female', weight_kg: 94 },
  H1: { profile: 'H1', sex: 'male', weight_kg: 74 },
  H2: { profile: 'H2', sex: 'male', weight_kg: 88 },
  H3: { profile: 'H3', sex: 'male', weight_kg: 104 }
};
const routes = ['home', 'training', 'home', 'nutrition', 'home', 'library', 'home', 'week-1', 'home'];

function visibleText(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function createEngineServices(counters) {
  return {
    getStudentWeeklyPlan: (state) => adaptStudentProfile(state).weeklyPlan,
    getStudentWorkoutPlan: (state) => {
      counters.workout += 1;
      const { workoutInput, weeklyPlan } = adaptStudentProfile(state);
      if (workoutInput.rest_day) return { rest_day: true, display_name: 'Descanso ativo', guidance: workoutInput.rest_guidance, exercises: [] };
      return generateStudentWorkoutPlan({ ...workoutInput, day: weeklyPlan.today.dayKey });
    },
    getStudentNutritionPlan: (state) => {
      counters.nutrition += 1;
      return generateStudentNutritionPlan(adaptStudentProfile(state).nutritionInput);
    },
    renderNutritionPlan,
    renderWeeklyPlan,
    renderWorkoutPlan,
    renderPlanError,
    logPlanError: (error) => { throw error; },
    resolveWeeklyConsistency: () => ({
      title: 'Semana em andamento',
      body: 'Continue com a próxima ação simples.',
      progressLabel: '2 de 5 dias de continuidade',
      nextAction: 'Registrar o dia de hoje.'
    })
  };
}

function createAppContext(state, services) {
  const root = { dataset: {}, innerHTML: '', querySelector: () => null };
  const consoleErrors = [];
  const fakeWindow = {
    localStorage: { getItem: () => 'ok', setItem: () => {} },
    location: { href: '', hostname: 'app.local' },
    fetch: async () => { throw new Error('network should not be used in engine smoke test'); },
    addEventListener: () => {},
    ProjectLm2Router: { normalizeRoute: (route) => route, getCurrentRoute: () => 'home', navigate: (route) => route },
    ProjectLm2State: {
      getState: () => state,
      updateState: (patch) => Object.assign(state, patch)
    },
    ProjectLmEngineServices: services
  };
  const fakeDocument = {
    readyState: 'loading',
    querySelector: (selector) => selector === '#project-lm-2-root' ? root : null,
    addEventListener: () => {}
  };
  const fakeConsole = { ...console, error: (...args) => consoleErrors.push(args), warn: (...args) => consoleErrors.push(args) };
  vm.runInNewContext(appSource, { window: fakeWindow, document: fakeDocument, console: fakeConsole, Error });
  return { app: fakeWindow.ProjectLm2App, root, consoleErrors };
}

function makeState(profile) {
  const fixture = profileFixtures[profile];
  return {
    ...fixture,
    nutrition_plan_id: profile,
    name: `Aluno ${profile}`,
    goal: 'criar consistência',
    currentDate: '2026-07-06T10:00:00.000Z',
    current_week: 1,
    home_loaded: true,
    onboarding_completed: true,
    continuity_days_count: 2,
    required_days_count: 5,
    next_action: 'daily_checkin',
    plan_b: {
      unable_to_train: 'Fazer caminhada curta.',
      overeating: 'Voltar na próxima refeição.',
      no_motivation: 'Executar a menor ação possível.'
    }
  };
}

function assertNoTechnicalLeak(html) {
  const lower = html.toLowerCase();
  assert.equal(lower.includes('undefined'), false);
  assert.equal(lower.includes('null'), false);
  assert.equal(lower.includes('stack trace'), false);
  assert.equal(lower.includes('syntaxerror'), false);
}

function assertNoEmptyOrTechnicalState(html) {
  assertNoTechnicalLeak(html);
  assert.equal(visibleText(html).length > 80, true);
}

test('Smoke Beta: seis perfis oficiais navegam por Home, Treino, Alimentação, Biblioteca e Plano B sem bloqueios', () => {
  for (const profile of officialProfiles) {
    const counters = { workout: 0, nutrition: 0 };
    const state = makeState(profile);
    const services = createEngineServices(counters);
    const { app, root, consoleErrors } = createAppContext(state, services);

    for (const route of routes) {
      app.render(root, route);
      assert.equal(root.dataset.lm2Route, route, `${profile}: rota ${route} deve ser preservada`);
      assertNoEmptyOrTechnicalState(root.innerHTML);
      assert.match(visibleText(root.innerHTML), /Plano da Semana|Plano Alimentar|Plano alimentar|Biblioteca|Semana 1/);
    }

    assert.equal(consoleErrors.length, 0, `${profile}: não deve registrar erro de console`);
    assert.equal(state.profile, profile, `${profile}: profile deve permanecer persistido no estado simulado`);
    assert.equal(counters.workout, 1, `${profile}: treino deve ser resolvido apenas na tela de treino`);
    assert.equal(counters.nutrition, 1, `${profile}: alimentação deve ser resolvida apenas na tela de alimentação`);
  }
});

test('Smoke Beta: treino e alimentação renderizados batem exatamente com os objetos dos engines oficiais', () => {
  for (const profile of officialProfiles) {
    const state = makeState(profile);
    const { workoutInput, nutritionInput, weeklyPlan } = adaptStudentProfile(state);
    const workout = generateStudentWorkoutPlan({ ...workoutInput, day: weeklyPlan.today.dayKey });
    const nutrition = generateStudentNutritionPlan(nutritionInput);

    assert.equal(workoutInput.day, weeklyPlan.today.dayKey, `${profile}: Home/Weekly Plan e Meu Treino devem apontar para o mesmo dayKey oficial`);
    assert.equal(workout.exercises.every((exercise) => exercise.name && exercise.sets && exercise.reps && exercise.rest && exercise.observations), true);
    assert.deepEqual(nutrition.meals.map((meal) => meal.slot_name), ['Café da manhã', 'Almoço', 'Lanche', 'Jantar']);
    assert.equal(nutrition.meals.every((meal) => meal.foods.every((food) => food.name && food.quantity && food.substitutions.length > 0)), true);
    assert.equal(nutrition.meals.every((meal) => meal.plan_b.length > 0 && meal.notes), true);

    const weeklyHtml = renderWeeklyPlan(weeklyPlan);
    const workoutHtml = renderWorkoutPlan(workout);
    const nutritionHtml = renderNutritionPlan(nutrition);
    assert.match(visibleText(weeklyHtml), new RegExp(weeklyPlan.today.title));
    assert.match(visibleText(workoutHtml), new RegExp(workout.exercises[0].name));
    assert.match(visibleText(nutritionHtml), /Café da manhã/);
    assertNoEmptyOrTechnicalState(weeklyHtml + workoutHtml + nutritionHtml);
  }
});

test('Smoke Beta: estados especiais mostram mensagem amigável e ação de retry sem detalhes técnicos', () => {
  assert.match(visibleText(renderPlanError()), /Não foi possível carregar este plano agora/);
  assertNoTechnicalLeak(renderPlanError());

  const counters = { workout: 0, nutrition: 0 };
  const state = { ...makeState('M2'), home_loaded: false };
  const services = createEngineServices(counters);
  const { app, root } = createAppContext(state, services);
  app.render(root, 'home');
  assert.match(visibleText(root.innerHTML), /Sua missão de hoje|Plano da Semana|Começar meu treino/);
  assertNoEmptyOrTechnicalState(root.innerHTML);
});
