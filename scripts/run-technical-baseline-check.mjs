import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function runTechnicalBaselineCheck({
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  runner = spawnSync
} = {}) {
  const artifacts = path.join(root, 'artifacts', 'baseline');
  for (const name of ['baseline-report.json', 'baseline-report.md', 'regression-budget-report.json', 'regression-budget-report.md']) {
    rmSync(path.join(artifacts, name), { force: true });
  }

  const run = script => {
    const child = runner(process.execPath, [path.join(root, 'scripts', script)], { cwd: root, stdio: 'inherit' });
    return Number.isInteger(child?.status) ? child.status : 1;
  };
  const generationExitCode = run('generate-technical-baseline.mjs');
  // This is deliberately unconditional: a FAILED required command is data that
  // the comparator must report, rather than a reason to hide later regressions.
  const comparisonExitCode = run('check-technical-regression-budget.mjs');
  return generationExitCode === 0 && comparisonExitCode === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runTechnicalBaselineCheck();
}
