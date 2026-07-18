import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const landing = await readFile('portal-premium-onboarding.html', 'utf8');
const gateway = await readFile('portal.html', 'utf8');

test('onboarding é uma landing dedicada, sem módulos ou conteúdo da Home Premium', () => {
  for (const forbidden of ['Meta da semana', 'Jornada LM', 'Acesso rápido', 'Status da semana', 'portal-checkin.html', 'portal-progressao.html', 'portal-plano-alimentar.html']) assert.doesNotMatch(landing, new RegExp(forbidden));
  for (const required of ['Responder minha anamnese', 'Suas informações foram enviadas com sucesso!', 'Seu planejamento está sendo finalizado', 'Seu acompanhamento está pausado', 'Seu acompanhamento foi encerrado']) assert.match(landing, new RegExp(required));
});

test('rota oficial do portal consulta access-state antes de escolher a experiência', () => {
  assert.match(gateway, /\/portal\/premium\/access-state/);
  assert.match(gateway, /portal-premium-onboarding\.html/);
  assert.match(gateway, /portal-premium-home\.html/);
  assert.doesNotMatch(gateway, /Status da semana|Jornada LM|Acesso rápido/);
});
