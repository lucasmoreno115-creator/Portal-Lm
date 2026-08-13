import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const runtime = () => readFile('public/admin-premium-workspace.js', 'utf8');

test('pending-items has its own semantic operational surface and replaces the unavailable card', async () => {
  const html = await readFile('public/admin-premium-workspace.html', 'utf8');
  assert.match(html, /id="pendingItemsCard"[\s\S]*?Pendências abertas[\s\S]*?id="pendingItemsValue"[\s\S]*?id="pendingItemsHint"/);
  assert.match(html, /id="pendingItemsOperationalPanel"[\s\S]*?aria-labelledby="pendingItemsOperationalHeading"[\s\S]*?Pendências operacionais[\s\S]*?id="pendingItemsSummary"[\s\S]*?id="pendingItemsList"[^>]*aria-live="polite"[^>]*aria-busy="true"/);
  assert.match(html, /id="anamnesisOperationalHeading" tabindex="-1">Fluxo de anamnese/);
  assert.doesNotMatch(html, /Check-ins em aberto|Pendências prioritárias/);
});

test('pending totals come from summary counts while items preserve presenter order and fields', async () => {
  const source = await runtime();
  assert.match(source, /const pendingItems = data\.pendingItems \|\| \{ open: 0, high: 0, items: \[\] \}/);
  assert.match(source, /setDashboardCard\('pendingItemsValue'[\s\S]*?pendingItems\.open/);
  assert.match(source, /pendingItems\.high > 0[\s\S]*?de alta prioridade[\s\S]*?Nenhuma de alta prioridade/);
  assert.match(source, /items\.forEach\(\(pending\) =>/);
  assert.doesNotMatch(source, /items\.(?:sort|reverse)\(/);
  assert.match(source, /pending\.studentName \|\| 'Aluno Premium'/);
  assert.match(source, /pending\.typeLabel \|\| 'Pendência operacional'/);
  assert.match(source, /pending\.priorityLabel \|\| 'Normal'/);
  assert.match(source, /open - items\.length/);
  assert.match(source, /Nenhuma pendência operacional no momento\./);
});

test('presenter CTAs are rendered only after same-origin Premium admin URL validation', async () => {
  const source = await runtime();
  assert.match(source, /url\.origin === window\.location\.origin && url\.pathname\.startsWith\('\/admin-premium-'\)/);
  assert.match(source, /pendingAction\(pending\.cta, 'button pending-primary-action'\)/);
  assert.match(source, /pendingAction\(pending\.recordCta, 'button pending-record-action'\)/);
  assert.doesNotMatch(source, /pending\.type\s*===/);
  assert.doesNotMatch(source, /pending-items\/[^'`]*resolve/);
  assert.doesNotMatch(source, /api\('\/api\/admin\/premium\/workspace\/pending-items/);
  assert.match(source, /api\('\/api\/admin\/premium\/workspace\/summary'\)/);
  for (const unsafe of ['javascript:', 'data:']) assert.equal(new URL(unsafe + (unsafe === 'javascript:' ? 'alert(1)' : 'text/plain,x'), 'https://portal.test').origin === 'https://portal.test', false);
});

test('loading and errors use the summary reload path without optimistic removal', async () => {
  const source = await runtime();
  assert.match(source, /Carregando pendências\.\.\./);
  assert.match(source, /Não foi possível carregar as pendências\./);
  assert.match(source, /retryBlock\(\$\('pendingItemsList'\), 'Não foi possível carregar as pendências\.', loadWorkspaceSummary\)/);
  assert.doesNotMatch(source, /pendingItems\.(?:splice|pop|shift)\(/);
});
