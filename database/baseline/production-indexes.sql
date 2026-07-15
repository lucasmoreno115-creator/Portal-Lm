-- 0004_nutrition_plans.sql
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_email
  ON nutrition_plans(student_email);

-- 0004_nutrition_plans.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_active
  ON nutrition_plans(student_email)
  WHERE is_active = 1;

-- 0005_premium_anamnesis.sql
CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_created_at
  ON premium_anamnesis(created_at);

-- 0005_premium_anamnesis.sql
CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_student_email
  ON premium_anamnesis(student_email);

-- 0006_activity_timeline.sql
CREATE INDEX IF NOT EXISTS idx_activity_timeline_student_created
  ON activity_timeline(student_email, created_at);

-- 0006_activity_timeline.sql
CREATE INDEX IF NOT EXISTS idx_activity_timeline_created
  ON activity_timeline(created_at);

-- 0009_project_lm_daily_actions.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_daily_actions_unique
  ON project_lm_daily_actions(student_email, action_date, action_type);

-- 0009_project_lm_daily_actions.sql
CREATE INDEX IF NOT EXISTS idx_project_lm_daily_actions_student_date
  ON project_lm_daily_actions(student_email, action_date);

-- 0010_project_lm_library.sql
CREATE INDEX IF NOT EXISTS idx_project_lm_library_content_sort
  ON project_lm_library_content(sort_order);

-- 0010_project_lm_library.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_library_progress_unique
  ON project_lm_library_progress(student_email, content_slug);

-- 0010_project_lm_library.sql
CREATE INDEX IF NOT EXISTS idx_project_lm_library_progress_student
  ON project_lm_library_progress(student_email);

-- 0012_project_lm_profiles.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_profiles_user_id
  ON project_lm_profiles(user_id);

-- 0015_performance_indexes_checkins_progression.sql
CREATE INDEX IF NOT EXISTS idx_student_checkins_student_created
ON student_checkins(student_email, created_at);

-- 0015_performance_indexes_checkins_progression.sql
CREATE INDEX IF NOT EXISTS idx_student_checkins_coach_status_created
ON student_checkins(coach_status, created_at);

-- 0015_performance_indexes_checkins_progression.sql
CREATE INDEX IF NOT EXISTS idx_progression_logs_student_created
ON progression_logs(student_email, created_at);

-- 0016_performance_indexes_weekly_plans.sql
CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_week_status
ON weekly_plans(student_email, week_ref, status);

-- 0016_performance_indexes_weekly_plans.sql
CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_updated
ON weekly_plans(student_email, updated_at);

-- 0017_operational_logs.sql
CREATE INDEX IF NOT EXISTS idx_operational_logs_created_at
  ON operational_logs(created_at);

-- 0017_operational_logs.sql
CREATE INDEX IF NOT EXISTS idx_operational_logs_level_created_at
  ON operational_logs(level, created_at);

-- 0017_operational_logs.sql
CREATE INDEX IF NOT EXISTS idx_operational_logs_area_created_at
  ON operational_logs(area, created_at);

-- 0017_operational_logs.sql
CREATE INDEX IF NOT EXISTS idx_operational_logs_student_email_created_at
  ON operational_logs(student_email, created_at);

-- 0018_project_lm_v5_foundation.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_journeys_student_id
  ON project_lm_journeys(student_id);

-- 0018_project_lm_v5_foundation.sql
CREATE INDEX IF NOT EXISTS idx_project_lm_journeys_student_email
  ON project_lm_journeys(student_email);

-- 0018_project_lm_v5_foundation.sql
CREATE INDEX IF NOT EXISTS idx_project_lm_stage1_actions_journey
  ON project_lm_stage1_actions(journey_id);

-- 0018_project_lm_v5_foundation.sql
CREATE INDEX IF NOT EXISTS idx_project_lm_victories_journey
  ON project_lm_victories(journey_id, created_at);

-- 0018_project_lm_v5_foundation.sql
CREATE INDEX IF NOT EXISTS idx_project_lm_maintenance_goals_journey
  ON project_lm_maintenance_goals(journey_id);

-- 0020_lm2_daily_checkins.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_lm2_checkins_student_date
  ON lm2_checkins(student_id, checkin_date);

-- 0023_project_lm_training_plans.sql
CREATE INDEX IF NOT EXISTS idx_training_sessions_plan ON training_sessions(plan_code, active, order_index);

-- 0023_project_lm_training_plans.sql
CREATE INDEX IF NOT EXISTS idx_training_exercises_session ON training_exercises(session_code, active, order_index);

-- 0024_project_lm_training_model_refinement.sql
CREATE INDEX IF NOT EXISTS idx_training_sessions_plan_id ON training_sessions(plan_id, active, order_index);

-- 0024_project_lm_training_model_refinement.sql
CREATE INDEX IF NOT EXISTS idx_training_exercises_session_id ON training_exercises(session_id, active, order_index);

-- 0024_project_lm_training_model_refinement.sql
CREATE INDEX IF NOT EXISTS idx_training_exercises_key ON training_exercises(exercise_key);

-- 0025_create_premium_students.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_students_normalized_email
  ON premium_students(normalized_email);

-- 0025_create_premium_students.sql
CREATE INDEX IF NOT EXISTS idx_premium_students_access_status
  ON premium_students(access_status);

-- 0025_create_premium_students.sql
CREATE INDEX IF NOT EXISTS idx_premium_students_consultation_status
  ON premium_students(consultation_status);

-- 0026_add_student_id_to_premium_tables.sql
CREATE INDEX IF NOT EXISTS idx_student_access_student_id ON student_access(student_id);

