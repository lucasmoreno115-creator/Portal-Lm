import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const htmlFile = 'public/admin-premium-workspace.html';
const runtimeFiles = ['admin-premium-workspace.js', 'public/admin-premium-workspace.js', 'public/assets/js/admin-premium-workspace.js'];
const cssFiles = ['admin-premium-workspace.css', 'public/admin-premium-workspace.css', 'public/assets/css/admin-premium-workspace.css'];

test('F3.3.4 markup exposes three accessible lifecycle queues and preserves check-ins', async () => {
  const html = await readFile(htmlFile, 'utf8');
  for (const [id, heading] of [['onboardingQueue', 'onboardingQueueHeading'], ['underReviewQueue', 'underReviewQueueHeading'], ['readyToReleaseQueue', 'readyToReleaseQueueHeading']]) {
    assert.match(html, new RegExp(`id="${id}"[\\s\\S]*?aria-labelledby="${heading}"`));
  }
  assert.doesNotMatch(html, /<h3>Prioridades<\/h3>|id="anamnesisItems"/);
  assert.match(html, />Aguardando anamnese<\/span>/);
  assert.match(html, /id="checkinsOperationalPanel"[\s\S]*?id="checkinItems"/);
});

test('F3.3.4 runtime consumes only canonical lifecycle queues for anamnesis rendering', async () => {
  const source = await readFile(runtimeFiles[0], 'utf8');
  assert.match(source, /const queues = data\.anamnesis\.queues/);
  for (const queue of ['onboarding', 'underReview', 'readyToRelease']) assert.match(source, new RegExp(`items: queues\\.${queue}`));
  assert.doesNotMatch(source, /renderOperationalItems\([^\n]*data\.anamnesis\.items/);
  for (const message of ['Nenhum aluno aguardando anamnese.', 'Nenhum planejamento em preparação.', 'Nenhum aluno aguardando liberação.']) assert.match(source, new RegExp(message.replace('.', '\\.')));
  assert.match(source, /recordActions\(student\.studentId\)/);
  assert.match(source, /Math\.max\(0, total - visibleItems\.length\)/);
  assert.match(source, /focusOperationalPanel\('onboardingQueue', 'onboardingQueueHeading'\)/);
  assert.match(source, /data\.checkins\.withoutRecentResponse === null \? 'Pendente de definição'/);
  assert.deepEqual([...source.matchAll(/api\('([^']+)'/g)].map((match) => match[1]).sort(), ['/api/admin/premium/workspace/students', '/api/admin/premium/workspace/summary'].sort());
});

test('F3.3.4 official runtime and responsive CSS copies remain byte-identical', async () => {
  const runtimes = await Promise.all(runtimeFiles.map((file) => readFile(file)));
  assert.ok(runtimes.slice(1).every((copy) => copy.equals(runtimes[0])));
  const styles = await Promise.all(cssFiles.map((file) => readFile(file)));
  assert.ok(styles.slice(1).every((copy) => copy.equals(styles[0])));
  const css = styles[0].toString();
  for (const selector of ['.operational-queues', '.operational-queue-head', '.operational-queue-title', '.operational-queue-count', '.operational-queue-list', '.operational-queue-more']) assert.match(css, new RegExp(selector.replace('.', '\\.')));
  assert.match(css, /@media\(max-width:520px\)[^{]*\{[^}]*\.operational-queue/);
});
