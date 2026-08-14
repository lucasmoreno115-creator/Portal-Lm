-- F3.4.3: durable timestamp of the most recent Premium reactivation.
ALTER TABLE premium_students ADD COLUMN reactivated_at TEXT NULL;
