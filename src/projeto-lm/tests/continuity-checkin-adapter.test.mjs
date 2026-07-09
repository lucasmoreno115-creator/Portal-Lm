import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptContinuityCheckin, normalizeCheckinBoolean, normalizeContinuityCheckin } from '../adapters/continuityCheckinAdapter.js';
import { renderContinuityCheckin } from '../ui/studentPlanRenderers.js';

function visibleText(value) {
  return JSON.stringify(value).toLowerCase();
}

const forbidden = ['falhou', 'fracassou', 'compensar', 'cardio extra', 'restrição', 'restricao'];

test('normaliza valores booleanos aceitos pelo check-in de continuidade', () => {
  assert.equal(normalizeCheckinBoolean(true), true);
  assert.equal(normalizeCheckinBoolean(false), false);
  assert.equal(normalizeCheckinBoolean('sim'), true);
  assert.equal(normalizeCheckinBoolean('não'), false);
  assert.equal(normalizeCheckinBoolean('nao'), false);
  assert.equal(normalizeCheckinBoolean('yes'), true);
  assert.equal(normalizeCheckinBoolean('no'), false);
  assert.equal(normalizeCheckinBoolean(1), true);
  assert.equal(normalizeCheckinBoolean(0), false);
});

test('aceita entrada em inglês, português e ausência de campos sem quebrar', () => {
  assert.deepEqual(normalizeContinuityCheckin({ workoutDone: 'yes', nutritionDone: 'no', usedPlanB: 1, hardDay: true }), {
    workout: true,
    nutrition: false,
    planB: true,
    hardDay: true
  });
  assert.deepEqual(normalizeContinuityCheckin({ treinoFeito: 'sim', alimentacaoFeita: 'não', planoB: 'sim', diaDificil: 'sim' }), {
    workout: true,
    nutrition: false,
    planB: true,
    hardDay: true
  });
  assert.deepEqual(normalizeContinuityCheckin(), {
    workout: false,
    nutrition: false,
    planB: false,
    hardDay: false
  });
});

test('treino e alimentação resolvem strong_day', () => {
  const result = adaptContinuityCheckin({ workoutDone: true, nutritionDone: true });
  assert.equal(result.status, 'strong_day');
  assert.equal(result.score, 2);
  assert.match(result.message.title, /Hoje foi um dia forte/);
});

test('ações isoladas resolvem continued', () => {
  assert.equal(adaptContinuityCheckin({ workoutDone: true }).status, 'continued');
  assert.equal(adaptContinuityCheckin({ nutritionDone: true }).status, 'continued');
  assert.equal(adaptContinuityCheckin({ usedPlanB: true }).status, 'continued');
});

test('Plano B em dia difícil resolve plan_b_win', () => {
  const result = adaptContinuityCheckin({ usedPlanB: true, hardDay: true });
  assert.equal(result.status, 'plan_b_win');
  assert.equal(result.score, 1);
  assert.match(result.message.title, /Plano B também é vitória/);
});

test('dia difícil sem ações resolve recovery_day', () => {
  const result = adaptContinuityCheckin({ hardDay: true });
  assert.equal(result.status, 'recovery_day');
  assert.equal(result.score, 0);
  assert.match(result.message.title, /Dia difícil identificado/);
});

test('nada feito resolve missed_day sem punição', () => {
  const result = adaptContinuityCheckin({});
  assert.equal(result.status, 'missed_day');
  assert.equal(result.score, 0);
  assert.match(result.message.title, /Um dia não define o processo/);
});

test('não retorna linguagem punitiva nem recomenda punição', () => {
  const scenarios = [
    { workoutDone: true, nutritionDone: true },
    { workoutDone: true },
    { nutritionDone: true },
    { usedPlanB: true },
    { usedPlanB: true, hardDay: true },
    { hardDay: true },
    {}
  ];

  for (const scenario of scenarios) {
    const text = visibleText(adaptContinuityCheckin(scenario));
    for (const word of forbidden) assert.equal(text.includes(word), false, `não deve conter ${word}`);
  }
});

test('renderer mostra mensagem amigável sem campos internos', () => {
  const result = adaptContinuityCheckin({ workoutDone: true, nutritionDone: false, usedPlanB: true });
  const html = renderContinuityCheckin(result.student_visible);

  assert.match(html, /Check-in de continuidade/);
  assert.match(html, /Você continuou/);
  assert.match(html, /Próximo passo/);
  assert.equal(html.includes('score'), false);
  assert.equal(html.includes('status'), false);
  assert.equal(html.includes('completed'), false);
});

test('bridge resolveContinuityCheckin retorna apenas student_visible', async () => {
  const listeners = {};
  globalThis.window = {
    location: { hostname: 'localhost' },
    dispatchEvent: (event) => { listeners[event.type] = event; }
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type) { this.type = type; }
  };

  await import(`../../../public/assets/js/project-lm-engine-services.js?continuity=${Date.now()}`);
  const output = globalThis.window.ProjectLmEngineServices.resolveContinuityCheckin({ treinoFeito: 'sim', alimentacaoFeita: 'não' });

  assert.deepEqual(Object.keys(output).sort(), ['body', 'nextAction', 'title']);
  assert.equal(Object.hasOwn(output, 'score'), false);
  assert.equal(Object.hasOwn(output, 'status'), false);
  assert.equal(Object.hasOwn(output, 'completed'), false);
  assert.match(output.title, /Você continuou/);
  assert.ok(listeners['project-lm-engine-services-ready']);

  delete globalThis.window;
  delete globalThis.CustomEvent;
});
