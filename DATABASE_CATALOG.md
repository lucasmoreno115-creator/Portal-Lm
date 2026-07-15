# Database Catalog

Generated from `database/expected/migration-schema.json` after replaying `database/bootstrap/legacy-base-schema.sql` and all versioned migrations.

## Build 6.5 note

Production baseline is captured only by authenticated read-only D1 introspection; migration-derived expected schema is stored separately under `database/expected/`.

## Tables

### activity_timeline

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_email | TEXT | true |  | 0 |
| event_type | TEXT | true |  | 0 |
| source | TEXT | true | 'system' | 0 |
| title | TEXT | true |  | 0 |
| metadata_json | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| student_id | TEXT | false |  | 0 |

Indexes:

- idx_activity_timeline_created (created_at) unique=false partial=false
- idx_activity_timeline_student_created (student_email, created_at) unique=false partial=false
- idx_activity_timeline_student_id (student_id) unique=false partial=false
- sqlite_autoindex_activity_timeline_1 (id) unique=true partial=false

### diagnostic_results

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| created_at | TEXT | false |  | 0 |

Indexes:

- sqlite_autoindex_diagnostic_results_1 (id) unique=true partial=false

### followup_logs

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_email | TEXT | true |  | 0 |
| contact_type | TEXT | true | 'WHATSAPP' | 0 |
| reason | TEXT | false |  | 0 |
| note | TEXT | false |  | 0 |
| outcome | TEXT | false |  | 0 |
| risk_level | TEXT | false |  | 0 |
| next_action | TEXT | false |  | 0 |
| due_date | TEXT | false |  | 0 |
| resolved_at | TEXT | false |  | 0 |
| resolution_status | TEXT | false | 'OPEN' | 0 |
| created_at | TEXT | true |  | 0 |
| student_id | TEXT | false |  | 0 |

Indexes:

- idx_followup_logs_created_at (created_at) unique=false partial=false
- idx_followup_logs_resolution_status_due_date (resolution_status, due_date) unique=false partial=false
- idx_followup_logs_student_created (student_email, created_at) unique=false partial=false
- idx_followup_logs_student_email (student_email) unique=false partial=false
- idx_followup_logs_student_id (student_id) unique=false partial=false
- sqlite_autoindex_followup_logs_1 (id) unique=true partial=false

### leads

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| created_at | TEXT | false |  | 0 |

Indexes:

- sqlite_autoindex_leads_1 (id) unique=true partial=false

### lm2_checkins

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| student_id | TEXT | true |  | 0 |
| checkin_date | TEXT | true |  | 0 |
| week_number | INTEGER | true |  | 0 |
| answer | TEXT | true |  | 0 |
| continuity_point | INTEGER | true |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- idx_lm2_checkins_student_date (student_id, checkin_date) unique=true partial=false

### lm2_journeys

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| student_id | TEXT | false |  | 1 |
| current_week | INTEGER | true | 1 | 0 |
| status | TEXT | true | 'active' | 0 |
| started_at | TEXT | true |  | 0 |
| completed_at | TEXT | false |  | 0 |
| week_started_at | TEXT | false |  | 0 |
| week_completed_at | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |
| program_completed_at | TEXT | false |  | 0 |
| premium_bridge_eligible | INTEGER | true | 0 | 0 |

Indexes:

- sqlite_autoindex_lm2_journeys_1 (student_id) unique=true partial=false

### lm2_profiles

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| student_id | TEXT | false |  | 1 |
| name | TEXT | true |  | 0 |
| goal | TEXT | true |  | 0 |
| sex | TEXT | true |  | 0 |
| weight_kg | REAL | true |  | 0 |
| nutrition_plan_id | TEXT | true |  | 0 |
| training_plan_id | TEXT | true |  | 0 |
| onboarding_completed | INTEGER | true | 1 | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- sqlite_autoindex_lm2_profiles_1 (student_id) unique=true partial=false

### lm2_week_1_foundation

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| student_id | TEXT | false |  | 1 |
| video_completed | INTEGER | true | 0 | 0 |
| unable_to_train | TEXT | false |  | 0 |
| overeating | TEXT | false |  | 0 |
| no_motivation | TEXT | false |  | 0 |
| video_completed_at | TEXT | false |  | 0 |
| plan_b_saved_at | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- sqlite_autoindex_lm2_week_1_foundation_1 (student_id) unique=true partial=false

