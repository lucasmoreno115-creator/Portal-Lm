CREATE TABLE IF NOT EXISTS project_lm_daily_actions (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  action_date TEXT NOT NULL,
  action_type TEXT NOT NULL,
  completed INTEGER DEFAULT 1,
  created_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_daily_actions_unique
  ON project_lm_daily_actions(student_email, action_date, action_type);

CREATE INDEX IF NOT EXISTS idx_project_lm_daily_actions_student_date
  ON project_lm_daily_actions(student_email, action_date);
