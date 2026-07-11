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
    getStudentWorkoutProgram: (state) => adaptStudentProfile(state).weeklyPlan.week.filter((day) => day.dayKey !== 'rest_day').map((day) => ({ ...day, exerciseCount: day.type === 'cardio' ? 0 : 4, duration: day.type === 'cardio' ? '40–60 min' : '40–50 min' })),
    getStudentWorkoutPlan: (state, options = {}) => {
      const { workoutInput, weeklyPlan } = adaptStudentProfile(state);
      const day = options.day || weeklyPlan.today.dayKey;
      if (workoutInput.rest_day && !options.day) return { rest_day: true, display_name: 'Descanso ativo', guidance: workoutInput.rest_guidance, exercises: [] };
      return generateStudentWorkoutPlan({ ...workoutInput, rest_day: false, day });
    },
    renderWeeklyPlan,
    renderWorkoutPlan,
    renderPlanError,
    logPlanError: () => {}
  };
}

test('Home oficial renderiza Command Center com Hoje e Plano da Semana sem códigos internos', () => {
  const { app, root } = createAppContext({ services: engineServices() });
  app.render(root, 'home');
  const text = visibleText(root.innerHTML);

  assert.match(text, /Hoje/);
  assert.match(text, /Inferiores A/);
  assert.match(text, /Sua missão de hoje/);
  assert.match(text, /Começar meu treino/);
  assert.match(text, /Plano da Semana/);
  assert.doesNotMatch(text, /Próximos treinos/);

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

test('Tela de treino mantém Plano da Semana compacto separado do treino completo do dia', () => {
  const { app, root } = createAppContext({ services: engineServices() });
  app.render(root, 'training');
  const text = visibleText(root.innerHTML);

  assert.match(text, /Hoje/);
  assert.match(text, /Plano da Semana/);
  assert.match(text, /Leg press/);
  assert.match(text, /4 × 10 a 12/);
  assert.match(text, /Progresso futuro/);
});

test('Fallback do resumo semanal não quebra a tela quando engine service não existe', () => {
  const { app, root } = createAppContext({ services: undefined });
  app.render(root, 'home');
  const text = visibleText(root.innerHTML);

  assert.match(text, /Plano da Semana/);
  assert.match(text, /Seu treino/);
});


test('Tela de treino mantém CTA principal e abre Meu Programa de Treinos em Bottom Sheet acessível', () => {
  const services = engineServices();
  const state = { name: 'Aluno', sex: 'female', currentDate: '2026-07-06T10:00:00.000Z', training_program_sheet_open: true, continuity_days_count: 2, required_days_count: 5 };
  const { app, root, window } = createAppContext({ services });
  window.ProjectLm2State.getState = () => state;
  app.render(root, 'training');
  const programText = visibleText(root.innerHTML);

  assert.match(programText, /Treino de Hoje/);
  assert.match(programText, /Começar treino/);
  assert.match(programText, /Meu Programa de Treinos/);
  assert.match(programText, /Veja todos os treinos da sua semana/);
  assert.match(root.innerHTML, /role="dialog"/);
  assert.match(root.innerHTML, /aria-modal="true"/);
  assert.match(root.innerHTML, /aria-labelledby="lm2-workout-program-sheet-title"/);
  assert.match(root.innerHTML, /aria-label="Fechar meu programa de treinos"/);
  assert.match(programText, /Consulte qualquer treino da sua semana/);
  assert.match(programText, /✓ Inferiores A/);
  assert.match(programText, /Hoje • 4 exercícios • 40–50 min/);
  assert.match(programText, /Superiores A/);
  assert.match(programText, /Terça • 4 exercícios • 40–50 min/);
  assert.match(programText, /Cardio e mobilidade/);
  assert.match(programText, /Quarta • 40–60 min/);
  assert.match(programText, /Inferiores B/);
  assert.match(programText, /Superiores B/);

  const lower = programText.toLowerCase();
  for (const code of forbiddenCodes) assert.equal(lower.includes(code.toLowerCase()), false, `não deve renderizar ${code}`);
});

test('Treino selecionado pelo Bottom Sheet reutiliza renderWorkoutPlan e mostra navegação contextual', () => {
  const services = engineServices();
  const state = { name: 'Aluno', sex: 'female', currentDate: '2026-07-06T10:00:00.000Z', training_view: 'program-workout', training_selected_day: 'lower_b', training_program_sheet_open: false, continuity_days_count: 2, required_days_count: 5 };
  const { app, root, window } = createAppContext({ services });
  window.ProjectLm2State.getState = () => state;
  app.render(root, 'training');
  const workoutText = visibleText(root.innerHTML);

  assert.match(workoutText, /← Meu Programa/);
  assert.match(workoutText, /Inferiores B/);
  assert.match(workoutText, /Treino de quinta/);
  assert.match(workoutText, /Leg press/);
  assert.match(workoutText, /Começar treino/);
});

test('Handlers do Bottom Sheet fecham por botão, backdrop e Escape', () => {
  assert.match(appSource, /data-close-workout-program/);
  assert.match(appSource, /data-workout-program-backdrop/);
  assert.match(appSource, /event\.key === 'Escape'/);
  assert.match(appSource, /closeWorkoutProgramSheet\(root\)/);
});
