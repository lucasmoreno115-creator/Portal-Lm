CREATE TABLE IF NOT EXISTS lm2_week_3_foundation (
  student_id TEXT PRIMARY KEY,
  video_completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT,
  minimum_response TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lm2_week_4_foundation (
  student_id TEXT PRIMARY KEY,
  video_completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT,
  minimum_response TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE lm2_journeys ADD COLUMN program_completed_at TEXT;
ALTER TABLE lm2_journeys ADD COLUMN premium_bridge_eligible INTEGER NOT NULL DEFAULT 0;
