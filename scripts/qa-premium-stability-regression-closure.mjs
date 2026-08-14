#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CHECKS = Object.freeze({
  lifecycle: ['tests/lm-premium-lifecycle-e2e-closure.test.mjs'],
  workspace: ['tests/lm-premium-workspace-operational-e2e.test.mjs', 'tests/lm-premium-workspace-dashboard-navigation.test.mjs'],
  anamnesis: ['tests/lm-premium-anamnesis-professional-review-e2e.test.mjs'],
  nutrition: ['tests/lm-premium-nutrition-student-parity-e2e.test.mjs'],
  progression: ['tests/lm-premium-progression-persistence-e2e.test.mjs'],
  weeklyFeedback: ['tests/lm-premium-professional-review-e2e.test.mjs', 'tests/lm-premium-student-feedback-delivery-ui.test.mjs', 'tests/lm-premium-weekly-feedback-ux.test.mjs'],
  deactivation: ['tests/lm-premium-student-deactivation-e2e.test.mjs'],
  reactivation: ['tests/lm-premium-student-reactivation-e2e.test.mjs'],
  projectLmIsolation: ['tests/lm-premium-lifecycle-e2e-closure.test.mjs', 'tests/lm-premium-workspace-operational-e2e.test.mjs'],
});

export function closureStatus(results) {
  return Object.values(results).every((result) => result === 'PASSED') ? 'VALIDATED' : 'NOT_VALIDATED';
}

export function runClosure() {
  const checks = {};
  for (const [name, files] of Object.entries(CHECKS)) {
    const execution = spawnSync(process.execPath, ['--test', ...files], { cwd: root, encoding: 'utf8' });
    checks[name] = execution.status === 0 ? 'PASSED' : 'FAILED';
    if (execution.stdout) process.stderr.write(execution.stdout);
    if (execution.stderr) process.stderr.write(execution.stderr);
  }

  const report = {
    executionMode: 'STABILITY_REGRESSION_CLOSURE',
    status: closureStatus(checks),
    checks,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'VALIDATED') process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runClosure();
