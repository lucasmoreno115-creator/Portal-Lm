# Banco de dados

## Fonte
O schema é definido por migrations SQL e também por bootstrap defensivo em `workers/api.js`.

## Tabelas Premium
| Tabela | Status | Responsabilidade | Índices/constraints relevantes |
|---|---|---|---|
| `student_access` | ATIVA | Acesso aluno, token, plano, status | `email UNIQUE`, `idx_student_access_email` |
| `weekly_plans` | ATIVA | Plano semanal Premium | `idx_weekly_plans_student_email`, `idx_weekly_plans_student_week_status`, `idx_weekly_plans_student_updated` |
| `nutrition_plans` | ATIVA | Plano alimentar Premium | `idx_nutrition_plans_student_email`, unique active por aluno |
| `student_checkins` | ATIVA | Check-ins Premium | `idx_student_checkins_student_week`, `idx_student_checkins_student_created`, `idx_student_checkins_coach_status_created` |
| `progression_logs` | ATIVA | Peso/medidas/progresso | `idx_progression_logs_student_created` |
| `followup_logs` | ATIVA | Acompanhamento/follow-up | índices por aluno, data, resolução |
| `retention_actions` | ATIVA | Ações de retenção/reativação | índices por aluno e data |
| `activity_timeline` | ATIVA | Timeline operacional Premium | índices por aluno/data |
| `premium_anamnesis` | ATIVA | Anamnese Premium | índices por data e email |
| `operational_logs` | ATIVA | Observabilidade | índices por data, nível, área, aluno |

## Tabelas Projeto LM
| Tabela | Status | Observação |
|---|---|---|
| `project_lm_profile` | LEGADA/DUPLICADA | Profile inicial antigo; coexistente com `project_lm_profiles`. |
| `project_lm_profiles` | ATIVA | Perfil Projeto LM usado em rotas modernas. |
| `project_lm_daily_actions` | ATIVA | Ações diárias. |
| `project_lm_library_content` | ATIVA | Conteúdos biblioteca. |
| `project_lm_library_progress` | ATIVA | Progresso biblioteca. |
| `project_lm_weekly_missions` | ATIVA | Missões semanais. |
| `project_lm_journeys` | ATIVA | Jornada V5. |
| `project_lm_stage1_actions` | ATIVA | Ações estágio 1 V5. |
| `project_lm_plan_b` | ATIVA | Plano B V5. |
| `project_lm_victories` | ATIVA | Vitórias V5. |
| `project_lm_recovery_protocols` | ATIVA | Recuperação V5. |
| `project_lm_maintenance_goals` | ATIVA | Manutenção V5. |
| `lm2_profiles` | ATIVA | LM 2.0. |
| `lm2_journeys` | ATIVA | Jornada LM 2.0. |
| `lm2_week_1_foundation` | ATIVA | Semana 1. |
| `lm2_week_2_foundation` | ATIVA | Semana 2. |
| `lm2_week_3_foundation` | ATIVA | Semana 3. |
| `lm2_week_4_foundation` | ATIVA | Semana 4. |
| `lm2_checkins` | ATIVA | Check-ins LM2. |
| `training_plans`, `training_sessions`, `training_exercises` | ATIVA Projeto LM / NÃO Premium | Modelo de treino Projeto LM; não substituir MFit no Premium. |

## Tabelas legado/admin geral
| Tabela | Status | Observação |
|---|---|---|
| `leads` | LEGADA | Diagnóstico/landing. |
| `diagnostic_results` | LEGADA | Resultado diagnóstico. |

## Migrations
- `0004` a `0007`: base Premium alimentar, anamnese, timeline, plan em acesso.
- `0008` a `0014`: evolução Projeto LM profile/biblioteca/missões.
- `0015` a `0017`: índices e operational logs.
- `0018`: fundação Projeto LM V5.
- `0019` a `0022`: LM 2.0 data layer, check-ins e semanas.
- `0023` a `0024`: planos de treino do Projeto LM.

## Riscos do banco
- Bootstrap em `workers/api.js` duplica parte das migrations; divergência futura é risco.
- `student_access` é tabela compartilhada por plano/produto; mudança no Premium pode afetar Projeto LM.
- Há nomenclatura duplicada de perfil (`project_lm_profile` vs `project_lm_profiles`).
- Tabelas de treino devem permanecer fora do escopo Premium por causa da regra MFit.
