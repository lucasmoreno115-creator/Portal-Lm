-- Sprint N2.1: persistent notification source of truth. Delivery is out of scope.
CREATE TABLE IF NOT EXISTS portal_notifications (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'WEEKLY_CHECKIN_REMINDER', 'ANAMNESIS_REQUIRED', 'PLANNING_PUBLISHED',
    'WORKOUT_UPDATED', 'COACH_REPLY', 'ACCOUNT_RELEASED', 'CUSTOM'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  reference_key TEXT,
  status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ')),
  created_at TEXT NOT NULL,
  read_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_notifications_student_status_created
  ON portal_notifications(student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_notifications_student_created
  ON portal_notifications(student_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_notifications_student_type_reference
  ON portal_notifications(student_id, type, reference_key)
  WHERE reference_key IS NOT NULL;
