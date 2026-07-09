import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const lm2State = await readFile('public/assets/js/project-lm-2-state.js', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');
const v5Html = await readFile('public/project-lm-v5.html', 'utf8');
const premiumHtml = await readFile('anamnese-premium.html', 'utf8');
const adminHtml = await readFile('admin.html', 'utf8');

test('LM 2.0 home consumes progress endpoint and shows 5-day continuity target', () => {
  assert.match(lm2App, /\/api\/project-lm-2\/progress/);
  assert.match(lm2App, /Promise\.all\(\[requestLm2\(api\.home\), requestLm2\(api\.progress\)\]\)/);
  assert.match(lm2App, /lm2-continuity-card/);
  assert.match(lm2App, /\$\{completed\} de \$\{required\} dias concluídos\./);
  assert.match(lm2State, /continuity_days_count: 0/);
  assert.match(lm2State, /required_days_count: 5/);
  assert.match(lm2State, /goal_reached: false/);
  assert.match(lm2State, /today_checkin_completed: false/);
});

test('LM 2.0 daily check-in UI renders options and sends official payload', () => {
  assert.match(lm2Router, /'daily-checkin': \{ path: '#daily-checkin'/);
  assert.match(lm2App, /Como foi seu dia hoje\?/);
  assert.match(lm2App, /Segui minha direção/);
  assert.match(lm2App, /Precisei adaptar/);
  assert.match(lm2App, /Saí da direção/);
  assert.match(lm2App, /REGISTRAR DIA/);
  assert.match(lm2App, /JSON\.stringify\(\{ answer \}\)/);
  assert.match(lm2App, /ProjectLmEngineServices/);
  assert.match(lm2App, /resolveContinuityCheckin\(input\)/);
  assert.match(lm2App, /student_visible|renderContinuityCheckin/);
  assert.match(lm2App, /FAZER CHECK-IN/);
});

test('LM 2.0 daily check-in does not touch V5, Premium or Admin surfaces', () => {
  assert.doesNotMatch(v5Html, /daily-checkin|FAZER CHECK-IN|project-lm-2-app\.js/);
  assert.doesNotMatch(premiumHtml, /daily-checkin|FAZER CHECK-IN|project-lm-2-app\.js/);
  assert.doesNotMatch(adminHtml, /daily-checkin|FAZER CHECK-IN|project-lm-2-app\.js/);
});


test('LM 2.0 daily check-in tests no longer depend on legacy feedback copy', () => {
  assert.doesNotMatch(lm2App, /Dia registrado/);
  assert.doesNotMatch(lm2App, /Você seguiu sua direção/);
  assert.doesNotMatch(lm2App, /Você adaptou/);
  assert.doesNotMatch(lm2App, /Excelente\. Mais um dia construído/);
  assert.doesNotMatch(lm2App, /Você não precisou ser perfeito\. Precisou continuar/);
  assert.doesNotMatch(lm2App, /Tudo bem\. Amanhã você retoma a direção/);
  assert.doesNotMatch(lm2App, /migração temporária|referência de migração/);
});
