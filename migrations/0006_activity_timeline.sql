CREATE TABLE IF NOT EXISTS activity_timeline (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_timeline_student_created
  ON activity_timeline(student_email, created_at);

CREATE INDEX IF NOT EXISTS idx_activity_timeline_created
  ON activity_timeline(created_at);
