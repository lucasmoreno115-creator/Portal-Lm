import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const home = fs.readFileSync('portal-premium-home.html', 'utf8');

test('Premium home prioritizes planning objectives and consultant guidance', () => {
  assert.match(home, /Objetivos do planejamento/);
  assert.match(home, /Meu conselho para você/);
  assert.doesNotMatch(home, /Status da semana|status-week-section|statusLabel|weeklyStatus/);
  assert.doesNotMatch(home, /Jornada LM|journey-card-v6|journeyList/);
  assert.ok(home.indexOf('Objetivos do planejamento') < home.indexOf('Meu conselho para você'));
  assert.match(home, /api\('\/portal\/weekly-plan'\)/);
  assert.doesNotMatch(home, /api\('\/portal\/checkins'\)/);
});
