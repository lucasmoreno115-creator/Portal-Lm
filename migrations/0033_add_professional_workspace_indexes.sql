-- LM Premium 3.0 Build 6: additive indexes for the professional workspace read model.
CREATE INDEX IF NOT EXISTS idx_premium_students_status_name
  ON premium_students(consultation_status, display_name, email);
CREATE INDEX IF NOT EXISTS idx_premium_pending_items_workspace
  ON premium_pending_items(status, priority, type, created_at, student_id);
CREATE INDEX IF NOT EXISTS idx_student_checkins_workspace_student_status
  ON student_checkins(student_id, coach_status, created_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_workspace_student_status
  ON nutrition_plans(student_id, status, is_active, updated_at);
CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_workspace_student_status
  ON premium_anamnesis(student_id, status, created_at);
