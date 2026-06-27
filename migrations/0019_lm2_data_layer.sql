CREATE TABLE IF NOT EXISTS lm2_profiles (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
  weight_kg REAL NOT NULL,
  nutrition_plan_id TEXT NOT NULL,
  training_plan_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lm2_journeys (
  student_id TEXT PRIMARY KEY,
  current_week INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lm2_week_1_foundation (
  student_id TEXT PRIMARY KEY,
  video_completed INTEGER NOT NULL DEFAULT 0,
  unable_to_train TEXT,
  overeating TEXT,
  no_motivation TEXT,
  video_completed_at TEXT,
  plan_b_saved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
