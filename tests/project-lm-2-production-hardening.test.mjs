import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const lm2State = await readFile('public/assets/js/project-lm-2-state.js', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');

test('LM 2.0 state safely serializes, deserializes and normalizes persisted values', () => {
  assert.match(lm2State, /const storageKey = 'project-lm-2-state'/);
  assert.match(lm2State, /readStoredState/);
  assert.match(lm2State, /JSON\.parse\(raw\)/);
  assert.match(lm2State, /persistState/);
  assert.match(lm2State, /JSON\.stringify\(nextState\)/);
  assert.match(lm2State, /sanitizeState/);
  assert.match(lm2State, /let state = sanitizeState\(\{ \.\.\.readStoredState\(\), home_loaded: false, direction_loaded: false \}\)/);
  assert.match(lm2State, /safe\.current_week = normalizeNumber\(safe\.current_week, initialState\.current_week, 1, 4\)/);
  assert.match(lm2State, /safe\.weight_kg = safe\.weight_kg === null \|\| safe\.weight_kg === '' \? null : normalizeNumber\(safe\.weight_kg, null, 1, 500\)/);
  assert.match(lm2State, /for \(const field of booleanFields\) safe\[field\] = Boolean\(safe\[field\]\)/);
});

test('LM 2.0 app hardens invalid routes, duplicate boot listeners and existing accessibility hooks', () => {
  assert.match(lm2Router, /normalizeRoute/);
  assert.match(lm2App, /route = global\.ProjectLm2Router\.normalizeRoute\(route\)/);
  assert.match(lm2App, /root\.dataset\.lm2BoundClick/);
  assert.match(lm2App, /root\.dataset\.lm2BoundHashchange/);
  assert.match(lm2App, /aria-pressed="\$\{isSelected \? 'true' : 'false'\}"/);
  assert.match(lm2App, /aria-label="Como gostaria de ser chamado\?"/);
  assert.match(lm2App, /aria-label="Qual seu peso atual\?"/);
});
