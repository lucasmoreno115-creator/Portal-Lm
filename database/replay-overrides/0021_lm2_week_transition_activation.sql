-- Build 6.5 replay-only compatibility override for 0021_lm2_week_transition_activation.sql.
-- The current historical 0019_lm2_data_layer.sql already creates these columns.
-- For empty-database replay/provisioning, this marks the historical 0021 semantic effect as satisfied
-- without modifying the immutable migration in migrations/.
SELECT 1 AS lm2_week_transition_activation_semantically_satisfied_by_0019;
