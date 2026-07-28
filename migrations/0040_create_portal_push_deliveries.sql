-- Sprint N2.3: idempotency and audit trail for Web Push delivery.
CREATE TABLE IF NOT EXISTS portal_push_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'EXPIRED')),
  provider_status INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(notification_id, subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_push_deliveries_notification
  ON portal_push_deliveries(notification_id, status);
