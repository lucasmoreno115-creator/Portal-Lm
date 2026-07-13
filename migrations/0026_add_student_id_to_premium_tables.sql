ALTER TABLE student_access ADD COLUMN student_id TEXT;
ALTER TABLE premium_anamnesis ADD COLUMN student_id TEXT;
ALTER TABLE nutrition_plans ADD COLUMN student_id TEXT;
ALTER TABLE student_checkins ADD COLUMN student_id TEXT;
ALTER TABLE activity_timeline ADD COLUMN student_id TEXT;
ALTER TABLE weekly_plans ADD COLUMN student_id TEXT;
ALTER TABLE progression_logs ADD COLUMN student_id TEXT;
ALTER TABLE followup_logs ADD COLUMN student_id TEXT;
ALTER TABLE retention_actions ADD COLUMN student_id TEXT;

CREATE INDEX IF NOT EXISTS idx_student_access_student_id ON student_access(student_id);
CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_student_id ON premium_anamnesis(student_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_id ON nutrition_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_student_checkins_student_id ON student_checkins(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_timeline_student_id ON activity_timeline(student_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_id ON weekly_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_progression_logs_student_id ON progression_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_followup_logs_student_id ON followup_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_retention_actions_student_id ON retention_actions(student_id);
