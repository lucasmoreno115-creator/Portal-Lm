-- LM Premium 3.0 Build 5 phase 1: lifecycle columns only.
-- Safe order: apply 0031, run scripts/audit-nutrition-plan-lifecycle.mjs, resolve all blocking
-- conflicts, then apply 0032. This phase intentionally performs no lifecycle backfill and
-- creates no unique lifecycle indexes.

ALTER TABLE nutrition_plans ADD COLUMN status TEXT;
ALTER TABLE nutrition_plans ADD COLUMN version_number INTEGER;
ALTER TABLE nutrition_plans ADD COLUMN published_at TEXT;
ALTER TABLE nutrition_plans ADD COLUMN published_by TEXT;
ALTER TABLE nutrition_plans ADD COLUMN archived_at TEXT;
ALTER TABLE nutrition_plans ADD COLUMN supersedes_plan_id TEXT;
ALTER TABLE nutrition_plans ADD COLUMN source_feedback_id TEXT;
ALTER TABLE nutrition_plans ADD COLUMN private_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_status
  ON nutrition_plans(student_id, status);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_published
  ON nutrition_plans(student_id, published_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_source_feedback
  ON nutrition_plans(source_feedback_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_version
  ON nutrition_plans(student_id, version_number);
