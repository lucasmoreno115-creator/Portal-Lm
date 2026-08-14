import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootPage = readFileSync('portal-premium-weekly-feedback.html', 'utf8');
const publicPage = readFileSync('public/portal-premium-weekly-feedback.html', 'utf8');
const legacyPages = [readFileSync('portal-checkin.html', 'utf8'), readFileSync('public/portal-checkin.html', 'utf8')];
const runtime = readFileSync('public/assets/js/portal-premium-weekly-feedback.js', 'utf8');
const professionalRuntime = readFileSync('public/admin-premium-student-record.js', 'utf8');

for (const [name, page] of [['root', rootPage], ['public', publicPage]]) {
  test(`${name} Weekly Feedback has canonical Home navigation in every dynamic state`, () => {
    assert.match(page, /<a class="secondary-link weekly-feedback-home" href="portal-premium-home\.html">← Voltar para Home<\/a>/);
    assert.equal((page.match(/Voltar para Home/g) || []).length, 1);
    assert.ok(page.indexOf('Voltar para Home') < page.indexOf('<h1>Check-in semanal</h1>'));
    assert.match(page, /const ANSWER_FIELDS=Object\.freeze\(\[/);
    const collectionContract = page.match(/const ANSWER_FIELDS=.*?;function formatPortalDate/s)?.[0] || '';
    assert.doesNotMatch(collectionContract, /waist|Cintura|abdomen|abdominal/i);
  });
}

test('new student form and explicit serialization omit removed measurement fields', () => {
  for (const page of legacyPages) {
    assert.doesNotMatch(page, /name=['"]waist['"]/i);
    assert.doesNotMatch(page, /name=['"](?:abdomen|abdominal|abdominalCircumference)['"]/i);
  }
  assert.match(runtime, /Object\.fromEntries\(ANSWER_FIELDS\.map/);
  assert.doesNotMatch(runtime, /FormData\(form\)/);
  assert.doesNotMatch(runtime, /(?:form\.elements|requestKey).*waist/);
});

test('historical waist remains readable and professional review omits it only when absent', () => {
  assert.doesNotMatch(professionalRuntime, /['"]Cintura['"],\s*['"]waist['"]/);
});