### lm2_week_2_foundation

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| student_id | TEXT | false |  | 1 |
| video_completed | INTEGER | true | 0 | 0 |
| reflection | TEXT | false |  | 0 |
| minimum_response | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- sqlite_autoindex_lm2_week_2_foundation_1 (student_id) unique=true partial=false

### lm2_week_3_foundation

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| student_id | TEXT | false |  | 1 |
| video_completed | INTEGER | true | 0 | 0 |
| reflection | TEXT | false |  | 0 |
| minimum_response | TEXT | false |  | 0 |
| completed_at | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- sqlite_autoindex_lm2_week_3_foundation_1 (student_id) unique=true partial=false

### lm2_week_4_foundation

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| student_id | TEXT | false |  | 1 |
| video_completed | INTEGER | true | 0 | 0 |
| reflection | TEXT | false |  | 0 |
| minimum_response | TEXT | false |  | 0 |
| completed_at | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- sqlite_autoindex_lm2_week_4_foundation_1 (student_id) unique=true partial=false

### nutrition_plans

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_email | TEXT | true |  | 0 |
| title | TEXT | false |  | 0 |
| goal | TEXT | false |  | 0 |
| strategy | TEXT | false |  | 0 |
| meals_json | TEXT | true |  | 0 |
| substitutions_json | TEXT | false |  | 0 |
| adherence_rules_json | TEXT | false |  | 0 |
| notes | TEXT | false |  | 0 |
| whatsapp_message | TEXT | false |  | 0 |
| is_active | INTEGER | false | 1 | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |
| student_id | TEXT | false |  | 0 |
| status | TEXT | false |  | 0 |
| version_number | INTEGER | false |  | 0 |
| published_at | TEXT | false |  | 0 |
| published_by | TEXT | false |  | 0 |
| archived_at | TEXT | false |  | 0 |
| supersedes_plan_id | TEXT | false |  | 0 |
| source_feedback_id | TEXT | false |  | 0 |
| private_notes | TEXT | false |  | 0 |

Indexes:

- idx_nutrition_plans_single_active (student_email) unique=true partial=true
- idx_nutrition_plans_single_open_draft_student (student_id) unique=true partial=true
- idx_nutrition_plans_single_published_student (student_id) unique=true partial=true
- idx_nutrition_plans_source_feedback (source_feedback_id) unique=false partial=false
- idx_nutrition_plans_student_email (student_email) unique=false partial=false
- idx_nutrition_plans_student_id (student_id) unique=false partial=false
- idx_nutrition_plans_student_published (student_id, published_at) unique=false partial=false
- idx_nutrition_plans_student_status (student_id, status) unique=false partial=false
- idx_nutrition_plans_student_version (student_id, version_number) unique=false partial=false
- idx_nutrition_plans_student_version_unique (student_id, version_number) unique=true partial=true
- idx_nutrition_plans_workspace_student_status (student_id, status, is_active, updated_at) unique=false partial=false
- sqlite_autoindex_nutrition_plans_1 (id) unique=true partial=false

### operational_logs

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| created_at | TEXT | true |  | 0 |
| level | TEXT | true |  | 0 |
| area | TEXT | true |  | 0 |
| event | TEXT | true |  | 0 |
| route | TEXT | false |  | 0 |
| method | TEXT | false |  | 0 |
| student_email | TEXT | false |  | 0 |
| admin_context | TEXT | false |  | 0 |
| message | TEXT | false |  | 0 |
| metadata | TEXT | false |  | 0 |

Indexes:

- idx_operational_logs_area_created_at (area, created_at) unique=false partial=false
- idx_operational_logs_created_at (created_at) unique=false partial=false
- idx_operational_logs_level_created_at (level, created_at) unique=false partial=false
- idx_operational_logs_student_email_created_at (student_email, created_at) unique=false partial=false
- sqlite_autoindex_operational_logs_1 (id) unique=true partial=false

### premium_anamnesis

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_name | TEXT | true |  | 0 |
| student_email | TEXT | true |  | 0 |
| student_phone | TEXT | false |  | 0 |
| status | TEXT | true | 'RECEBIDA' | 0 |
| answers_json | TEXT | true |  | 0 |
| internal_scores_json | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |
| student_id | TEXT | false |  | 0 |

Indexes:

- idx_premium_anamnesis_created_at (created_at) unique=false partial=false
- idx_premium_anamnesis_student_email (student_email) unique=false partial=false
- idx_premium_anamnesis_student_id (student_id) unique=false partial=false
- idx_premium_anamnesis_workspace_student_status (student_id, status, created_at) unique=false partial=false
- sqlite_autoindex_premium_anamnesis_1 (id) unique=true partial=false

