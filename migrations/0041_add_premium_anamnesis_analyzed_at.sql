-- F3.4.1: durable professional-review timestamp. Historical rows intentionally
-- remain NULL, including rows whose legacy status is already ANALISADA.
ALTER TABLE premium_anamnesis ADD COLUMN analyzed_at TEXT;
