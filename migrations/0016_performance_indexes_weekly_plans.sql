CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_week_status
ON weekly_plans(student_email, week_ref, status);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_updated
ON weekly_plans(student_email, updated_at);
