import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { renderWorkoutPlan, renderWeeklyPlan, renderPlanError } from '../ui/studentPlanRenderers.js';
import { adaptStudentProfile } from '../adapters/studentProfileAdapter.js';
import { generateStudentWorkoutPlan } from '../services/generateStudentWorkoutPlan.js';

const appSource = readFileSync(new URL('../../../public/assets/js/project-lm-2-app.js', import.meta.url), 'utf8');
const forbiddenCodes = ['lower_a', 'upper_a', 'cardio_day', 'rest_day', 'GYM_FEMALE', 'GYM_MALE', 'profile_internal'];

function visibleText(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function createAppContext({ services } = {}) {
  const root = { dataset: {}, innerHTML: '', querySelector: () => null };
  const listeners = {};
  const fakeWindow = {
    localStorage: { getItem: () => 'ok', setItem: () => {} },
    location: { href: '', hostname: 'localhost' },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    addEventListener: (event, handler) => { listeners[event] = handler; },
    ProjectLm2Router: { normalizeRoute: (route) => route, getCurrentRoute: () => 'home', navigate: (route) => route },
    ProjectLm2State: { getState: () => ({ name: 'Aluno', sex: 'female', currentDate: '2026-07-06T10:00:00.000Z', training_plan_id: 'gym_female', continuity_days_count: 2, required_days_count: 5, next_action: 'daily_checkin' }) },
    ProjectLmEngineServices: services
  };
  const fakeDocument = {
    readyState: 'loading',
    querySelector: (selector) => selector === '#project-lm-2-root' ? root : null,
    addEventListener: (event, handler) => { listeners[event] = handler; }
  };
  const context = { window: fakeWindow, document: fakeDocument, console, Error };
  vm.runInNewContext(appSource, context);
  return { app: fakeWindow.ProjectLm2App, root, window: fakeWindow };
}

function engineServices() {
  return {
    getStudentWeeklyPlan: (state) => adaptStudentProfile(state).weeklyPlan,
    getStudentWorkoutPlan: (state) => {
      const { workoutInput, weeklyPlan } = adaptStudentProfile(state);
      if (workoutInput.rest_day) return { rest_day: true, display_name: 'Descanso ativo', guidance: workoutInput.rest_guidance, exercises: [] };
      return generateStudentWorkoutPlan({ ...workoutInput, day: weeklyPlan.today.dayKey });
    },
    renderWeeklyPlan,
    renderWorkoutPlan,
    renderPlanError,
    logPlanError: () => {}
  };
}

test('Home oficial renderiza bloco Hoje e próximos treinos sem códigos internos', () => {
  const { app, root } = createAppContext({ services: engineServices() });
  app.render(root, 'home');
  const text = visibleText(root.innerHTML);

  assert.match(text, /Hoje/);
  assert.match(text, /Inferiores A/);
  assert.match(text, /Esse é o foco do seu treino de hoje/);
  assert.match(text, /Próximos treinos/);
  assert.match(text, /Terça — Superiores A/);

  const lower = root.innerHTML.toLowerCase();
  for (const code of forbiddenCodes) assert.equal(lower.includes(code.toLowerCase()), false, `não deve renderizar ${code}`);
  assert.equal(root.innerHTML.includes('Consultoria Premium'), false, 'home semanal não deve renderizar Consultoria Premium');
});

test('Quarta renderiza Cardio e mobilidade no resumo semanal oficial', () => {
  const services = engineServices();
  const { app, root, window } = createAppContext({ services });
  window.ProjectLm2State.getState = () => ({ name: 'Aluno', sex: 'female', currentDate: '2026-07-08T10:00:00.000Z', continuity_days_count: 2, required_days_count: 5 });
  app.render(root, 'home');
  const text = visibleText(root.innerHTML);

  assert.match(text, /Hoje/);
  assert.match(text, /Cardio e mobilidade/);
  assert.match(text, /40 a 60 minutos em ritmo leve a moderado/);
});

test('Domingo renderiza Descanso no resumo semanal oficial', () => {
  const services = engineServices();
  const { app, root, window } = createAppContext({ services });
  window.ProjectLm2State.getState = () => ({ name: 'Aluno', sex: 'male', currentDate: '2026-07-12T10:00:00.000Z', continuity_days_count: 2, required_days_count: 5 });
  app.render(root, 'home');
  const text = visibleText(root.innerHTML);

  assert.match(text, /Hoje/);
  assert.match(text, /Descanso/);
  assert.match(text, /Hoje é dia de descanso/);
});

test('Tela de treino mantém resumo semanal separado do treino completo do dia', () => {
  const { app, root } = createAppContext({ services: engineServices() });
  app.render(root, 'training');
  const text = visibleText(root.innerHTML);

  assert.match(text, /Hoje/);
  assert.match(text, /Próximos treinos/);
  assert.match(text, /Leg press/);
  assert.match(text, /4 × 10 a 12/);
  assert.match(text, /Progresso futuro/);
});

test('Fallback do resumo semanal não quebra a tela quando engine service não existe', () => {
  const { app, root } = createAppContext({ services: undefined });
  app.render(root, 'home');
  const text = visibleText(root.innerHTML);

  assert.match(text, /Não foi possível carregar o plano semanal agora/);
  assert.match(text, /Projeto LM/);
});
