import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CHECKS, closureStatus } from '../scripts/qa-premium-stability-regression-closure.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('F4.3 closure gate has every mandatory stability domain and executable evidence', () => {
  assert.deepEqual(Object.keys(CHECKS), [
    'lifecycle', 'workspace', 'anamnesis', 'nutrition', 'progression', 'weeklyFeedback',
    'deactivation', 'reactivation', 'projectLmIsolation',
  ]);
  for (const files of Object.values(CHECKS)) {
    assert.ok(files.length > 0);
    for (const file of files) assert.equal(existsSync(path.join(root, file)), true, `${file} must exist`);
  }
});

test('F4.3 closure gate is binary and fails closed', () => {
  const passed = Object.fromEntries(Object.keys(CHECKS).map((name) => [name, 'PASSED']));
  assert.equal(closureStatus(passed), 'VALIDATED');
  assert.equal(closureStatus({ ...passed, nutrition: 'FAILED' }), 'NOT_VALIDATED');
  assert.equal(closureStatus({ ...passed, lifecycle: 'ENVIRONMENT_BLOCKED' }), 'NOT_VALIDATED');
});
