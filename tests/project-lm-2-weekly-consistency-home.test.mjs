import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const rawAppSource = readFileSync(new URL('../public/assets/js/project-lm-2-app.js', import.meta.url), 'utf8');
const appSource = rawAppSource
  .replace(/^\(function initializeProjectLm2App\(global, document\) \{/, '')
  .replace(/\n\}\)\(window, document\);\s*$/, '');

const forbidden = ['weeklyStatus', 'continuityDays', 'totalDays', 'counts', 'strongDays', 'continuedDays', 'planBDays', 'recoveryDays', 'missedDays', 'score', 'status', 'completed', 'Consultoria Premium'];

function makeCheckins(statuses) {
  return statuses.map((status, index) => ({ date: `2026-07-${String(index + 1).padStart(2, '0')}`, status }));
}

function renderHome({ checkins, withoutEngine = false } = {}) {
  const document = { addEventListener() {}, querySelector() { return null; } };
  const global = {
    localStorage: { getItem() { return 'session'; } },
    location: { href: '', pathname: '/projeto-lm.html' },
    addEventListener() {},
    ProjectLm2State: { getState() { return {}; }, updateState() {} }
  };
  if (!withoutEngine) {
    global.ProjectLmEngineServices = {
      resolveWeeklyConsistency(input = []) {
        const continuity = input.filter((item) => ['strong_day', 'continued', 'plan_b_win'].includes(item.status)).length;
        if (!input.length) return { title: 'Sua semana começa com uma ação.', body: 'Registre o próximo passo simples para começar a construir continuidade.', progressLabel: '0 de 0 dias de continuidade', nextAction: 'Registre uma ação simples hoje.' };
        if (continuity >= 5) return { title: 'Você venceu a semana.', body: 'Você manteve continuidade em pelo menos 5 dos últimos 7 dias. Esse é o objetivo do Projeto LM.', progressLabel: `${continuity} de ${input.length} dias de continuidade`, nextAction: 'Mantenha o básico hoje. Não complique.' };
        if (continuity >= 3) return { title: 'Você ainda está no jogo.', body: 'A semana não precisa ser perfeita. Agora o foco é transformar mais um dia em continuidade.', progressLabel: `${continuity} de ${input.length} dias de continuidade`, nextAction: 'Escolha uma ação simples hoje e proteja o básico.' };
        return { title: 'Sem punição. Sem recomeço do zero.', body: 'O próximo passo é recuperar uma ação simples hoje.', progressLabel: `${continuity} de ${input.length} dias de continuidade`, nextAction: 'Faça uma ação mínima agora: água, próxima refeição ou movimento leve.' };
      }
    };
  }
  return vm.runInNewContext(`${appSource}; renderHomeScreen(state);`, { global, document, Date, state: { onboarding_completed: true, next_action: 'daily_checkin', continuity_days_count: 0, required_days_count: 7, checkins } });
}

test('Home renderiza continuidade semanal on_track 5/7 sem quebrar Hoje e atalhos', () => {
  const html = renderHome({ checkins: makeCheckins(['strong_day', 'continued', 'plan_b_win', 'strong_day', 'continued', 'missed_day', 'recovery_day']) });
  assert.match(html, /Continuidade da semana/);
  assert.match(html, /5 de 7 dias de continuidade/);
  assert.match(html, /Você venceu a semana\./);
  assert.match(html, /Hoje, registre como você continuou\./);
  assert.match(html, /Treino/);
  assert.match(html, /Plano Alimentar/);
  assert.match(html, /Biblioteca/);
  for (const word of forbidden) assert.doesNotMatch(html, new RegExp(word));
});

test('Home renderiza continuidade semanal building 3/7', () => {
  const html = renderHome({ checkins: makeCheckins(['strong_day', 'continued', 'plan_b_win', 'missed_day', 'recovery_day', 'missed_day', 'recovery_day']) });
  assert.match(html, /3 de 7 dias de continuidade/);
  assert.match(html, /Você ainda está no jogo\./);
});

test('Home renderiza no_data quando não há histórico', () => {
  const html = renderHome({ checkins: [] });
  assert.match(html, /0 de 0 dias de continuidade/);
  assert.match(html, /Sua semana começa com uma ação\./);
});

test('Home usa fallback amigável sem engine', () => {
  const html = renderHome({ checkins: makeCheckins(['strong_day']), withoutEngine: true });
  assert.match(html, /Continuidade da semana/);
  assert.match(html, /Sua semana começa com uma ação\./);
  assert.match(html, /Registre o próximo passo simples para começar a construir continuidade\./);
});
