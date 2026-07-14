# LM Premium 3.0 RC1 — Inventário da main

- Base verificada: `5aff53c814c9c3f37cb8514748ec570ed83461bc` (branch local `work`; não havia ref local `main` disponível no container).
- Última migration: `0033_add_professional_workspace_indexes.sql`.
- Build 7: não iniciado.

## Ativo

### Migrations Premium
- `0004_nutrition_plans.sql` — planos alimentares.
- `0005_premium_anamnesis.sql` — anamnese Premium.
- `0006_activity_timeline.sql` — timeline/eventos legados compartilhados.
- `0007_student_access_plan.sql` — acesso do aluno.
- `0025_create_premium_students.sql` — identidade Premium oficial.
- `0026_add_student_id_to_premium_tables.sql` — associação por `student_id`.
- `0027_create_premium_followup_entries.sql` — Prontuário/evolução.
- `0028_create_premium_pending_items.sql` — pendências Premium.
- `0029_add_weekly_feedback_operational_fields.sql` — campos operacionais do feedback.
- `0030_create_premium_feedback_reminders.sql` — fila operacional de lembretes, sem envio automático.
- `0031_add_nutrition_plan_lifecycle.sql` — ciclo de vida do plano.
- `0032_finalize_nutrition_plan_lifecycle.sql` — constraints/índices finais do plano.
- `0033_add_professional_workspace_indexes.sql` — índices do Workspace.

### Tabelas Premium
`premium_students`, `premium_anamnesis`, `student_checkins`, `nutrition_plans`, `premium_pending_items`, `premium_followup_entries`, `premium_feedback_reminders`, `activity_timeline`, `student_access`.

### Repositories Premium
`workers/premium/repositories/*`: student identity, anamnesis, weekly feedback, nutrition plan, pending items, followup entries, professional workspace, event adapters and D1 implementations.

### Casos de uso Premium
`workers/premium/application/*`: create/list premium students, submit/list weekly feedback, record professional decision, nutrition plan read/write/publish, pending item create/resolve, status update and student record.

### Endpoints Premium
Rotas administrativas sob `/api/admin/premium/*`, rotas de aluno sob `/api/student/premium/*`, Student 360 administrativo e rotas legadas compatíveis usadas por páginas existentes.

### Páginas Premium
`public/admin-premium-workspace.html`, `public/admin-premium-weekly-feedbacks.html`, `public/admin-premium-nutrition-plan.js`, `public/admin-premium-student-record.css`, `public/portal-premium-weekly-feedback.html`, `public/portal-premium-nutrition-plan.html` e equivalentes na raiz quando existentes.

### Feature flags
- `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED`.
- `PREMIUM_NUTRITION_PLAN_WORKFLOW_ENABLED`.

### Scripts de auditoria
- `scripts/premium-student-identity-backfill.mjs`.
- `scripts/audit-weekly-feedback-duplicates.mjs`.
- `scripts/audit-nutrition-plan-lifecycle.mjs`.
- `scripts/audit-lm-premium-rc1.mjs` (RC1 unificada).

### Testes existentes
Suítes `tests/lm-premium-*.test.mjs` cobrem identidade, contratos legados, domínio, prontuário, feedback semanal, plano alimentar e Workspace.

## Compatibilidade legada
- Editor/admin de plano alimentar legado (`admin-nutrition-plan.html`, `portal-plano-alimentar.html`) permanece preservado.
- `activity_timeline` e `student_access` continuam necessários para compatibilidade e identidade.
- Student 360 continua como rota administrativa relacionada, não substituída pelo Prontuário Premium.

## Deprecated, mas ainda necessário
- Campos legados por e-mail em `nutrition_plans`, `premium_anamnesis` e `student_checkins` seguem necessários durante a transição para `student_id`.
- Scripts de backfill/auditoria anteriores seguem como evidência e pré-condição operacional.

## Somente Projeto LM
Arquivos `projeto-lm/*`, `public/projeto-lm/*`, `src/projeto-lm/*` e migrations `0008` a `0024` relacionadas ao LM2/Projeto LM são escopo preservado e não devem ser alterados pela RC1.
