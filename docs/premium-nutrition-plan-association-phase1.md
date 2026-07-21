# Premium Nutrition Plan Association — Phase 1

This manually dispatched, production-only operation associates **only** a currently active premium student with exactly one unchanged legacy nutrition plan. It imports candidate classification from `scripts/diagnose-premium-nutrition-plan-candidates.mjs`; it does not duplicate or alter candidate-discovery logic.

## Audit migration and source of truth

Before an `apply` or `rollback`, the runner creates the following dedicated, idempotent audit schema. The DDL is intentionally kept with this narrowly scoped operation so it is independently reviewable; `dry-run` never executes it or any write.

- `premium_nutrition_plan_association_operations` records an operation identifier and creation time.
- `premium_nutrition_plan_association_records` records `operation_id`, internal `plan_id`, previous/new student IDs, a non-reversible plan fingerprint, `applied_at`, and an `APPLIED`/`ROLLED_BACK` status.

The sanitized GitHub artifact is **not** rollback authority. Rollback takes an `operation_id` and queries these D1 audit tables. A non-existent operation, no remaining `APPLIED` records, mismatched current student ID, modern lifecycle status, or changed plan fingerprint blocks that record. Rollback updates the plan with defensive predicates, verifies exactly one changed row, re-reads the plan, then marks the audit record `ROLLED_BACK`.

## Apply safety

The runner creates an audit `PENDING` record before each individual update. Immediately before that update it rechecks: the student is `ACTIVE`; the email identity is unique; exactly one plan uses that email; no plan is already associated to the student; the plan has no modern lifecycle status; and candidate discovery still classifies it as `SINGLE_LEGACY_CANDIDATE`.

The update is deliberately fail-closed:

```sql
UPDATE nutrition_plans
SET student_id = ?
WHERE id = ?
  AND student_id IS NULL
  AND lower(student_email) = lower(?)
  AND status IS NULL
```

It requires `meta.changes === 1`, then re-reads the plan and confirms the expected `student_id`. Any failed revalidation or verification is counted as blocked; no bulk update is used.

## Workflow inputs

Use `mode` as `dry-run`, `apply`, or `rollback`. Every mode requires the exact confirmation `APPLY_PREMIUM_NUTRITION_PLAN_ASSOCIATION_PHASE1`. `rollback` additionally requires the audit-backed `operation_id` emitted by a prior apply summary. The workflow runs only on `main`, uses the `production` environment and `CLOUDFLARE_D1_API_TOKEN`, publishes aggregate-only output, and retains its sanitized artifact for one day.
