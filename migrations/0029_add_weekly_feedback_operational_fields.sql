-- LM Premium 3.0 Build 4: operational weekly feedback fields.
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
