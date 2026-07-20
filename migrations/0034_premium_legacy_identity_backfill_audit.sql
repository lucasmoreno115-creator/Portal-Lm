-- Administrative metadata only. This migration does not run a data backfill.
ALTER TABLE premium_students ADD COLUMN legacy_backfill_batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_premium_students_legacy_backfill_batch
  ON premium_students(legacy_backfill_batch_id);

CREATE TABLE IF NOT EXISTS premium_legacy_identity_backfill_audit (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  student_access_id TEXT NOT NULL,
  previous_student_id TEXT,
  new_student_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  rolled_back_at TEXT,
  UNIQUE(batch_id, student_access_id)
);

CREATE INDEX IF NOT EXISTS idx_premium_legacy_identity_backfill_audit_batch
  ON premium_legacy_identity_backfill_audit(batch_id, rolled_back_at);
