-- LM Premium 3.0 Build 5: additive lifecycle fields for nutrition_plans.
-- Pré-condição operacional: executar scripts/audit-nutrition-plan-lifecycle.mjs e revisar conflitos
-- antes do rollout em produção. A migration não apaga, não mescla e não escolhe plano ativo em conflito.

ALTER TABLE nutrition_plans ADD COLUMN status TEXT;
ALTER TABLE nutrition_plans ADD COLUMN version_number INTEGER;
ALTER TABLE nutrition_plans ADD COLUMN published_at TEXT;
ALTER TABLE nutrition_plans ADD COLUMN published_by TEXT;
ALTER TABLE nutrition_plans ADD COLUMN archived_at TEXT;
ALTER TABLE nutrition_plans ADD COLUMN supersedes_plan_id TEXT;
ALTER TABLE nutrition_plans ADD COLUMN source_feedback_id TEXT;
ALTER TABLE nutrition_plans ADD COLUMN private_notes TEXT;

UPDATE nutrition_plans
SET status = CASE WHEN is_active = 1 THEN 'PUBLISHED' ELSE 'ARCHIVED' END
WHERE status IS NULL;

UPDATE nutrition_plans
SET published_at = COALESCE(published_at, updated_at, created_at)
WHERE status = 'PUBLISHED' AND published_at IS NULL;

UPDATE nutrition_plans
SET archived_at = COALESCE(archived_at, updated_at, created_at)
WHERE status = 'ARCHIVED' AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_status
  ON nutrition_plans(student_id, status);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_published
  ON nutrition_plans(student_id, published_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_source_feedback
  ON nutrition_plans(source_feedback_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_version
  ON nutrition_plans(student_id, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_published_student
  ON nutrition_plans(student_id)
  WHERE status = 'PUBLISHED' AND student_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_student_version_unique
  ON nutrition_plans(student_id, version_number)
  WHERE student_id IS NOT NULL AND version_number IS NOT NULL;
