-- SQLite cannot alter a CHECK constraint. Rebuild premium_students while preserving every current column and index.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
ALTER TABLE premium_students RENAME TO premium_students__before_ready_to_release;
CREATE TABLE premium_students (
  student_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  display_name TEXT,
  consultation_status TEXT NOT NULL DEFAULT 'NEW' CHECK (consultation_status IN ('NEW', 'AWAITING_ANAMNESIS', 'UNDER_REVIEW', 'READY_TO_RELEASE', 'ACTIVE', 'PAUSED', 'ENDED')),
  access_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (access_status IN ('ACTIVE', 'INACTIVE')),
  source TEXT NOT NULL DEFAULT 'MIGRATION',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  legacy_backfill_batch_id TEXT
);
INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at,legacy_backfill_batch_id)
SELECT student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at,legacy_backfill_batch_id FROM premium_students__before_ready_to_release;
DROP TABLE premium_students__before_ready_to_release;
CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_students_normalized_email ON premium_students(normalized_email);
CREATE INDEX IF NOT EXISTS idx_premium_students_access_status ON premium_students(access_status);
CREATE INDEX IF NOT EXISTS idx_premium_students_consultation_status ON premium_students(consultation_status);
CREATE INDEX IF NOT EXISTS idx_premium_students_legacy_backfill_batch ON premium_students(legacy_backfill_batch_id);
COMMIT;
PRAGMA foreign_keys=ON;
