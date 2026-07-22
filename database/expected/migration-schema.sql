CREATE INDEX idx_activity_timeline_created
  ON activity_timeline(created_at);

CREATE INDEX idx_activity_timeline_student_created
  ON activity_timeline(student_email, created_at);

CREATE INDEX idx_activity_timeline_student_id ON activity_timeline(student_id);

CREATE INDEX idx_followup_logs_created_at ON followup_logs(created_at);

CREATE INDEX idx_followup_logs_resolution_status_due_date ON followup_logs(resolution_status, due_date);

CREATE INDEX idx_followup_logs_student_created ON followup_logs(student_email, created_at);

CREATE INDEX idx_followup_logs_student_email ON followup_logs(student_email);

CREATE INDEX idx_followup_logs_student_id ON followup_logs(student_id);

CREATE UNIQUE INDEX idx_lm2_checkins_student_date
  ON lm2_checkins(student_id, checkin_date);

CREATE UNIQUE INDEX idx_nutrition_plans_single_active_legacy_email
  ON nutrition_plans(student_email)
  WHERE is_active = 1
    AND student_id IS NULL;

CREATE UNIQUE INDEX idx_nutrition_plans_single_open_draft_student
  ON nutrition_plans(student_id)
  WHERE status = 'DRAFT' AND student_id IS NOT NULL;

CREATE UNIQUE INDEX idx_nutrition_plans_single_published_student
  ON nutrition_plans(student_id)
  WHERE status = 'PUBLISHED' AND student_id IS NOT NULL;

CREATE INDEX idx_nutrition_plans_source_feedback
  ON nutrition_plans(source_feedback_id);

CREATE INDEX idx_nutrition_plans_student_email
  ON nutrition_plans(student_email);

CREATE INDEX idx_nutrition_plans_student_id ON nutrition_plans(student_id);

CREATE INDEX idx_nutrition_plans_student_published
  ON nutrition_plans(student_id, published_at);

CREATE INDEX idx_nutrition_plans_student_status
  ON nutrition_plans(student_id, status);

CREATE INDEX idx_nutrition_plans_student_version
  ON nutrition_plans(student_id, version_number);

CREATE UNIQUE INDEX idx_nutrition_plans_student_version_unique
  ON nutrition_plans(student_id, version_number)
  WHERE student_id IS NOT NULL AND version_number IS NOT NULL;

CREATE INDEX idx_nutrition_plans_workspace_student_status
  ON nutrition_plans(student_id, status, is_active, updated_at);

CREATE INDEX idx_operational_logs_area_created_at
  ON operational_logs(area, created_at);

CREATE INDEX idx_operational_logs_created_at
  ON operational_logs(created_at);

CREATE INDEX idx_operational_logs_level_created_at
  ON operational_logs(level, created_at);

CREATE INDEX idx_operational_logs_student_email_created_at
  ON operational_logs(student_email, created_at);

CREATE INDEX idx_premium_anamnesis_created_at
  ON premium_anamnesis(created_at);

CREATE INDEX idx_premium_anamnesis_student_email
  ON premium_anamnesis(student_email);

CREATE INDEX idx_premium_anamnesis_student_id ON premium_anamnesis(student_id);

CREATE INDEX idx_premium_anamnesis_workspace_student_status
  ON premium_anamnesis(student_id, status, created_at);

CREATE INDEX idx_premium_feedback_reminders_status
  ON premium_feedback_reminders(status, scheduled_for);

CREATE UNIQUE INDEX idx_premium_feedback_reminders_unique
  ON premium_feedback_reminders(student_id, week_ref, reminder_type, channel);

CREATE UNIQUE INDEX idx_premium_followup_entries_decision_unique
  ON premium_followup_entries(entry_type, related_entity_type, related_entity_id)
  WHERE entry_type = 'PROFESSIONAL_DECISION'
    AND related_entity_type IS NOT NULL
    AND related_entity_id IS NOT NULL;

