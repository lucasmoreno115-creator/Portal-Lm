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

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_email
  ON nutrition_plans(student_email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_active
  ON nutrition_plans(student_email)
  WHERE is_active = 1;
