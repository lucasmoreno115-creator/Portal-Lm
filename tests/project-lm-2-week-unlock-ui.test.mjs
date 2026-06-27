import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const lm2State = await readFile('public/assets/js/project-lm-2-state.js', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');
const v5Html = await readFile('public/project-lm-v5.html', 'utf8');
const premiumHtml = await readFile('anamnese-premium.html', 'utf8');
const adminHtml = await readFile('admin.html', 'utf8');

test('LM 2.0 Home renderiza CTA CONTINUAR PARA SEMANA 2', () => {
  assert.match(lm2App, /week_1_complete/);
  assert.match(lm2App, /Parabéns\./);
  assert.match(lm2App, /Você concluiu sua primeira semana\./);
  assert.match(lm2App, /CONTINUAR PARA SEMANA 2/);
  assert.match(lm2App, /data-route="\$\{state\.next_action === 'week_1_complete' \? 'week-complete'/);
});

test('LM 2.0 week-complete renderiza mensagem de celebração', () => {
  assert.match(lm2Router, /'week-complete': \{ path: '#week-complete'/);
  for (const text of ['Você não precisou ser perfeito.', 'Você precisou continuar.', 'Nos dias bons, você continuou.', 'Nos dias difíceis, você também encontrou uma forma de continuar.', 'E isso é o que realmente gera resultado.', 'IR PARA SEMANA 2']) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
});

test('LM 2.0 week-2 oficial existe e state acompanha Semana 2', () => {
  assert.match(lm2Router, /'week-2': \{ path: '#week-2'/);
  for (const text of ['Semana 2', 'Dias difíceis fazem parte.', 'Como continuar quando o dia sai do controle', 'Qual situação costuma fazer você abandonar o plano?', 'Quando essa situação acontecer novamente, qual será sua resposta mínima?', 'SALVAR REFLEXÃO', 'SALVAR RESPOSTA']) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  assert.match(lm2State, /week_2_status: null/);
  assert.match(lm2State, /week_2_video_completed: false/);
  assert.match(lm2State, /week_2_reflection_completed: false/);
  assert.match(lm2State, /week_2_response_completed: false/);
  assert.match(lm2State, /week_2_completed: false/);
  assert.match(lm2State, /week_3_available: false/);
});

test('LM 2.0 Home renderiza CTA CONTINUAR PARA SEMANA 3 quando Semana 2 conclui', () => {
  assert.match(lm2App, /week_2_complete/);
  assert.match(lm2App, /Você concluiu a Semana 2\./);
  assert.match(lm2App, /CONTINUAR PARA SEMANA 3/);
  assert.match(lm2App, /data-route="\$\{state\.next_action === 'week_1_complete' \? 'week-complete' : state\.next_action === 'week_2_complete' \? 'week-2-complete'/);
});

test('LM 2.0 week-2-complete renderiza celebração e week-3-placeholder existe', () => {
  assert.match(lm2Router, /'week-2-complete': \{ path: '#week-2-complete'/);
  assert.match(lm2Router, /'week-3-placeholder': \{ path: '#week-3-placeholder'/);
  for (const text of ['Você continuou nos dias difíceis.', 'continuar mesmo quando o dia não saiu como planejado.', 'Você precisou encontrar uma resposta mínima.', 'IR PARA SEMANA 3', 'As mudanças começam antes da balança', 'Você já está mudando. Talvez apenas ainda não consiga enxergar tudo.', 'Olhe além da balança', 'Qual mudança você percebe em você desde que iniciou o Projeto LM?', 'Perceber sua evolução fortalece sua confiança.', 'VOLTAR PARA HOME']) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
});

test('LM 2.0 week-3-complete replica padrão de conclusão para Semana 4', () => {
  assert.match(lm2Router, /'week-3-complete': \{ path: '#week-3-complete'/);
  assert.match(lm2Router, /'week-4-placeholder': \{ path: '#week-4-placeholder'/);
  assert.match(lm2State, /week_3_video_completed: false/);
  assert.match(lm2State, /week_3_reflection_completed: false/);
  assert.match(lm2State, /week_3_response_completed: false/);
  assert.match(lm2State, /week_3_completed: false/);
  for (const text of ['Semana 3 concluída.', 'Você percebeu que evolução vai muito além da balança.', 'As pequenas mudanças que aconteceram nas últimas semanas são o que tornam os grandes resultados possíveis.', 'Continue observando esses sinais.', 'Eles mostram que você está construindo uma rotina capaz de durar.', 'Continuar para a Semana 4']) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  assert.match(lm2App, /isWeek3Completed/);
  assert.match(lm2App, /data-route="week-4-placeholder"/);
});

test('LM 2.0 week-4-placeholder foi substituído pelo conteúdo oficial da Semana 4', () => {
  assert.match(lm2Router, /'week-4-placeholder': \{ path: '#week-4-placeholder'/);
  assert.match(lm2State, /week_4_video_completed: false/);
  assert.match(lm2State, /week_4_reflection: ''/);
  assert.match(lm2State, /week_4_reflection_completed: false/);
  assert.match(lm2State, /week_4_minimum_response: ''/);
  assert.match(lm2State, /week_4_response_completed: false/);
  assert.match(lm2State, /week_4_completed: false/);
  for (const text of [
    'Continue mesmo sem motivação',
    'O que sustenta seus resultados não é a motivação. É a direção que você escolhe seguir.',
    'Motivação é passageira.',
    'Direção permanece.',
    'Você termina preparado para continuar.',
    'O que você leva daqui?',
    'O que você quer continuar fazendo quando este programa terminar?',
    'Qual será sua resposta mínima para seguir em frente nos dias difíceis?',
    'Você não precisa fazer tudo perfeitamente.',
    'Precisa apenas continuar.',
    'Sempre que surgirem dias difíceis, lembre-se da direção que escolheu seguir.'
  ]) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  assert.doesNotMatch(lm2App, /Semana 4 será liberada em breve\./);
});


test('LM 2.0 week-4-complete reutiliza conclusão e navega para Program Completion oficial', () => {
  assert.match(lm2Router, /'week-4-complete': \{ path: '#week-4-complete'/);
  assert.match(lm2Router, /'program-completion': \{ path: '#program-completion'/);
  for (const text of [
    'Semana 4 concluída.',
    'Você chegou ao fim das quatro semanas do Projeto LM.',
    'Mais importante do que terminar este programa foi aprender que continuar é uma habilidade que pode ser construída.',
    'Os dias difíceis ainda existirão.',
    'Mas agora você sabe que eles não significam recomeçar.',
    'Eles significam apenas ajustar a rota e seguir em frente.',
    'Finalizar programa',
    'Parabéns por chegar até aqui.',
    'O mais importante não foi terminar quatro semanas.',
    'Foi construir a capacidade de continuar.',
    'Durante este programa você descobriu que:',
    'Recomeçar não precisa fazer parte da sua rotina.',
    'Dias difíceis não significam fracasso.',
    'A evolução acontece antes da balança mostrar resultados.',
    'A direção é mais importante do que a motivação.',
    'Essas quatro ideias são a base para continuar evoluindo.',
    'O programa termina aqui.',
    'Mas a sua direção continua.',
    'Você não precisa mais provar que consegue começar.',
    'Agora sabe que consegue continuar.',
    'Concluir Projeto LM'
  ]) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  assert.match(lm2App, /isWeek4Completed/);
  assert.match(lm2App, /data-route="program-completion"/);
  assert.match(lm2App, /routeTo\(root, 'week-4-complete'\)/);
});

test('LM 2.0 Program Completion registra conclusão e navega para Premium Bridge placeholder', () => {
  assert.match(lm2Router, /'premium-bridge': \{ path: '#premium-bridge'/);
  assert.match(lm2State, /program_completed: false/);
  assert.match(lm2App, /data-complete-program/);
  assert.match(lm2App, /program_completed: true/);
  assert.match(lm2App, /routeTo\(root, 'premium-bridge'\)/);
  assert.match(lm2App, /Premium Bridge/);
  assert.match(lm2App, /Placeholder/);
});

test('V5, Premium e Admin permanecem intactos', () => {
  assert.doesNotMatch(v5Html, /week-complete|week-2|CONTINUAR PARA SEMANA 2/);
  assert.doesNotMatch(premiumHtml, /week-complete|week-2|CONTINUAR PARA SEMANA 2/);
  assert.doesNotMatch(adminHtml, /week-complete|week-2|CONTINUAR PARA SEMANA 2/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