CREATE INDEX idx_premium_followup_entries_related
  ON premium_followup_entries(related_entity_type, related_entity_id);

CREATE INDEX idx_premium_followup_entries_student_created
  ON premium_followup_entries(student_id, created_at);

CREATE INDEX idx_premium_followup_entries_type
  ON premium_followup_entries(entry_type);

CREATE INDEX idx_premium_legacy_identity_backfill_audit_batch
  ON premium_legacy_identity_backfill_audit(batch_id, rolled_back_at);

CREATE INDEX idx_premium_pending_items_created_at
  ON premium_pending_items(created_at);

CREATE UNIQUE INDEX idx_premium_pending_items_open_unique
  ON premium_pending_items(
    student_id,
    type,
    COALESCE(related_entity_type, ''),
    COALESCE(related_entity_id, '')
  )
  WHERE status = 'OPEN';

CREATE INDEX idx_premium_pending_items_related
  ON premium_pending_items(related_entity_type, related_entity_id);

CREATE INDEX idx_premium_pending_items_status
  ON premium_pending_items(status);

CREATE INDEX idx_premium_pending_items_student_status
  ON premium_pending_items(student_id, status);

CREATE INDEX idx_premium_pending_items_workspace
  ON premium_pending_items(status, priority, type, created_at, student_id);

CREATE INDEX idx_premium_students_access_status ON premium_students(access_status);

CREATE INDEX idx_premium_students_consultation_status ON premium_students(consultation_status);

CREATE INDEX idx_premium_students_legacy_backfill_batch ON premium_students(legacy_backfill_batch_id);

CREATE UNIQUE INDEX idx_premium_students_normalized_email ON premium_students(normalized_email);

CREATE INDEX idx_premium_students_status_name
  ON premium_students(consultation_status, display_name, email);

CREATE INDEX idx_progression_logs_student_created
ON progression_logs(student_email, created_at);

CREATE INDEX idx_progression_logs_student_id ON progression_logs(student_id);

CREATE INDEX idx_project_lm_daily_actions_student_date
  ON project_lm_daily_actions(student_email, action_date);

CREATE UNIQUE INDEX idx_project_lm_daily_actions_unique
  ON project_lm_daily_actions(student_email, action_date, action_type);

CREATE INDEX idx_project_lm_journeys_student_email
  ON project_lm_journeys(student_email);

CREATE UNIQUE INDEX idx_project_lm_journeys_student_id
  ON project_lm_journeys(student_id);

CREATE INDEX idx_project_lm_library_content_sort
  ON project_lm_library_content(sort_order);

CREATE INDEX idx_project_lm_library_progress_student
  ON project_lm_library_progress(student_email);

CREATE UNIQUE INDEX idx_project_lm_library_progress_unique
  ON project_lm_library_progress(student_email, content_slug);

CREATE INDEX idx_project_lm_maintenance_goals_journey
  ON project_lm_maintenance_goals(journey_id);

CREATE UNIQUE INDEX idx_project_lm_profiles_user_id
  ON project_lm_profiles(user_id);

CREATE INDEX idx_project_lm_stage1_actions_journey
  ON project_lm_stage1_actions(journey_id);

CREATE INDEX idx_project_lm_victories_journey
  ON project_lm_victories(journey_id, created_at);

CREATE INDEX idx_retention_actions_student_email ON retention_actions(student_email);

CREATE INDEX idx_retention_actions_student_id ON retention_actions(student_id);

CREATE INDEX idx_student_access_email ON student_access(email);

CREATE INDEX idx_student_access_student_id ON student_access(student_id);

CREATE INDEX idx_student_checkins_coach_status_created
ON student_checkins(coach_status, created_at);

CREATE INDEX idx_student_checkins_student_created
ON student_checkins(student_email, created_at);

CREATE INDEX idx_student_checkins_student_id ON student_checkins(student_id);

