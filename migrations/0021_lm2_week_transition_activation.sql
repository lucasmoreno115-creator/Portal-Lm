-- Build 6.5 replay repair:
-- The current versioned 0019_lm2_data_layer.sql already creates
-- lm2_journeys.week_started_at and lm2_journeys.week_completed_at.
-- This historical migration is intentionally a no-op for empty-database replay.
-- Existing remote environments that already applied the original additive ALTERs are not changed.
SELECT 1 AS lm2_week_transition_activation_already_in_0019;
