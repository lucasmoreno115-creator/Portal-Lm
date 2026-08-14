import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildReport, CHECKS, closureStatus } from '../scripts/qa-premium-security-regression-closure.mjs';

const root = path.resolve(import.meta.dirname, '..');
const mandatory = [
  'authentication', 'studentIsolation', 'adminAuthorization', 'nutritionPrivacy',
  'progressionOwnership', 'weeklyFeedbackOwnership', 'anamnesisAuthorization',
  'lifecycleAuthorization', 'deactivationReactivation', 'massAssignment', 'storedXss',
  'sensitiveDtos', 'projectLmIsolation',
];

test('F5.2 closure contains every mandatory security boundary and executable evidence', () => {
  assert.deepEqual(Object.keys(CHECKS), mandatory);
  for (const files of Object.values(CHECKS)) {
    assert.ok(files.length > 0);
    for (const file of files) assert.equal(existsSync(path.join(root, file)), true, `${file} must exist`);
  }
});

test('F5.2 closure emits only the required mode/status and passes with complete evidence', () => {
  const files = [...new Set(Object.values(CHECKS).flat())];
  const report = buildReport(Object.fromEntries(files.map((file) => [file, 'PASSED'])));
  assert.equal(report.executionMode, 'SECURITY_REGRESSION_CLOSURE');
  assert.equal(report.status, 'VALIDATED');
  assert.deepEqual(Object.values(report.checks), mandatory.map(() => 'PASSED'));
});

test('F5.2 closure fails closed for failed, blocked, missing, or unexecuted evidence', () => {
  const passed = Object.fromEntries(mandatory.map((name) => [name, 'PASSED']));
  assert.equal(closureStatus(passed), 'VALIDATED');
  for (const result of ['FAILED', 'ENVIRONMENT_BLOCKED', 'NOT_EXECUTED', undefined]) {
    assert.equal(closureStatus({ ...passed, authentication: result }), 'NOT_VALIDATED');
  }
  assert.equal(buildReport({}).status, 'NOT_VALIDATED');
});
