CREATE TABLE IF NOT EXISTS premium_anamnesis (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_phone TEXT,
  status TEXT NOT NULL DEFAULT 'RECEBIDA',
  answers_json TEXT NOT NULL,
  internal_scores_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_created_at
  ON premium_anamnesis(created_at);

CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_student_email
  ON premium_anamnesis(student_email);
