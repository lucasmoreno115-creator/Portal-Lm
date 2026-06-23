CREATE INDEX IF NOT EXISTS idx_student_checkins_student_created
ON student_checkins(student_email, created_at);

CREATE INDEX IF NOT EXISTS idx_student_checkins_coach_status_created
ON student_checkins(coach_status, created_at);

CREATE INDEX IF NOT EXISTS idx_progression_logs_student_created
ON progression_logs(student_email, created_at);
