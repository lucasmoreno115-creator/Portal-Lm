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
CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_feedback_reminders_unique
  ON premium_feedback_reminders(student_id, week_ref, reminder_type, channel);
CREATE INDEX IF NOT EXISTS idx_premium_feedback_reminders_status
  ON premium_feedback_reminders(status, scheduled_for);
