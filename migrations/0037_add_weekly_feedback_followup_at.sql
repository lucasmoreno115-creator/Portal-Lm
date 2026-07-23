-- X3: student_checkins remains the single source of truth for weekly reviews.
-- The public response continues to use coach_reply/coach_reply_at; this nullable
-- operational date is never presented to the student.
ALTER TABLE student_checkins ADD COLUMN followup_at TEXT;
