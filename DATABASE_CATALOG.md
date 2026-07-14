# Database Catalog — LM Premium 3.0.0

## Tabelas Premium e compatíveis

| Tabela | Objetivo | Campos principais |
|---|---|---|
| `premium_students` | Identidade oficial do aluno Premium | `student_id`, `email`, `normalized_email`, `display_name`, `consultation_status`, `access_status`, `source`, timestamps |
| `premium_anamnesis` | Anamnese Premium | `id`, `student_id`, `student_name`, `student_email`, `status`, `answers_json`, `internal_scores_json`, timestamps |
| `nutrition_plans` | Plano alimentar e lifecycle | `id`, `student_id`, `student_email`, `title`, `goal`, `strategy`, JSONs, `status`, `version_number`, publicação/arquivamento |
| `student_checkins` | Weekly feedback compatível | `student_id`, `week_ref`, aderência, status do coach, decisão, disponibilidade e análise |
| `activity_timeline` | Timeline operacional compatível | `id`, `student_id`, `student_email`, `event_type`, `source`, `title`, `metadata_json`, `created_at` |
| `premium_followup_entries` | Prontuário LM | `id`, `student_id`, `entry_type`, `title`, `content`, vínculo, autor, timestamps |
| `premium_pending_items` | Pendências operacionais | `id`, `student_id`, `type`, `title`, `status`, `priority`, vínculo, vencimento/resolução |
| `premium_feedback_reminders` | Fila operacional de lembretes | `id`, `student_id`, `week_ref`, `reminder_type`, `channel`, `status`, `scheduled_for` |
| `student_access` | Acesso compatível | `student_id`, `plan` e campos legados de acesso |
| `weekly_plans` | Compatibilidade com plano semanal | `student_id` e campos legados |
| `progression_logs` | Compatibilidade com progressão | `student_id` e campos legados |
| `followup_logs` | Compatibilidade com follow-up legado | `student_id` e campos legados |
| `retention_actions` | Compatibilidade com retenção | `student_id` e campos legados |

## Migrations Premium

| Migration | Objetivo |
|---|---|
| `0004_nutrition_plans.sql` | Cria tabela de planos nutricionais compatível. |
| `0005_premium_anamnesis.sql` | Cria anamnese Premium. |
| `0006_activity_timeline.sql` | Cria timeline operacional. |
| `0007_student_access_plan.sql` | Adiciona plano ao acesso. |
| `0025_create_premium_students.sql` | Cria identidade Premium. |
| `0026_add_student_id_to_premium_tables.sql` | Adiciona `student_id` a tabelas Premium/compatíveis. |
| `0027_create_premium_followup_entries.sql` | Cria prontuário/follow-up. |
| `0028_create_premium_pending_items.sql` | Cria pendências. |
| `0029_add_weekly_feedback_operational_fields.sql` | Adiciona campos operacionais de feedback semanal. |
| `0030_create_premium_feedback_reminders.sql` | Cria lembretes de feedback. |
| `0031_add_nutrition_plan_lifecycle.sql` | Adiciona lifecycle ao plano alimentar. |
| `0032_finalize_nutrition_plan_lifecycle.sql` | Backfill e unicidade do lifecycle. |
| `0033_add_professional_workspace_indexes.sql` | Índices para workspace profissional. |

## Índices

- Identidade: `idx_premium_students_normalized_email`, `idx_premium_students_access_status`, `idx_premium_students_consultation_status`, `idx_premium_students_status_name`.
- Anamnese: `idx_premium_anamnesis_created_at`, `idx_premium_anamnesis_student_email`, `idx_premium_anamnesis_student_id`, `idx_premium_anamnesis_workspace_student_status`.
- Planos: `idx_nutrition_plans_student_email`, `idx_nutrition_plans_single_active`, `idx_nutrition_plans_student_id`, `idx_nutrition_plans_student_status`, `idx_nutrition_plans_student_published`, `idx_nutrition_plans_source_feedback`, `idx_nutrition_plans_student_version`, `idx_nutrition_plans_single_published_student`, `idx_nutrition_plans_single_open_draft_student`, `idx_nutrition_plans_student_version_unique`, `idx_nutrition_plans_workspace_student_status`.
- Feedback: `idx_student_checkins_student_id`, `idx_student_checkins_student_id_week_unique`, `idx_student_checkins_week_status`, `idx_student_checkins_workspace_student_status`.
- Timeline/compatibilidade: `idx_activity_timeline_student_created`, `idx_activity_timeline_created`, `idx_activity_timeline_student_id`, `idx_student_access_student_id`, `idx_weekly_plans_student_id`, `idx_progression_logs_student_id`, `idx_followup_logs_student_id`, `idx_retention_actions_student_id`.
- Prontuário: `idx_premium_followup_entries_student_created`, `idx_premium_followup_entries_type`, `idx_premium_followup_entries_related`, `idx_premium_followup_entries_decision_unique`.
- Pendências: `idx_premium_pending_items_student_status`, `idx_premium_pending_items_status`, `idx_premium_pending_items_created_at`, `idx_premium_pending_items_related`, `idx_premium_pending_items_open_unique`, `idx_premium_pending_items_workspace`.
- Lembretes: `idx_premium_feedback_reminders_unique`, `idx_premium_feedback_reminders_status`.

## FKs

As migrations Premium históricas não declaram FKs SQL formais. A integridade entre `student_id` e registros Premium é aplicada pelas camadas de aplicação, serviços de identidade, repositórios e índices/constraints.
