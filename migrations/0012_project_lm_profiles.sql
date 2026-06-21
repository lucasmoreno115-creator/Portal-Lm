CREATE TABLE IF NOT EXISTS project_lm_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_profiles_user_id
  ON project_lm_profiles(user_id);