### premium_feedback_reminders

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_id | TEXT | true |  | 0 |
| week_ref | TEXT | true |  | 0 |
| reminder_type | TEXT | true |  | 0 |
| channel | TEXT | true | 'OPERATIONAL_QUEUE' | 0 |
| status | TEXT | true | 'PENDING' | 0 |
| scheduled_for | TEXT | true |  | 0 |
| sent_at | TEXT | false |  | 0 |
| failure_reason | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- idx_premium_feedback_reminders_status (status, scheduled_for) unique=false partial=false
- idx_premium_feedback_reminders_unique (student_id, week_ref, reminder_type, channel) unique=true partial=false
- sqlite_autoindex_premium_feedback_reminders_1 (id) unique=true partial=false

### premium_followup_entries

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_id | TEXT | true |  | 0 |
| entry_type | TEXT | true |  | 0 |
| title | TEXT | true |  | 0 |
| content | TEXT | false |  | 0 |
| source | TEXT | true | 'admin' | 0 |
| related_entity_type | TEXT | false |  | 0 |
| related_entity_id | TEXT | false |  | 0 |
| created_by | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- idx_premium_followup_entries_decision_unique (entry_type, related_entity_type, related_entity_id) unique=true partial=true
- idx_premium_followup_entries_related (related_entity_type, related_entity_id) unique=false partial=false
- idx_premium_followup_entries_student_created (student_id, created_at) unique=false partial=false
- idx_premium_followup_entries_type (entry_type) unique=false partial=false
- sqlite_autoindex_premium_followup_entries_1 (id) unique=true partial=false

### premium_pending_items

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_id | TEXT | true |  | 0 |
| type | TEXT | true |  | 0 |
| title | TEXT | true |  | 0 |
| description | TEXT | false |  | 0 |
| status | TEXT | true | 'OPEN' | 0 |
| priority | TEXT | true | 'NORMAL' | 0 |
| source | TEXT | true | 'manual' | 0 |
| related_entity_type | TEXT | false |  | 0 |
| related_entity_id | TEXT | false |  | 0 |
| due_at | TEXT | false |  | 0 |
| resolved_at | TEXT | false |  | 0 |
| created_by | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- idx_premium_pending_items_created_at (created_at) unique=false partial=false
- idx_premium_pending_items_open_unique (student_id, type, , ) unique=true partial=true
- idx_premium_pending_items_related (related_entity_type, related_entity_id) unique=false partial=false
- idx_premium_pending_items_status (status) unique=false partial=false
- idx_premium_pending_items_student_status (student_id, status) unique=false partial=false
- idx_premium_pending_items_workspace (status, priority, type, created_at, student_id) unique=false partial=false
- sqlite_autoindex_premium_pending_items_1 (id) unique=true partial=false

### premium_students

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| student_id | TEXT | false |  | 1 |
| email | TEXT | true |  | 0 |
| normalized_email | TEXT | true |  | 0 |
| display_name | TEXT | false |  | 0 |
| consultation_status | TEXT | true | 'NEW' | 0 |
| access_status | TEXT | true | 'ACTIVE' | 0 |
| source | TEXT | true | 'MIGRATION' | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- idx_premium_students_access_status (access_status) unique=false partial=false
- idx_premium_students_consultation_status (consultation_status) unique=false partial=false
- idx_premium_students_normalized_email (normalized_email) unique=true partial=false
- idx_premium_students_status_name (consultation_status, display_name, email) unique=false partial=false
- sqlite_autoindex_premium_students_1 (student_id) unique=true partial=false

### progression_logs

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_email | TEXT | true |  | 0 |
| exercise | TEXT | true |  | 0 |
| target_zone | TEXT | true |  | 0 |
| load_used | REAL | false |  | 0 |
| reps_done | INTEGER | false |  | 0 |
| rir | TEXT | false |  | 0 |
| decision | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| student_id | TEXT | false |  | 0 |

Indexes:

- idx_progression_logs_student_created (student_email, created_at) unique=false partial=false
- idx_progression_logs_student_id (student_id) unique=false partial=false
- sqlite_autoindex_progression_logs_1 (id) unique=true partial=false

### project_lm_daily_actions

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_email | TEXT | true |  | 0 |
| action_date | TEXT | true |  | 0 |
| action_type | TEXT | true |  | 0 |
| completed | INTEGER | false | 1 | 0 |
| created_at | TEXT | false |  | 0 |