-- 0026_add_student_id_to_premium_tables.sql
CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_student_id ON premium_anamnesis(student_id);

-- 0026_add_student_id_to_premium_tables.sql
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_id ON nutrition_plans(student_id);

-- 0026_add_student_id_to_premium_tables.sql
CREATE INDEX IF NOT EXISTS idx_student_checkins_student_id ON student_checkins(student_id);

-- 0026_add_student_id_to_premium_tables.sql
CREATE INDEX IF NOT EXISTS idx_activity_timeline_student_id ON activity_timeline(student_id);

-- 0026_add_student_id_to_premium_tables.sql
CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_id ON weekly_plans(student_id);

-- 0026_add_student_id_to_premium_tables.sql
CREATE INDEX IF NOT EXISTS idx_progression_logs_student_id ON progression_logs(student_id);

-- 0026_add_student_id_to_premium_tables.sql
CREATE INDEX IF NOT EXISTS idx_followup_logs_student_id ON followup_logs(student_id);

-- 0026_add_student_id_to_premium_tables.sql
CREATE INDEX IF NOT EXISTS idx_retention_actions_student_id ON retention_actions(student_id);

-- 0027_create_premium_followup_entries.sql
CREATE INDEX IF NOT EXISTS idx_premium_followup_entries_student_created
  ON premium_followup_entries(student_id, created_at);

-- 0027_create_premium_followup_entries.sql
CREATE INDEX IF NOT EXISTS idx_premium_followup_entries_type
  ON premium_followup_entries(entry_type);

-- 0027_create_premium_followup_entries.sql
CREATE INDEX IF NOT EXISTS idx_premium_followup_entries_related
  ON premium_followup_entries(related_entity_type, related_entity_id);

-- 0027_create_premium_followup_entries.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_followup_entries_decision_unique
  ON premium_followup_entries(entry_type, related_entity_type, related_entity_id)
  WHERE entry_type = 'PROFESSIONAL_DECISION'
    AND related_entity_type IS NOT NULL
    AND related_entity_id IS NOT NULL;

-- 0028_create_premium_pending_items.sql
CREATE INDEX IF NOT EXISTS idx_premium_pending_items_student_status
  ON premium_pending_items(student_id, status);

-- 0028_create_premium_pending_items.sql
CREATE INDEX IF NOT EXISTS idx_premium_pending_items_status
  ON premium_pending_items(status);

-- 0028_create_premium_pending_items.sql
CREATE INDEX IF NOT EXISTS idx_premium_pending_items_created_at
  ON premium_pending_items(created_at);

-- 0028_create_premium_pending_items.sql
CREATE INDEX IF NOT EXISTS idx_premium_pending_items_related
  ON premium_pending_items(related_entity_type, related_entity_id);

-- 0028_create_premium_pending_items.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_pending_items_open_unique
  ON premium_pending_items(
    student_id,
    type,
    COALESCE(related_entity_type, ''),
    COALESCE(related_entity_id, '')
  )
  WHERE status = 'OPEN';

-- 0029_add_weekly_feedback_operational_fields.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_checkins_student_id_week_unique
  ON student_checkins(student_id, week_ref)
  WHERE student_id IS NOT NULL AND week_ref IS NOT NULL;

-- 0029_add_weekly_feedback_operational_fields.sql
CREATE INDEX IF NOT EXISTS idx_student_checkins_week_status
  ON student_checkins(week_ref, coach_status, submitted_at);

-- 0030_create_premium_feedback_reminders.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_feedback_reminders_unique
  ON premium_feedback_reminders(student_id, week_ref, reminder_type, channel);

-- 0030_create_premium_feedback_reminders.sql
CREATE INDEX IF NOT EXISTS idx_premium_feedback_reminders_status
  ON premium_feedback_reminders(status, scheduled_for);

-- 0031_add_nutrition_plan_lifecycle.sql
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_status
  ON nutrition_plans(student_id, status);

-- 0031_add_nutrition_plan_lifecycle.sql
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_published
  ON nutrition_plans(student_id, published_at);

-- 0031_add_nutrition_plan_lifecycle.sql
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_source_feedback
  ON nutrition_plans(source_feedback_id);

-- 0031_add_nutrition_plan_lifecycle.sql
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_version
  ON nutrition_plans(student_id, version_number);

-- 0032_finalize_nutrition_plan_lifecycle.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_published_student
  ON nutrition_plans(student_id)
  WHERE status = 'PUBLISHED' AND student_id IS NOT NULL;

-- 0032_finalize_nutrition_plan_lifecycle.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_open_draft_student
  ON nutrition_plans(student_id)
  WHERE status = 'DRAFT' AND student_id IS NOT NULL;

-- 0032_finalize_nutrition_plan_lifecycle.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_student_version_unique
  ON nutrition_plans(student_id, version_number)
  WHERE student_id IS NOT NULL AND version_number IS NOT NULL;

-- 0033_add_professional_workspace_indexes.sql
CREATE INDEX IF NOT EXISTS idx_premium_pending_items_workspace
  ON premium_pending_items(status, priority, type, created_at, student_id);

-- 0033_add_professional_workspace_indexes.sql
CREATE INDEX IF NOT EXISTS idx_student_checkins_workspace_student_status
  ON student_checkins(student_id, coach_status, created_at);

-- 0033_add_professional_workspace_indexes.sql
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_workspace_student_status
  ON nutrition_plans(student_id, status, is_active, updated_at);

-- 0033_add_professional_workspace_indexes.sql
CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_workspace_student_status
  ON premium_anamnesis(student_id, status, created_at);
