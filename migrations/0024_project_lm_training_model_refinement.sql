ALTER TABLE training_sessions ADD COLUMN plan_id TEXT;
ALTER TABLE training_exercises ADD COLUMN session_id TEXT;
ALTER TABLE training_exercises ADD COLUMN exercise_key TEXT;
ALTER TABLE training_exercises ADD COLUMN instruction_url TEXT;

UPDATE training_sessions
SET plan_id = (SELECT training_plans.id FROM training_plans WHERE training_plans.code = training_sessions.plan_code LIMIT 1)
WHERE plan_id IS NULL;

UPDATE training_exercises
SET session_id = (SELECT training_sessions.id FROM training_sessions WHERE training_sessions.code = training_exercises.session_code LIMIT 1)
WHERE session_id IS NULL;

UPDATE training_exercises
SET instruction_url = COALESCE(instruction_url, video_url, '')
WHERE instruction_url IS NULL;

UPDATE training_exercises SET exercise_key = 'bench_press_barbell' WHERE exercise_key IS NULL AND name = 'Supino reto';
UPDATE training_exercises SET exercise_key = 'low_row_machine' WHERE exercise_key IS NULL AND name = 'Remada baixa';
UPDATE training_exercises SET exercise_key = 'seated_shoulder_press' WHERE exercise_key IS NULL AND name = 'Desenvolvimento sentado';
UPDATE training_exercises SET exercise_key = 'bodyweight_squat' WHERE exercise_key IS NULL AND id = 'exercise_home_casa_a_1';
UPDATE training_exercises SET exercise_key = 'barbell_squat' WHERE exercise_key IS NULL AND name = 'Agachamento livre';
UPDATE training_exercises SET exercise_key = 'leg_press' WHERE exercise_key IS NULL AND name = 'Leg press';
UPDATE training_exercises SET exercise_key = 'hip_thrust' WHERE exercise_key IS NULL AND name = 'Elevação pélvica';
UPDATE training_exercises SET exercise_key = 'incline_push_up' WHERE exercise_key IS NULL AND name = 'Flexão inclinada';
UPDATE training_exercises SET exercise_key = 'front_plank' WHERE exercise_key IS NULL AND name = 'Prancha';

CREATE INDEX IF NOT EXISTS idx_training_sessions_plan_id ON training_sessions(plan_id, active, order_index);
CREATE INDEX IF NOT EXISTS idx_training_exercises_session_id ON training_exercises(session_id, active, order_index);
CREATE INDEX IF NOT EXISTS idx_training_exercises_key ON training_exercises(exercise_key);
