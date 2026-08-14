#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AUDIT = 'tests/lm-premium-security-audit.test.mjs';
const LIFECYCLE = 'tests/lm-premium-lifecycle-e2e-closure.test.mjs';
const NUTRITION = 'tests/lm-premium-nutrition-student-parity-e2e.test.mjs';
const FEEDBACK = 'tests/lm-premium-professional-review-e2e.test.mjs';
const FEEDBACK_DTO = 'tests/lm-premium-weekly-feedback-public-contract.test.mjs';
const ANAMNESIS = 'tests/lm-premium-legacy-contracts.test.mjs';

// F5.2 deliberately reuses the finite F5.0/F4 evidence instead of opening a new audit.
export const CHECKS = Object.freeze({
  authentication: [AUDIT],
  studentIsolation: [AUDIT, FEEDBACK],
  adminAuthorization: [AUDIT, FEEDBACK, ANAMNESIS],
  nutritionPrivacy: [AUDIT, NUTRITION],
  progressionOwnership: [AUDIT],
  weeklyFeedbackOwnership: [FEEDBACK, FEEDBACK_DTO],
  anamnesisAuthorization: [ANAMNESIS],
  lifecycleAuthorization: [LIFECYCLE, ANAMNESIS],
  deactivationReactivation: [LIFECYCLE],
  massAssignment: [AUDIT, ANAMNESIS],
  storedXss: [AUDIT],
  sensitiveDtos: [AUDIT, FEEDBACK_DTO],
  projectLmIsolation: [LIFECYCLE, FEEDBACK],
});

export function closureStatus(checks) {
  return Object.values(checks).every((result) => result === 'PASSED') ? 'VALIDATED' : 'NOT_VALIDATED';
}

export function buildReport(fileResults) {
  const checks = Object.fromEntries(Object.entries(CHECKS).map(([name, files]) => [
    name,
    files.every((file) => fileResults[file] === 'PASSED') ? 'PASSED' : 'FAILED',
  ]));
  return { executionMode: 'SECURITY_REGRESSION_CLOSURE', status: closureStatus(checks), checks };
}

export function runClosure() {
  const files = [...new Set(Object.values(CHECKS).flat())];
  const fileResults = {};
  for (const file of files) {
    const execution = spawnSync(process.execPath, ['--test', file], { cwd: root, encoding: 'utf8' });
    fileResults[file] = execution.status === 0 ? 'PASSED' : 'FAILED';
    if (execution.stdout) process.stderr.write(execution.stdout);
    if (execution.stderr) process.stderr.write(execution.stderr);
  }

  const report = buildReport(fileResults);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'VALIDATED') process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runClosure();
