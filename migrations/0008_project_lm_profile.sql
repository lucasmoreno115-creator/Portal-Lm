CREATE TABLE IF NOT EXISTS project_lm_profile (
student_email TEXT PRIMARY KEY,
goal TEXT,
main_difficulty TEXT,
onboarding_completed INTEGER DEFAULT 0,
created_at TEXT,
updated_at TEXT
);
