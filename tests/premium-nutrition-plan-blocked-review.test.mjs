import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertReadOnlySql, buildReport, contentFingerprint, resolvePortalPlan, reviewStudent } from '../scripts/diagnose-premium-nutrition-plan-blocked-review.mjs';
import { PORTAL_NUTRITION_PLAN_QUERIES } from '../workers/premium/repositories/d1-nutrition-plan-repository.js';

const student = { student_id: 'student-1', email: 'private@example.test' };
const legacy = (id, updated_at = '2026-01-01T00:00:00Z') => ({ id, student_email: student.email, status: null, is_active: 1, created_at: updated_at, updated_at, meals_json: '[{"items":[{},{}]}]' });
const draft = { id: 'draft-1', student_id: student.student_id, student_email: student.email, status: 'DRAFT', is_active: 0, updated_at: '2026-02-01T00:00:00Z', meals_json: '[{"foods":[{}]}]' };

test('uses the exact portal student-id filters and order when a modern current plan exists', () => {
  const modern = { id: 'current', student_id: student.student_id, status: 'PUBLISHED', is_active: 1, version_number: 2, published_at: '2026-02-01T00:00:00Z' };
  const selected = resolvePortalPlan({ student, plans: [{ ...modern, id: 'old', version_number: 1, published_at: '2026-03-01T00:00:00Z' }, modern] });
  assert.equal(selected.plan.id, 'current'); assert.equal(selected.sql, PORTAL_NUTRITION_PLAN_QUERIES.byStudentId); assert.match(selected.sql, /is_active = 1/); assert.match(selected.sql, /version_number DESC/);
});
test('reports a portal ORDER BY tie as non-reproducible rather than choosing a record', () => {
  const plan = { id: 'one', student_id: student.student_id, status: 'PUBLISHED', is_active: 1, version_number: 2, published_at: '2026-02-01T00:00:00Z' };
  assert.equal(resolvePortalPlan({ student, plans: [plan, { ...plan, id: 'two' }] }).rule, 'student_id_order_tie');
});
test('multiple legacy plans are reviewed only when no workspace plan is linked, and the real portal selection is not invented', () => {
  const review = reviewStudent({ student, plans: [legacy('old'), legacy('new')] });
  assert.equal(review.current_category, 'AMBIGUOUS_MULTIPLE_PLANS'); assert.equal(review.decision_suggested, 'PORTAL_PLAN_NOT_REPRODUCED'); assert.equal(review.portal_effective_plan, null);
});
test('legacy plus modern DRAFT is included and exposes only sanitized structural comparison', () => {
  const review = reviewStudent({ student, plans: [legacy('legacy'), draft] });
  assert.equal(review.current_category, 'MODERN_DRAFT_CONFLICT'); assert.equal(review.drafts, 1); assert.equal(review.plans.find((plan) => plan.modern_draft).food_item_count, 1); assert.match(review.plans[0].content_fingerprint, /^[a-f0-9]{64}$/);
});
test('excludes workspace-linked, draft-only, no-plan, and inactive students by scope', () => {
  const linked = { ...legacy('legacy'), student_id: student.student_id, status: 'PUBLISHED', version_number: 1, published_at: '2026-01-01T00:00:00Z' };
  assert.equal(reviewStudent({ student, plans: [legacy('legacy'), linked] }), null);
  assert.equal(reviewStudent({ student, plans: [draft] }), null);
  assert.equal(reviewStudent({ student, plans: [] }), null);
  const report = buildReport({ students: [{ ...student, access_status: 'INACTIVE' }], plansByStudent: new Map([[student.student_id, [legacy('legacy')]]]) });
  assert.equal(report.summary.blocked_students_reviewed, 0);
});
test('report has no PII, food content, or raw plan IDs and counts only aggregate outcomes', () => {
  const report = buildReport({ students: [student], plansByStudent: new Map([[student.student_id, [legacy('raw-plan'), legacy('other')]]]) });
  const output = JSON.stringify(report); assert.doesNotMatch(output, /private@example\.test|raw-plan|items|foods/i); assert.equal(report.summary.blocked_students_reviewed, 1); assert.equal(report.summary.portal_plan_not_reproduced, 1);
});
test('fingerprints are deterministic, non-reversible hashes, and SQL is strictly read-only', () => {
  assert.equal(contentFingerprint(legacy('x')), contentFingerprint(legacy('y'))); assert.match(contentFingerprint(legacy('x')), /^[a-f0-9]{64}$/);
  for (const sql of ['INSERT INTO x VALUES(1)', 'UPDATE x SET x=1', 'DELETE FROM x', 'CREATE TABLE x(a)', 'PRAGMA table_info(x)', 'SELECT 1; SELECT 2']) assert.throws(() => assertReadOnlySql(sql), /DIAGNOSTIC_WRITE_SQL_BLOCKED/);
  assert.equal(assertReadOnlySql('WITH x AS (SELECT 1) SELECT * FROM x'), 'WITH x AS (SELECT 1) SELECT * FROM x');
});
test('workflow is main-only, production-scoped, token-dedicated, retained one day, and aggregate-only', () => {
  const workflow = fs.readFileSync('.github/workflows/premium-nutrition-plan-blocked-review.yml', 'utf8');
  assert.match(workflow, /workflow_dispatch/); assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/); assert.match(workflow, /environment: production/); assert.match(workflow, /CLOUDFLARE_D1_API_TOKEN/); assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN/); assert.match(workflow, /retention-days: 1/); assert.match(workflow, /Object\.entries\(summary\)/); assert.doesNotMatch(workflow, /\b(?:UPDATE|INSERT|DELETE|CREATE|ALTER)\b/i);
});
test('documentation records the endpoint, function, SQL, and resolved-identity fallback behavior', () => {
  const doc = fs.readFileSync('docs/premium-nutrition-plan-blocked-review.md', 'utf8'); assert.match(doc, /\/api\/portal\/nutrition-plan/); assert.match(doc, /findCurrentByStudentId/); assert.match(doc, /no email fallback/i);
});
