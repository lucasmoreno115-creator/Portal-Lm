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

CREATE INDEX IF NOT EXISTS idx_premium_followup_entries_student_created
  ON premium_followup_entries(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_premium_followup_entries_type
  ON premium_followup_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_premium_followup_entries_related
  ON premium_followup_entries(related_entity_type, related_entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_followup_entries_decision_unique
  ON premium_followup_entries(entry_type, related_entity_type, related_entity_id)
  WHERE entry_type = 'PROFESSIONAL_DECISION'
    AND related_entity_type IS NOT NULL
    AND related_entity_id IS NOT NULL;
