CREATE TABLE IF NOT EXISTS premium_students (
  student_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  display_name TEXT,
  consultation_status TEXT NOT NULL DEFAULT 'NEW' CHECK (consultation_status IN ('NEW', 'AWAITING_ANAMNESIS', 'UNDER_REVIEW', 'READY_TO_RELEASE', 'ACTIVE', 'PAUSED', 'ENDED')),
  access_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (access_status IN ('ACTIVE', 'INACTIVE')),
  source TEXT NOT NULL DEFAULT 'MIGRATION',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_students_normalized_email
  ON premium_students(normalized_email);

CREATE INDEX IF NOT EXISTS idx_premium_students_access_status
  ON premium_students(access_status);

CREATE INDEX IF NOT EXISTS idx_premium_students_consultation_status
  ON premium_students(consultation_status);
