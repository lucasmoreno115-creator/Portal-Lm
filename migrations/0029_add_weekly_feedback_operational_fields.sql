-- LM Premium 3.0 Build 4: operational weekly feedback fields.
-- PRECONDITION BEFORE APPLYING idx_student_checkins_student_id_week_unique:
-- run scripts/audit-weekly-feedback-duplicates.mjs (or the SQL below) and confirm it returns zero rows.
-- If conflicts exist, review the clinical responses manually and decide the operational correction;
-- do not delete, merge, or overwrite student feedback silently. Rollback is to leave the new
-- nullable columns unused and postpone the unique index until conflicts are resolved.
-- Audit SQL:
-- SELECT student_id, week_ref, COUNT(*) AS total, GROUP_CONCAT(id) AS checkin_ids
-- FROM student_checkins
-- WHERE student_id IS NOT NULL AND week_ref IS NOT NULL
-- GROUP BY student_id, week_ref
-- HAVING COUNT(*) > 1;
ALTER TABLE student_checkins ADD COLUMN available_at TEXT;
ALTER TABLE student_checkins ADD COLUMN submitted_at TEXT;
ALTER TABLE student_checkins ADD COLUMN analyzed_at TEXT;
ALTER TABLE student_checkins ADD COLUMN decision_type TEXT;
ALTER TABLE student_checkins ADD COLUMN decision_note TEXT;
ALTER TABLE student_checkins ADD COLUMN decision_by TEXT;
ALTER TABLE student_checkins ADD COLUMN decision_at TEXT;
ALTER TABLE student_checkins ADD COLUMN updated_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_checkins_student_id_week_unique
  ON student_checkins(student_id, week_ref)
  WHERE student_id IS NOT NULL AND week_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_checkins_week_status
  ON student_checkins(week_ref, coach_status, submitted_at);
