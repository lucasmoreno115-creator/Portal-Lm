import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalSurfaces, collectPremiumStudentUxEvidence } from '../scripts/qa-premium-student-ux-audit.mjs';

test('F6.0 inventories the finite canonical Premium student surface', async () => {
  const evidence = await collectPremiumStudentUxEvidence();
  assert.equal(Object.keys(canonicalSurfaces).length, 7);
  assert.equal(evidence.checks.allCanonicalSurfacesExist, true);
  assert.deepEqual(evidence.viewports.map(({ width, height }) => [width, height]), [[390, 844], [1440, 900]]);
});

test('Home CTA destinations and approved weekly questionnaire are deterministic', async () => {
  const evidence = await collectPremiumStudentUxEvidence();
  assert.equal(evidence.checks.homeLocalDestinationsExist, true);
  assert.equal(evidence.checks.weeklyFeedbackApprovedQuestionnaire, true);
  assert.equal(evidence.checks.weeklyFeedbackHasHomeReturn, true);
});

test('audit evidence preserves lifecycle, responsive, and mutation sanity coverage', async () => {
  const evidence = await collectPremiumStudentUxEvidence();
  assert.equal(evidence.checks.allSurfacesDeclareViewport, true);
  assert.equal(evidence.checks.lifecycleCopyPresent, true);
  assert.equal(evidence.checks.mutationDoubleSubmitGuards, true);
  assert.deepEqual(evidence.frozenFindingIds, ['UX-PREM-001', 'UX-PREM-002', 'UX-PREM-003', 'UX-PREM-004']);
});