Indexes:

- idx_project_lm_daily_actions_student_date (student_email, action_date) unique=false partial=false
- idx_project_lm_daily_actions_unique (student_email, action_date, action_type) unique=true partial=false
- sqlite_autoindex_project_lm_daily_actions_1 (id) unique=true partial=false

### project_lm_journeys

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_id | TEXT | true |  | 0 |
| student_email | TEXT | true |  | 0 |
| status | TEXT | true | 'active' | 0 |
| current_stage | INTEGER | true | 1 | 0 |
| stage_2_unlocked_at | TEXT | false |  | 0 |
| stage_3_unlocked_at | TEXT | false |  | 0 |
| stage_4_unlocked_at | TEXT | false |  | 0 |
| maintenance_started_at | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- idx_project_lm_journeys_student_email (student_email) unique=false partial=false
- idx_project_lm_journeys_student_id (student_id) unique=true partial=false
- sqlite_autoindex_project_lm_journeys_1 (id) unique=true partial=false

### project_lm_library_content

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| slug | TEXT | true |  | 0 |
| title | TEXT | true |  | 0 |
| description | TEXT | false |  | 0 |
| video_url | TEXT | false |  | 0 |
| summary | TEXT | false |  | 0 |
| action_text | TEXT | false |  | 0 |
| unlock_rule | TEXT | true | 'always' | 0 |
| sort_order | INTEGER | false | 0 | 0 |
| created_at | TEXT | false |  | 0 |

Indexes:

- idx_project_lm_library_content_sort (sort_order) unique=false partial=false
- sqlite_autoindex_project_lm_library_content_1 (id) unique=true partial=false
- sqlite_autoindex_project_lm_library_content_2 (slug) unique=true partial=false

### project_lm_library_progress

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_email | TEXT | true |  | 0 |
| content_slug | TEXT | true |  | 0 |
| completed | INTEGER | false | 0 | 0 |
| completed_at | TEXT | false |  | 0 |

Indexes:

- idx_project_lm_library_progress_student (student_email) unique=false partial=false
- idx_project_lm_library_progress_unique (student_email, content_slug) unique=true partial=false
- sqlite_autoindex_project_lm_library_progress_1 (id) unique=true partial=false

### project_lm_maintenance_goals

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| journey_id | TEXT | true |  | 0 |
| student_id | TEXT | true |  | 0 |
| student_email | TEXT | true |  | 0 |
| goal | TEXT | true |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- idx_project_lm_maintenance_goals_journey (journey_id) unique=false partial=false
- sqlite_autoindex_project_lm_maintenance_goals_1 (id) unique=true partial=false

### project_lm_plan_b

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| journey_id | TEXT | true |  | 0 |
| student_id | TEXT | true |  | 0 |
| student_email | TEXT | true |  | 0 |
| emergency_meal | TEXT | true |  | 0 |
| minimum_workout | TEXT | true |  | 0 |
| minimum_movement | TEXT | true |  | 0 |
| minimum_self_care | TEXT | true |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- sqlite_autoindex_project_lm_plan_b_1 (id) unique=true partial=false
- sqlite_autoindex_project_lm_plan_b_2 (journey_id) unique=true partial=false

### project_lm_profile

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| student_email | TEXT | false |  | 1 |
| goal | TEXT | false |  | 0 |
| main_difficulty | TEXT | false |  | 0 |
| onboarding_completed | INTEGER | false | 0 | 0 |
| created_at | TEXT | false |  | 0 |
| updated_at | TEXT | false |  | 0 |

Indexes:

- sqlite_autoindex_project_lm_profile_1 (student_email) unique=true partial=false

### project_lm_profiles

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | false |  | 1 |
| user_id | INTEGER | true |  | 0 |
| sex | TEXT | true |  | 0 |
| created_at | TEXT | false | CURRENT_TIMESTAMP | 0 |
| updated_at | TEXT | false | CURRENT_TIMESTAMP | 0 |
| name | TEXT | false |  | 0 |
| goal | TEXT | false |  | 0 |
| weight_kg | REAL | false |  | 0 |
| height_cm | REAL | false |  | 0 |
| nutrition_plan_code | TEXT | false |  | 0 |
| objective | TEXT | false |  | 0 |
| initial_plan_code | TEXT | false |  | 0 |

Indexes:

- idx_project_lm_profiles_user_id (user_id) unique=true partial=false

