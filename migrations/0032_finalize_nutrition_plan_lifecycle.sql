-- LM Premium 3.0 Build 5 phase 2: lifecycle backfill and uniqueness.
-- Mandatory precondition: scripts/audit-nutrition-plan-lifecycle.mjs must report ok=true.
-- Do not apply this migration while legacy conflicts exist. This migration does not delete,
-- merge, or choose between conflicting plans.

UPDATE nutrition_plans
SET status = CASE WHEN is_active = 1 THEN 'PUBLISHED' ELSE 'ARCHIVED' END
WHERE status IS NULL;

UPDATE nutrition_plans
SET published_at = COALESCE(published_at, updated_at, created_at)
WHERE status = 'PUBLISHED' AND published_at IS NULL;

UPDATE nutrition_plans
SET archived_at = COALESCE(archived_at, updated_at, created_at)
WHERE status = 'ARCHIVED' AND archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_published_student
  ON nutrition_plans(student_id)
  WHERE status = 'PUBLISHED' AND student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_open_draft_student
  ON nutrition_plans(student_id)
  WHERE status = 'DRAFT' AND student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_student_version_unique
  ON nutrition_plans(student_id, version_number)
  WHERE student_id IS NOT NULL AND version_number IS NOT NULL;
