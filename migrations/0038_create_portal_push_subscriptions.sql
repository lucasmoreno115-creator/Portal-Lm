-- Sprint N2.0: device subscriptions only. Push delivery is intentionally out of scope.
CREATE TABLE IF NOT EXISTS portal_push_subscriptions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_success_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_push_subscriptions_student_status
  ON portal_push_subscriptions(student_id, status);
