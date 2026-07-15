-- Build 6.5 legacy bootstrap schema.
-- Source: workers/api.js ensureSchemaUncached legacy application-table creates, lines around
-- leads/diagnostic_results/student_access and Premium operational tables.
-- Purpose: provide the pre-migration application schema required before migrations/0004+.
-- Data included: none.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS diagnostic_results (
  id TEXT PRIMARY KEY,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS student_access (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  plan_type TEXT,
  whatsapp TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS followup_logs (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  contact_type TEXT NOT NULL DEFAULT 'WHATSAPP',
  reason TEXT,
  note TEXT,
  outcome TEXT,
  risk_level TEXT,
  next_action TEXT,
  due_date TEXT,
  resolved_at TEXT,
  resolution_status TEXT DEFAULT 'OPEN',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retention_actions (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  financial_reason TEXT,
  proposed_action TEXT,
  accepted_status TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_checkins (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  week_ref TEXT NOT NULL,
  training_adherence TEXT,
  nutrition_adherence TEXT,
  cardio_adherence TEXT,
  free_meals TEXT,
  hunger_level TEXT,
  binge_or_snacking TEXT,
  sleep_quality TEXT,
  energy_level TEXT,
  stress_level TEXT,
  weekly_weight TEXT,
  waist TEXT,
  strength_status TEXT,
  main_difficulty TEXT,
  routine_context TEXT,
  weekly_score TEXT,
  support_needed TEXT,
  coach_reply TEXT,
  coach_reply_at TEXT,
  coach_status TEXT DEFAULT 'pending',
  reviewed_at TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progression_logs (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  exercise TEXT NOT NULL,
  target_zone TEXT NOT NULL,
  load_used REAL,
  reps_done INTEGER,
  rir TEXT,
  decision TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_plans (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  week_ref TEXT NOT NULL,
  training_focus TEXT,
  cardio_target TEXT,
  nutrition_focus TEXT,
  main_risk TEXT,
  coach_message TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_access_email ON student_access(email);
CREATE INDEX IF NOT EXISTS idx_student_checkins_student_week ON student_checkins(student_email, week_ref);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_email ON weekly_plans(student_email);
CREATE INDEX IF NOT EXISTS idx_followup_logs_student_email ON followup_logs(student_email);
CREATE INDEX IF NOT EXISTS idx_followup_logs_created_at ON followup_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_followup_logs_resolution_status_due_date ON followup_logs(resolution_status, due_date);
CREATE INDEX IF NOT EXISTS idx_followup_logs_student_created ON followup_logs(student_email, created_at);
CREATE INDEX IF NOT EXISTS idx_retention_actions_student_email ON retention_actions(student_email);