CREATE UNIQUE INDEX idx_student_checkins_student_id_week_unique
  ON student_checkins(student_id, week_ref)
  WHERE student_id IS NOT NULL AND week_ref IS NOT NULL;

CREATE INDEX idx_student_checkins_student_week ON student_checkins(student_email, week_ref);

CREATE INDEX idx_student_checkins_week_status
  ON student_checkins(week_ref, coach_status, submitted_at);

CREATE INDEX idx_student_checkins_workspace_student_status
  ON student_checkins(student_id, coach_status, created_at);

CREATE INDEX idx_training_exercises_key ON training_exercises(exercise_key);

CREATE INDEX idx_training_exercises_session ON training_exercises(session_code, active, order_index);

CREATE INDEX idx_training_exercises_session_id ON training_exercises(session_id, active, order_index);

CREATE INDEX idx_training_sessions_plan ON training_sessions(plan_code, active, order_index);

CREATE INDEX idx_training_sessions_plan_id ON training_sessions(plan_id, active, order_index);

CREATE INDEX idx_weekly_plans_student_email ON weekly_plans(student_email);

CREATE INDEX idx_weekly_plans_student_id ON weekly_plans(student_id);

CREATE INDEX idx_weekly_plans_student_updated
ON weekly_plans(student_email, updated_at);

CREATE INDEX idx_weekly_plans_student_week_status
ON weekly_plans(student_email, week_ref, status);

CREATE TABLE activity_timeline (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
, student_id TEXT);

CREATE TABLE diagnostic_results (
  id TEXT PRIMARY KEY,
  created_at TEXT
);

CREATE TABLE followup_logs (
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
, student_id TEXT);

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  created_at TEXT
);

