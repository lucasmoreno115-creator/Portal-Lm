import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeStudentPlan } from '../workers/api.js';

const lmAccessSource = fs.readFileSync(new URL('../public/assets/js/lm-access.js', import.meta.url), 'utf8');
const context = vm.createContext({
  localStorage: { getItem: () => '' },
  sessionStorage: { setItem: () => {} },
  window: { location: { href: '' } },
  document: { querySelector: () => null }
});
vm.runInContext(`${lmAccessSource}\nglobalThis.__normalizeUserPlan = normalizeUserPlan;`, context);
const normalizeUserPlan = context.__normalizeUserPlan;

const cases = [
  ['premium', 'premium'],
  ['PREMIUM', 'premium'],
  ['projeto_lm', 'projeto_lm'],
  ['', 'premium'],
  [null, 'premium'],
  ['foo', 'premium'],
  ['premium_v2', 'premium']
];

test('normalizeUserPlan keeps valid plans and never maps unknown values to projeto_lm', () => {
  for (const [input, expected] of cases) {
    assert.equal(normalizeUserPlan(input), expected);
  }
});

test('normalizeStudentPlan keeps valid plans and never maps unknown values to projeto_lm', () => {
  for (const [input, expected] of cases) {
    assert.equal(normalizeStudentPlan(input), expected);
  }
});