### project_lm_recovery_protocols

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| journey_id | TEXT | true |  | 0 |
| student_id | TEXT | true |  | 0 |
| student_email | TEXT | true |  | 0 |
| overeating | TEXT | true |  | 0 |
| missed_workout | TEXT | true |  | 0 |
| travel | TEXT | true |  | 0 |
| difficult_week | TEXT | true |  | 0 |
| lack_of_motivation | TEXT | true |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- sqlite_autoindex_project_lm_recovery_protocols_1 (id) unique=true partial=false
- sqlite_autoindex_project_lm_recovery_protocols_2 (journey_id) unique=true partial=false

### project_lm_stage1_actions

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| journey_id | TEXT | true |  | 0 |
| student_id | TEXT | true |  | 0 |
| student_email | TEXT | true |  | 0 |
| title | TEXT | true |  | 0 |
| completed | INTEGER | true | 0 | 0 |
| completed_at | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| updated_at | TEXT | true |  | 0 |

Indexes:

- idx_project_lm_stage1_actions_journey (journey_id) unique=false partial=false
- sqlite_autoindex_project_lm_stage1_actions_1 (id) unique=true partial=false

### project_lm_victories

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| journey_id | TEXT | true |  | 0 |
| student_id | TEXT | true |  | 0 |
| student_email | TEXT | true |  | 0 |
| description | TEXT | true |  | 0 |
| created_at | TEXT | true |  | 0 |

Indexes:

- idx_project_lm_victories_journey (journey_id, created_at) unique=false partial=false
- sqlite_autoindex_project_lm_victories_1 (id) unique=true partial=false

### project_lm_weekly_missions

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| week_number | INTEGER | false |  | 1 |
| title | TEXT | true |  | 0 |
| description | TEXT | true |  | 0 |
| main_mission | TEXT | true |  | 0 |
| success_criteria | TEXT | true |  | 0 |

Indexes:


### retention_actions

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_email | TEXT | true |  | 0 |
| financial_reason | TEXT | false |  | 0 |
| proposed_action | TEXT | false |  | 0 |
| accepted_status | TEXT | false |  | 0 |
| note | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| student_id | TEXT | false |  | 0 |

Indexes:

- idx_retention_actions_student_email (student_email) unique=false partial=false
- idx_retention_actions_student_id (student_id) unique=false partial=false
- sqlite_autoindex_retention_actions_1 (id) unique=true partial=false

### student_access

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| name | TEXT | true |  | 0 |
| email | TEXT | true |  | 0 |
| access_token | TEXT | true |  | 0 |
| status | TEXT | true | 'ACTIVE' | 0 |
| plan_type | TEXT | false |  | 0 |
| whatsapp | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| plan | TEXT | false | 'premium' | 0 |
| student_id | TEXT | false |  | 0 |

Indexes:

- idx_student_access_email (email) unique=false partial=false
- idx_student_access_student_id (student_id) unique=false partial=false
- sqlite_autoindex_student_access_1 (id) unique=true partial=false
- sqlite_autoindex_student_access_2 (email) unique=true partial=false

### student_checkins

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_email | TEXT | true |  | 0 |
| week_ref | TEXT | true |  | 0 |
| training_adherence | TEXT | false |  | 0 |
| nutrition_adherence | TEXT | false |  | 0 |
| cardio_adherence | TEXT | false |  | 0 |
| free_meals | TEXT | false |  | 0 |
| hunger_level | TEXT | false |  | 0 |
| binge_or_snacking | TEXT | false |  | 0 |
| sleep_quality | TEXT | false |  | 0 |
| energy_level | TEXT | false |  | 0 |
| stress_level | TEXT | false |  | 0 |
| weekly_weight | TEXT | false |  | 0 |
| waist | TEXT | false |  | 0 |
| strength_status | TEXT | false |  | 0 |
| main_difficulty | TEXT | false |  | 0 |
| routine_context | TEXT | false |  | 0 |
| weekly_score | TEXT | false |  | 0 |
| support_needed | TEXT | false |  | 0 |
| coach_reply | TEXT | false |  | 0 |
| coach_reply_at | TEXT | false |  | 0 |
| coach_status | TEXT | false | 'pending' | 0 |
| reviewed_at | TEXT | false |  | 0 |
| reviewed_by | TEXT | false |  | 0 |
| created_at | TEXT | true |  | 0 |
| student_id | TEXT | false |  | 0 |
| available_at | TEXT | false |  | 0 |
| submitted_at | TEXT | false |  | 0 |
| analyzed_at | TEXT | false |  | 0 |
| decision_type | TEXT | false |  | 0 |
| decision_note | TEXT | false |  | 0 |
| decision_by | TEXT | false |  | 0 |
| decision_at | TEXT | false |  | 0 |
| updated_at | TEXT | false |  | 0 |