CREATE TABLE lm2_checkins (
  student_id TEXT NOT NULL,
  checkin_date TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  answer TEXT NOT NULL,
  continuity_point INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE lm2_journeys (
  student_id TEXT PRIMARY KEY,
  current_week INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  week_started_at TEXT,
  week_completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
, program_completed_at TEXT, premium_bridge_eligible INTEGER NOT NULL DEFAULT 0);

CREATE TABLE lm2_profiles (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
  weight_kg REAL NOT NULL,
  nutrition_plan_id TEXT NOT NULL,
  training_plan_id TEXT NOT NULL,
  onboarding_completed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE lm2_week_1_foundation (
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

CREATE TABLE lm2_week_2_foundation (
  student_id TEXT PRIMARY KEY,
  video_completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT,
  minimum_response TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE lm2_week_3_foundation (
  student_id TEXT PRIMARY KEY,
  video_completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT,
  minimum_response TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE lm2_week_4_foundation (
  student_id TEXT PRIMARY KEY,
  video_completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT,
  minimum_response TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE nutrition_plans (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  title TEXT,
  goal TEXT,
  strategy TEXT,
  meals_json TEXT NOT NULL,
  substitutions_json TEXT,
  adherence_rules_json TEXT,
  notes TEXT,
  whatsapp_message TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
, student_id TEXT, status TEXT, version_number INTEGER, published_at TEXT, published_by TEXT, archived_at TEXT, supersedes_plan_id TEXT, source_feedback_id TEXT, private_notes TEXT);

CREATE TABLE operational_logs (
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

CREATE TABLE premium_anamnesis (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_phone TEXT,
  status TEXT NOT NULL DEFAULT 'RECEBIDA',
  answers_json TEXT NOT NULL,
  internal_scores_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
, student_id TEXT);

CREATE TABLE premium_feedback_reminders (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  week_ref TEXT NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('FRIDAY_PREPARATION','SATURDAY_MORNING')),
  channel TEXT NOT NULL DEFAULT 'OPERATIONAL_QUEUE',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','SKIPPED','FAILED')),
  scheduled_for TEXT NOT NULL,
  sent_at TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE premium_followup_entries (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  source TEXT NOT NULL DEFAULT 'admin',
  related_entity_type TEXT,
  related_entity_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE premium_legacy_identity_backfill_audit (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  student_access_id TEXT NOT NULL,
  previous_student_id TEXT,
  new_student_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  rolled_back_at TEXT,
  UNIQUE(batch_id, student_access_id)
);

CREATE TABLE premium_pending_items (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  source TEXT NOT NULL DEFAULT 'manual',
  related_entity_type TEXT,
  related_entity_id TEXT,
  due_at TEXT,
  resolved_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE premium_students (
  student_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  display_name TEXT,
  consultation_status TEXT NOT NULL DEFAULT 'NEW' CHECK (consultation_status IN ('NEW', 'AWAITING_ANAMNESIS', 'UNDER_REVIEW', 'READY_TO_RELEASE', 'ACTIVE', 'PAUSED', 'ENDED')),
  access_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (access_status IN ('ACTIVE', 'INACTIVE')),
  source TEXT NOT NULL DEFAULT 'MIGRATION',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  legacy_backfill_batch_id TEXT
);

CREATE TABLE progression_logs (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  exercise TEXT NOT NULL,
  target_zone TEXT NOT NULL,
  load_used REAL,
  reps_done INTEGER,
  rir TEXT,
  decision TEXT,
  created_at TEXT NOT NULL
, student_id TEXT);

CREATE TABLE project_lm_daily_actions (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  action_date TEXT NOT NULL,
  action_type TEXT NOT NULL,
  completed INTEGER DEFAULT 1,
  created_at TEXT
);

CREATE TABLE project_lm_journeys (
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

CREATE TABLE project_lm_library_content (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  summary TEXT,
  action_text TEXT,
  unlock_rule TEXT NOT NULL DEFAULT 'always',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE project_lm_library_progress (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  content_slug TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  completed_at TEXT
);

CREATE TABLE project_lm_maintenance_goals (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  goal TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES project_lm_journeys(id) ON DELETE CASCADE
);

CREATE TABLE project_lm_plan_b (
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

CREATE TABLE project_lm_profile (
student_email TEXT PRIMARY KEY,
goal TEXT,
main_difficulty TEXT,
onboarding_completed INTEGER DEFAULT 0,
created_at TEXT,
updated_at TEXT
);

CREATE TABLE project_lm_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
, name TEXT, goal TEXT, weight_kg REAL, height_cm REAL, nutrition_plan_code TEXT, objective TEXT, initial_plan_code TEXT);

CREATE TABLE project_lm_recovery_protocols (
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

CREATE TABLE project_lm_stage1_actions (
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

CREATE TABLE project_lm_victories (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES project_lm_journeys(id) ON DELETE CASCADE
);

CREATE TABLE project_lm_weekly_missions (
  week_number INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  main_mission TEXT NOT NULL,
  success_criteria TEXT NOT NULL
);

CREATE TABLE retention_actions (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  financial_reason TEXT,
  proposed_action TEXT,
  accepted_status TEXT,
  note TEXT,
  created_at TEXT NOT NULL
, student_id TEXT);

CREATE TABLE student_access (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  plan_type TEXT,
  whatsapp TEXT,
  created_at TEXT NOT NULL
, plan TEXT DEFAULT 'premium', student_id TEXT);

CREATE TABLE student_checkins (
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
, student_id TEXT, available_at TEXT, submitted_at TEXT, analyzed_at TEXT, decision_type TEXT, decision_note TEXT, decision_by TEXT, decision_at TEXT, updated_at TEXT);

CREATE TABLE training_exercises (
  id TEXT PRIMARY KEY,
  session_code TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  sets INTEGER NOT NULL,
  reps TEXT NOT NULL,
  rest_seconds INTEGER NOT NULL,
  video_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, session_id TEXT, exercise_key TEXT, instruction_url TEXT);

CREATE TABLE training_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  audience TEXT,
  location TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE training_sessions (
  id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  week_day INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, plan_id TEXT);

CREATE TABLE weekly_plans (
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
, student_id TEXT);
