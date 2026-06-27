# LM 2.0 — Data and State Model

## Foundation State

The initial client-side state contains only the minimum fields required to scaffold the journey:

| Field | Initial value | Purpose |
| --- | --- | --- |
| `onboarding_completed` | `false` | Indicates whether the user has completed LM 2.0 onboarding. |
| `current_week` | `1` | Tracks the current program week. |
| `continuity_days_count` | `0` | Counts completed continuity days in the current 7-day window. |
| `required_days_count` | `5` | Defines the 5-of-7 advancement rule. |
| `next_action` | `start_onboarding` | Identifies the next guided action. |

## Out of Scope for Foundation

- Database schema.
- API contracts.
- Authentication or access changes.
- Cross-device persistence.
- Progress calculations beyond the initial scaffold fields.

## PR LM 2.0-06C — Data layer inicial

### Tabelas isoladas

O LM 2.0 passa a persistir seu onboarding em tabelas próprias, sem reutilizar tabelas da V5, Premium ou Admin:

- `lm2_profiles`: perfil técnico do aluno autenticado no LM 2.0, com `student_id` como chave primária, dados declarados no onboarding e IDs internos de plano alimentar/treino.
- `lm2_journeys`: jornada 30 dias do aluno, também chaveada por `student_id`, iniciando em `current_week=1` e `status='active'`.

### Estado inicial

Após o onboarding, a home mínima expõe somente estado pronto para UI:

- `onboarding_completed: true`
- `current_week: 1`
- `continuity_days_count: 0`
- `required_days_count: 5`
- `next_action: "week_1_video"`
- `nutrition_ready: true`
- `training_ready: true`

Os códigos internos de plano alimentar (`M1`, `M2`, `M3`, `H1`, `H2`, `H3`) são persistidos em `lm2_profiles.nutrition_plan_id`, mas não compõem o contrato visual da API.

## Week status state

O estado LM 2.0 passa a acompanhar `week_status`, `week_completed` e `next_week_available`.

A Semana 1 é concluída quando `video_completed = true`, `plan_b_completed = true` e `continuity_days_count >= required_days_count` (5). `on_track` e `adapted` contam como continuidade; `off_track` não conta.
