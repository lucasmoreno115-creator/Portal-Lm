CREATE TABLE IF NOT EXISTS operational_logs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  level TEXT NOT NULL,
  area TEXT NOT NULL,
  event TEXT NOT NULL,
  route TEXT,
  method TEXT,
  student_email TEXT,
  admin_context TEXT,
  message TEXT,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_operational_logs_created_at
  ON operational_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_operational_logs_level_created_at
  ON operational_logs(level, created_at);

CREATE INDEX IF NOT EXISTS idx_operational_logs_area_created_at
  ON operational_logs(area, created_at);

CREATE INDEX IF NOT EXISTS idx_operational_logs_student_email_created_at
  ON operational_logs(student_email, created_at);