Indexes:

- idx_student_checkins_coach_status_created (coach_status, created_at) unique=false partial=false
- idx_student_checkins_student_created (student_email, created_at) unique=false partial=false
- idx_student_checkins_student_id (student_id) unique=false partial=false
- idx_student_checkins_student_id_week_unique (student_id, week_ref) unique=true partial=true
- idx_student_checkins_student_week (student_email, week_ref) unique=false partial=false
- idx_student_checkins_week_status (week_ref, coach_status, submitted_at) unique=false partial=false
- idx_student_checkins_workspace_student_status (student_id, coach_status, created_at) unique=false partial=false
- sqlite_autoindex_student_checkins_1 (id) unique=true partial=false

### training_exercises

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| session_code | TEXT | true |  | 0 |
| order_index | INTEGER | true | 0 | 0 |
| name | TEXT | true |  | 0 |
| sets | INTEGER | true |  | 0 |
| reps | TEXT | true |  | 0 |
| rest_seconds | INTEGER | true |  | 0 |
| video_url | TEXT | true | '' | 0 |
| active | INTEGER | true | 1 | 0 |
| created_at | TEXT | true | CURRENT_TIMESTAMP | 0 |
| updated_at | TEXT | true | CURRENT_TIMESTAMP | 0 |
| session_id | TEXT | false |  | 0 |
| exercise_key | TEXT | false |  | 0 |
| instruction_url | TEXT | false |  | 0 |

Indexes:

- idx_training_exercises_key (exercise_key) unique=false partial=false
- idx_training_exercises_session (session_code, active, order_index) unique=false partial=false
- idx_training_exercises_session_id (session_id, active, order_index) unique=false partial=false
- sqlite_autoindex_training_exercises_1 (id) unique=true partial=false

### training_plans

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| code | TEXT | true |  | 0 |
| name | TEXT | true |  | 0 |
| audience | TEXT | false |  | 0 |
| location | TEXT | false |  | 0 |
| active | INTEGER | true | 1 | 0 |
| created_at | TEXT | true | CURRENT_TIMESTAMP | 0 |
| updated_at | TEXT | true | CURRENT_TIMESTAMP | 0 |

Indexes:

- sqlite_autoindex_training_plans_1 (id) unique=true partial=false
- sqlite_autoindex_training_plans_2 (code) unique=true partial=false

### training_sessions

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| plan_code | TEXT | true |  | 0 |
| code | TEXT | true |  | 0 |
| name | TEXT | true |  | 0 |
| week_day | INTEGER | false |  | 0 |
| order_index | INTEGER | true | 0 | 0 |
| active | INTEGER | true | 1 | 0 |
| created_at | TEXT | true | CURRENT_TIMESTAMP | 0 |
| updated_at | TEXT | true | CURRENT_TIMESTAMP | 0 |
| plan_id | TEXT | false |  | 0 |

Indexes:

- idx_training_sessions_plan (plan_code, active, order_index) unique=false partial=false
- idx_training_sessions_plan_id (plan_id, active, order_index) unique=false partial=false
- sqlite_autoindex_training_sessions_1 (id) unique=true partial=false
- sqlite_autoindex_training_sessions_2 (code) unique=true partial=false

### weekly_plans

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | false |  | 1 |
| student_email | TEXT | true |  | 0 |
| week_ref | TEXT | true |  | 0 |
| training_focus | TEXT | false |  | 0 |
| cardio_target | TEXT | false |  | 0 |
| nutrition_focus | TEXT | false |  | 0 |
| main_risk | TEXT | false |  | 0 |
| coach_message | TEXT | false |  | 0 |
| status | TEXT | false | 'ACTIVE' | 0 |
| created_at | TEXT | false | CURRENT_TIMESTAMP | 0 |
| updated_at | TEXT | false | CURRENT_TIMESTAMP | 0 |
| student_id | TEXT | false |  | 0 |

Indexes:

- idx_weekly_plans_student_email (student_email) unique=false partial=false
- idx_weekly_plans_student_id (student_id) unique=false partial=false
- idx_weekly_plans_student_updated (student_email, updated_at) unique=false partial=false
- idx_weekly_plans_student_week_status (student_email, week_ref, status) unique=false partial=false
- sqlite_autoindex_weekly_plans_1 (id) unique=true partial=false

