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

CREATE INDEX IF NOT EXISTS idx_premium_pending_items_student_status
  ON premium_pending_items(student_id, status);
CREATE INDEX IF NOT EXISTS idx_premium_pending_items_status
  ON premium_pending_items(status);
CREATE INDEX IF NOT EXISTS idx_premium_pending_items_created_at
  ON premium_pending_items(created_at);
CREATE INDEX IF NOT EXISTS idx_premium_pending_items_related
  ON premium_pending_items(related_entity_type, related_entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_pending_items_open_unique
  ON premium_pending_items(student_id, type, related_entity_type, related_entity_id)
  WHERE status = 'OPEN';
