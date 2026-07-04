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

CREATE INDEX IF NOT EXISTS idx_training_sessions_plan ON training_sessions(plan_code, active, order_index);
CREATE INDEX IF NOT EXISTS idx_training_exercises_session ON training_exercises(session_code, active, order_index);

INSERT OR IGNORE INTO training_plans (id, code, name, audience, location) VALUES
  ('plan_gym_male', 'gym_male', 'Treino Academia Masculino', 'male', 'gym'),
  ('plan_gym_female', 'gym_female', 'Treino Academia Feminino', 'female', 'gym'),
  ('plan_home', 'home', 'Treino em Casa', 'all', 'home');

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
