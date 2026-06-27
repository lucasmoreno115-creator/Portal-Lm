CREATE TABLE IF NOT EXISTS lm2_checkins (
  student_id TEXT NOT NULL,
  checkin_date TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  answer TEXT NOT NULL,
  continuity_point INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lm2_checkins_student_date
  ON lm2_checkins(student_id, checkin_date);
