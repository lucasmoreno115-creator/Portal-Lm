-- Preflight audit (run and resolve any returned rows before applying this migration):
-- SELECT lower(trim(student_email)), COUNT(*)
-- FROM nutrition_plans
-- WHERE is_active = 1
--   AND student_id IS NULL
-- GROUP BY lower(trim(student_email))
-- HAVING COUNT(*) > 1;
--
-- The former unique index covered modern versioned rows as well as unassociated
-- legacy rows. Modern lifecycle uniqueness remains enforced by migration 0032
-- through student_id/status/version_number indexes.
DROP INDEX IF EXISTS idx_nutrition_plans_single_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_active_legacy_email
  ON nutrition_plans(student_email)
  WHERE is_active = 1
    AND student_id IS NULL;
