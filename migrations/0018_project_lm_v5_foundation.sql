CREATE TABLE IF NOT EXISTS project_lm_journeys (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance')),
  current_stage INTEGER NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 4),
  stage_2_unlocked_at TEXT,
  stage_3_unlocked_at TEXT,
  stage_4_unlocked_at TEXT,
  maintenance_started_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_journeys_student_id
  ON project_lm_journeys(student_id);
CREATE INDEX IF NOT EXISTS idx_project_lm_journeys_student_email
  ON project_lm_journeys(student_email);

CREATE TABLE IF NOT EXISTS project_lm_stage1_actions (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES project_lm_journeys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_lm_stage1_actions_journey
  ON project_lm_stage1_actions(journey_id);

CREATE TABLE IF NOT EXISTS project_lm_plan_b (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  emergency_meal TEXT NOT NULL,
  minimum_workout TEXT NOT NULL,
  minimum_movement TEXT NOT NULL,
  minimum_self_care TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES project_lm_journeys(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_lm_victories (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES project_lm_journeys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_lm_victories_journey
  ON project_lm_victories(journey_id, created_at);

CREATE TABLE IF NOT EXISTS project_lm_recovery_protocols (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  overeating TEXT NOT NULL,
  missed_workout TEXT NOT NULL,
  travel TEXT NOT NULL,
  difficult_week TEXT NOT NULL,
  lack_of_motivation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES project_lm_journeys(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_lm_maintenance_goals (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  goal TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES project_lm_journeys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_lm_maintenance_goals_journey
  ON project_lm_maintenance_goals(journey_id);
