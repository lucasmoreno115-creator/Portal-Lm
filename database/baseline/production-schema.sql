-- 0004_nutrition_plans.sql
CREATE TABLE IF NOT EXISTS nutrition_plans (
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
);

-- 0005_premium_anamnesis.sql
CREATE TABLE IF NOT EXISTS premium_anamnesis (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_phone TEXT,
  status TEXT NOT NULL DEFAULT 'RECEBIDA',
  answers_json TEXT NOT NULL,
  internal_scores_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 0006_activity_timeline.sql
CREATE TABLE IF NOT EXISTS activity_timeline (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

-- 0007_student_access_plan.sql
ALTER TABLE student_access ADD COLUMN plan TEXT DEFAULT 'premium';

-- 0008_project_lm_profile.sql
CREATE TABLE IF NOT EXISTS project_lm_profile (
student_email TEXT PRIMARY KEY,
goal TEXT,
main_difficulty TEXT,
onboarding_completed INTEGER DEFAULT 0,
created_at TEXT,
updated_at TEXT
);

-- 0009_project_lm_daily_actions.sql
CREATE TABLE IF NOT EXISTS project_lm_daily_actions (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  action_date TEXT NOT NULL,
  action_type TEXT NOT NULL,
  completed INTEGER DEFAULT 1,
  created_at TEXT
);

-- 0010_project_lm_library.sql
CREATE TABLE IF NOT EXISTS project_lm_library_content (
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

-- 0010_project_lm_library.sql
CREATE TABLE IF NOT EXISTS project_lm_library_progress (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  content_slug TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  completed_at TEXT
);

-- 0010_project_lm_library.sql
INSERT OR IGNORE INTO project_lm_library_content (id, slug, title, description, video_url, summary, action_text, unlock_rule, sort_order, created_at) VALUES
('project-lm-library-01', 'como-comecar-e-continuar', 'Como começar e continuar', 'O primeiro passo para sair do ciclo de recomeços e proteger o básico.', '', 'Resumo inicial preparado para o conteúdo “Como começar e continuar”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'always', 1, CURRENT_TIMESTAMP),
('project-lm-library-02', 'a-regra-do-minimo', 'A Regra do Mínimo', 'Como transformar dias difíceis em dias válidos, sem depender de perfeição.', '', 'Resumo inicial preparado para o conteúdo “A Regra do Mínimo”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'always', 2, CURRENT_TIMESTAMP),
('project-lm-library-03', 'o-erro-de-recomecar-toda-segunda', 'O Erro de Recomeçar Toda Segunda', 'Por que esperar a próxima segunda enfraquece sua consistência.', '', 'Resumo inicial preparado para o conteúdo “O Erro de Recomeçar Toda Segunda”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'first_victory', 3, CURRENT_TIMESTAMP),
('project-lm-library-04', 'consistencia-vence-intensidade', 'Consistência Vence Intensidade', 'Aprenda a construir resultado repetindo o possível.', '', 'Resumo inicial preparado para o conteúdo “Consistência Vence Intensidade”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'hard_day_mode', 4, CURRENT_TIMESTAMP),
('project-lm-library-05', 'como-recomecar-sem-culpa', 'Como Recomeçar Sem Culpa', 'Um caminho simples para voltar sem compensação e sem extremos.', '', 'Resumo inicial preparado para o conteúdo “Como Recomeçar Sem Culpa”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_3', 5, CURRENT_TIMESTAMP),
('project-lm-library-06', 'pare-de-procurar-a-dieta-perfeita', 'Pare de Procurar a Dieta Perfeita', 'Organização e aderência antes de trocar de método.', '', 'Resumo inicial preparado para o conteúdo “Pare de Procurar a Dieta Perfeita”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_7', 6, CURRENT_TIMESTAMP),
('project-lm-library-07', 'o-processo-acima-do-resultado', 'O Processo Acima do Resultado', 'Como medir evolução antes da balança confirmar.', '', 'Resumo inicial preparado para o conteúdo “O Processo Acima do Resultado”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_14', 7, CURRENT_TIMESTAMP),
('project-lm-library-08', 'como-nao-abandonar-depois-de-uma-semana-ruim', 'Como Não Abandonar Depois de uma Semana Ruim', 'Estratégia para manter identidade e direção após uma semana instável.', '', 'Resumo inicial preparado para o conteúdo “Como Não Abandonar Depois de uma Semana Ruim”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_21', 8, CURRENT_TIMESTAMP),
('project-lm-library-09', 'o-que-fazer-quando-a-motivacao-sumir', 'O Que Fazer Quando a Motivação Sumir', 'Como continuar quando a vontade não aparece.', '', 'Resumo inicial preparado para o conteúdo “O Que Fazer Quando a Motivação Sumir”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_30', 9, CURRENT_TIMESTAMP),
('project-lm-library-10', 'a-pessoa-que-voce-esta-se-tornando', 'A Pessoa Que Você Está Se Tornando', 'Consolide a visão de longo prazo construída pelas pequenas ações.', '', 'Resumo inicial preparado para o conteúdo “A Pessoa Que Você Está Se Tornando”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_45', 10, CURRENT_TIMESTAMP);

-- 0011_project_lm_weekly_missions.sql
CREATE TABLE IF NOT EXISTS project_lm_weekly_missions (
  week_number INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  main_mission TEXT NOT NULL,
  success_criteria TEXT NOT NULL
);

-- 0011_project_lm_weekly_missions.sql
INSERT OR REPLACE INTO project_lm_weekly_missions (week_number, title, description, main_mission, success_criteria) VALUES
(1, 'Pare de Recomeçar', 'Seu objetivo nesta semana não é emagrecer rápido. É criar movimento.', 'Cumprir 3 ações mínimas.', '3 ações registradas.'),
(2, 'Proteja os Dias Difíceis', 'Aprenda a continuar mesmo quando a rotina apertar.', 'Utilizar o Modo Dia Difícil pelo menos uma vez.', '1 utilização registrada.'),
(3, 'Construa Repetição', 'O foco agora é repetir comportamentos simples.', 'Completar 5 dias ativos.', '5 registros de consistência.'),
(4, 'Pensar Como Alguém Consistente', 'Consolidar tudo que foi construído.', 'Concluir a jornada inicial.', 'Finalizar as 4 semanas.');

-- 0012_project_lm_profiles.sql
CREATE TABLE IF NOT EXISTS project_lm_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 0013_project_lm_profile_initial_data.sql
ALTER TABLE project_lm_profiles ADD COLUMN name TEXT;

-- 0013_project_lm_profile_initial_data.sql
ALTER TABLE project_lm_profiles ADD COLUMN goal TEXT;

-- 0013_project_lm_profile_initial_data.sql
ALTER TABLE project_lm_profiles ADD COLUMN weight_kg REAL;

-- 0013_project_lm_profile_initial_data.sql
ALTER TABLE project_lm_profiles ADD COLUMN height_cm REAL;

-- 0013_project_lm_profile_initial_data.sql
ALTER TABLE project_lm_profiles ADD COLUMN nutrition_plan_code TEXT;

-- 0014_project_lm_profile_complete_onboarding.sql
ALTER TABLE project_lm_profiles ADD COLUMN objective TEXT;

-- 0014_project_lm_profile_complete_onboarding.sql
ALTER TABLE project_lm_profiles ADD COLUMN initial_plan_code TEXT;

-- 0017_operational_logs.sql
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

-- 0018_project_lm_v5_foundation.sql
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

-- 0018_project_lm_v5_foundation.sql
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

-- 0018_project_lm_v5_foundation.sql
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

-- 0018_project_lm_v5_foundation.sql
CREATE TABLE IF NOT EXISTS project_lm_victories (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES project_lm_journeys(id) ON DELETE CASCADE
);

-- 0018_project_lm_v5_foundation.sql
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

-- 0018_project_lm_v5_foundation.sql
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

-- 0019_lm2_data_layer.sql
CREATE TABLE IF NOT EXISTS lm2_profiles (
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

-- 0019_lm2_data_layer.sql
CREATE TABLE IF NOT EXISTS lm2_journeys (
  student_id TEXT PRIMARY KEY,
  current_week INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  week_started_at TEXT,
  week_completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 0019_lm2_data_layer.sql
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

-- 0019_lm2_data_layer.sql
CREATE TABLE IF NOT EXISTS lm2_week_2_foundation (
  student_id TEXT PRIMARY KEY,
  video_completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT,
  minimum_response TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 0020_lm2_daily_checkins.sql
CREATE TABLE IF NOT EXISTS lm2_checkins (
  student_id TEXT NOT NULL,
  checkin_date TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  answer TEXT NOT NULL,
  continuity_point INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 0021_lm2_week_transition_activation.sql
ALTER TABLE lm2_journeys ADD COLUMN week_started_at TEXT;

-- 0021_lm2_week_transition_activation.sql
ALTER TABLE lm2_journeys ADD COLUMN week_completed_at TEXT;

-- 0022_lm2_weeks_3_4_program_completion.sql
CREATE TABLE IF NOT EXISTS lm2_week_3_foundation (
  student_id TEXT PRIMARY KEY,
  video_completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT,
  minimum_response TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 0022_lm2_weeks_3_4_program_completion.sql
CREATE TABLE IF NOT EXISTS lm2_week_4_foundation (
  student_id TEXT PRIMARY KEY,
  video_completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT,
  minimum_response TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 0022_lm2_weeks_3_4_program_completion.sql
ALTER TABLE lm2_journeys ADD COLUMN program_completed_at TEXT;

-- 0022_lm2_weeks_3_4_program_completion.sql
ALTER TABLE lm2_journeys ADD COLUMN premium_bridge_eligible INTEGER NOT NULL DEFAULT 0;

-- 0023_project_lm_training_plans.sql
CREATE TABLE IF NOT EXISTS training_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  audience TEXT,
  location TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 0023_project_lm_training_plans.sql
CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  week_day INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 0023_project_lm_training_plans.sql
CREATE TABLE IF NOT EXISTS training_exercises (
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
);

-- 0023_project_lm_training_plans.sql
INSERT OR IGNORE INTO training_plans (id, code, name, audience, location) VALUES
  ('plan_gym_male', 'gym_male', 'Treino Academia Masculino', 'male', 'gym'),
  ('plan_gym_female', 'gym_female', 'Treino Academia Feminino', 'female', 'gym'),
  ('plan_home', 'home', 'Treino em Casa', 'all', 'home');

-- 0023_project_lm_training_plans.sql
INSERT OR IGNORE INTO training_sessions (id, plan_code, code, name, week_day, order_index) VALUES
  ('session_gym_male_upper_a', 'gym_male', 'gym_male_upper_a', 'Upper A', 1, 1),
  ('session_gym_male_lower_a', 'gym_male', 'gym_male_lower_a', 'Lower A', 2, 2),
  ('session_gym_male_upper_b', 'gym_male', 'gym_male_upper_b', 'Upper B', 4, 3),
  ('session_gym_male_lower_b', 'gym_male', 'gym_male_lower_b', 'Lower B', 5, 4),
  ('session_gym_female_lower_a', 'gym_female', 'gym_female_lower_a', 'Lower A', 1, 1),
  ('session_gym_female_upper_a', 'gym_female', 'gym_female_upper_a', 'Upper A', 2, 2),
  ('session_gym_female_lower_b', 'gym_female', 'gym_female_lower_b', 'Lower B', 4, 3),
  ('session_gym_female_upper_b', 'gym_female', 'gym_female_upper_b', 'Upper B', 5, 4),
  ('session_home_casa_a', 'home', 'home_casa_a', 'Casa A', 1, 1),
  ('session_home_casa_b', 'home', 'home_casa_b', 'Casa B', 3, 2),
  ('session_home_casa_c', 'home', 'home_casa_c', 'Casa C', 5, 3);

-- 0023_project_lm_training_plans.sql
INSERT OR IGNORE INTO training_exercises (id, session_code, order_index, name, sets, reps, rest_seconds, video_url) VALUES
  ('exercise_gym_male_upper_a_1', 'gym_male_upper_a', 1, 'Supino reto', 4, '10–12', 90, ''),
  ('exercise_gym_male_upper_a_2', 'gym_male_upper_a', 2, 'Remada baixa', 4, '10–12', 90, ''),
  ('exercise_gym_male_upper_a_3', 'gym_male_upper_a', 3, 'Desenvolvimento sentado', 3, '10–12', 75, ''),
  ('exercise_gym_female_lower_a_1', 'gym_female_lower_a', 1, 'Agachamento livre', 4, '10–12', 90, ''),
  ('exercise_gym_female_lower_a_2', 'gym_female_lower_a', 2, 'Leg press', 4, '10–12', 90, ''),
  ('exercise_gym_female_lower_a_3', 'gym_female_lower_a', 3, 'Elevação pélvica', 4, '10–12', 90, ''),
  ('exercise_home_casa_a_1', 'home_casa_a', 1, 'Agachamento livre', 4, '10–12', 60, ''),
  ('exercise_home_casa_a_2', 'home_casa_a', 2, 'Flexão inclinada', 4, '8–12', 60, ''),
  ('exercise_home_casa_a_3', 'home_casa_a', 3, 'Prancha', 3, '30–45s', 45, '');

-- 0024_project_lm_training_model_refinement.sql
ALTER TABLE training_sessions ADD COLUMN plan_id TEXT;

-- 0024_project_lm_training_model_refinement.sql
ALTER TABLE training_exercises ADD COLUMN session_id TEXT;

-- 0024_project_lm_training_model_refinement.sql
ALTER TABLE training_exercises ADD COLUMN exercise_key TEXT;

-- 0024_project_lm_training_model_refinement.sql
ALTER TABLE training_exercises ADD COLUMN instruction_url TEXT;

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_sessions
SET plan_id = (SELECT training_plans.id FROM training_plans WHERE training_plans.code = training_sessions.plan_code LIMIT 1)
WHERE plan_id IS NULL;

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises
SET session_id = (SELECT training_sessions.id FROM training_sessions WHERE training_sessions.code = training_exercises.session_code LIMIT 1)
WHERE session_id IS NULL;

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises
SET instruction_url = COALESCE(instruction_url, video_url, '')
WHERE instruction_url IS NULL;

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises SET exercise_key = 'bench_press_barbell' WHERE exercise_key IS NULL AND name = 'Supino reto';

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises SET exercise_key = 'low_row_machine' WHERE exercise_key IS NULL AND name = 'Remada baixa';

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises SET exercise_key = 'seated_shoulder_press' WHERE exercise_key IS NULL AND name = 'Desenvolvimento sentado';

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises SET exercise_key = 'bodyweight_squat' WHERE exercise_key IS NULL AND id = 'exercise_home_casa_a_1';

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises SET exercise_key = 'barbell_squat' WHERE exercise_key IS NULL AND name = 'Agachamento livre';

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises SET exercise_key = 'leg_press' WHERE exercise_key IS NULL AND name = 'Leg press';

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises SET exercise_key = 'hip_thrust' WHERE exercise_key IS NULL AND name = 'Elevação pélvica';

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises SET exercise_key = 'incline_push_up' WHERE exercise_key IS NULL AND name = 'Flexão inclinada';

-- 0024_project_lm_training_model_refinement.sql
UPDATE training_exercises SET exercise_key = 'front_plank' WHERE exercise_key IS NULL AND name = 'Prancha';

-- 0025_create_premium_students.sql
CREATE TABLE IF NOT EXISTS premium_students (
  student_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  display_name TEXT,
  consultation_status TEXT NOT NULL DEFAULT 'NEW' CHECK (consultation_status IN ('NEW', 'AWAITING_ANAMNESIS', 'UNDER_REVIEW', 'ACTIVE', 'PAUSED', 'ENDED')),
  access_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (access_status IN ('ACTIVE', 'INACTIVE')),
  source TEXT NOT NULL DEFAULT 'MIGRATION',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 0026_add_student_id_to_premium_tables.sql
ALTER TABLE student_access ADD COLUMN student_id TEXT;

-- 0026_add_student_id_to_premium_tables.sql
ALTER TABLE premium_anamnesis ADD COLUMN student_id TEXT;

-- 0026_add_student_id_to_premium_tables.sql
ALTER TABLE nutrition_plans ADD COLUMN student_id TEXT;

-- 0026_add_student_id_to_premium_tables.sql
ALTER TABLE student_checkins ADD COLUMN student_id TEXT;

-- 0026_add_student_id_to_premium_tables.sql
ALTER TABLE activity_timeline ADD COLUMN student_id TEXT;

-- 0026_add_student_id_to_premium_tables.sql
ALTER TABLE weekly_plans ADD COLUMN student_id TEXT;

-- 0026_add_student_id_to_premium_tables.sql
ALTER TABLE progression_logs ADD COLUMN student_id TEXT;

-- 0026_add_student_id_to_premium_tables.sql
ALTER TABLE followup_logs ADD COLUMN student_id TEXT;

-- 0026_add_student_id_to_premium_tables.sql
ALTER TABLE retention_actions ADD COLUMN student_id TEXT;

-- 0027_create_premium_followup_entries.sql
CREATE TABLE IF NOT EXISTS premium_followup_entries (
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

-- 0028_create_premium_pending_items.sql
CREATE TABLE IF NOT EXISTS premium_pending_items (
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

-- 0029_add_weekly_feedback_operational_fields.sql
-- LM Premium 3.0 Build 4: operational weekly feedback fields.
-- PRECONDITION BEFORE APPLYING idx_student_checkins_student_id_week_unique:
-- run scripts/audit-weekly-feedback-duplicates.mjs (or the SQL below) and confirm it returns zero rows.
-- If conflicts exist, review the clinical responses manually and decide the operational correction;

-- 0029_add_weekly_feedback_operational_fields.sql
-- do not delete, merge, or overwrite student feedback silently. Rollback is to leave the new
-- nullable columns unused and postpone the unique index until conflicts are resolved.
-- Audit SQL:
-- SELECT student_id, week_ref, COUNT(*) AS total, GROUP_CONCAT(id) AS checkin_ids
-- FROM student_checkins
-- WHERE student_id IS NOT NULL AND week_ref IS NOT NULL
-- GROUP BY student_id, week_ref
-- HAVING COUNT(*) > 1;

-- 0029_add_weekly_feedback_operational_fields.sql
ALTER TABLE student_checkins ADD COLUMN available_at TEXT;

-- 0029_add_weekly_feedback_operational_fields.sql
ALTER TABLE student_checkins ADD COLUMN submitted_at TEXT;

-- 0029_add_weekly_feedback_operational_fields.sql
ALTER TABLE student_checkins ADD COLUMN analyzed_at TEXT;

-- 0029_add_weekly_feedback_operational_fields.sql
ALTER TABLE student_checkins ADD COLUMN decision_type TEXT;

-- 0029_add_weekly_feedback_operational_fields.sql
ALTER TABLE student_checkins ADD COLUMN decision_note TEXT;

-- 0029_add_weekly_feedback_operational_fields.sql
ALTER TABLE student_checkins ADD COLUMN decision_by TEXT;

-- 0029_add_weekly_feedback_operational_fields.sql
ALTER TABLE student_checkins ADD COLUMN decision_at TEXT;

-- 0029_add_weekly_feedback_operational_fields.sql
ALTER TABLE student_checkins ADD COLUMN updated_at TEXT;

-- 0030_create_premium_feedback_reminders.sql
-- LM Premium 3.0 Build 4: operational reminder preparation queue.
CREATE TABLE IF NOT EXISTS premium_feedback_reminders (
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

-- 0031_add_nutrition_plan_lifecycle.sql
-- LM Premium 3.0 Build 5 phase 1: lifecycle columns only.
-- Safe order: apply 0031, run scripts/audit-nutrition-plan-lifecycle.mjs, resolve all blocking
-- conflicts, then apply 0032. This phase intentionally performs no lifecycle backfill and
-- creates no unique lifecycle indexes.

ALTER TABLE nutrition_plans ADD COLUMN status TEXT;

-- 0031_add_nutrition_plan_lifecycle.sql
ALTER TABLE nutrition_plans ADD COLUMN version_number INTEGER;

-- 0031_add_nutrition_plan_lifecycle.sql
ALTER TABLE nutrition_plans ADD COLUMN published_at TEXT;

-- 0031_add_nutrition_plan_lifecycle.sql
ALTER TABLE nutrition_plans ADD COLUMN published_by TEXT;

-- 0031_add_nutrition_plan_lifecycle.sql
ALTER TABLE nutrition_plans ADD COLUMN archived_at TEXT;

-- 0031_add_nutrition_plan_lifecycle.sql
ALTER TABLE nutrition_plans ADD COLUMN supersedes_plan_id TEXT;

-- 0031_add_nutrition_plan_lifecycle.sql
ALTER TABLE nutrition_plans ADD COLUMN source_feedback_id TEXT;

-- 0031_add_nutrition_plan_lifecycle.sql
ALTER TABLE nutrition_plans ADD COLUMN private_notes TEXT;

-- 0032_finalize_nutrition_plan_lifecycle.sql
-- LM Premium 3.0 Build 5 phase 2: lifecycle backfill and uniqueness.
-- Mandatory precondition: scripts/audit-nutrition-plan-lifecycle.mjs must report ok=true.
-- Do not apply this migration while legacy conflicts exist. This migration does not delete,
-- merge, or choose between conflicting plans.

UPDATE nutrition_plans
SET status = CASE WHEN is_active = 1 THEN 'PUBLISHED' ELSE 'ARCHIVED' END
WHERE status IS NULL;

-- 0032_finalize_nutrition_plan_lifecycle.sql
UPDATE nutrition_plans
SET published_at = COALESCE(published_at, updated_at, created_at)
WHERE status = 'PUBLISHED' AND published_at IS NULL;

-- 0032_finalize_nutrition_plan_lifecycle.sql
UPDATE nutrition_plans
SET archived_at = COALESCE(archived_at, updated_at, created_at)
WHERE status = 'ARCHIVED' AND archived_at IS NULL;

-- 0033_add_professional_workspace_indexes.sql
-- LM Premium 3.0 Build 6: additive indexes for the professional workspace read model.
CREATE INDEX IF NOT EXISTS idx_premium_students_status_name
  ON premium_students(consultation_status, display_name, email);
