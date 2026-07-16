# Feature Matrix — LM Premium 3.0.0

| Funcionalidade | Build | Status | RC1 | Produção |
|---|---:|---|---|---|
| Arquitetura base Premium | 0 | Consolidado | Validado | 3.0.0 |
| Student Identity | 1 | Consolidado | Validado | 3.0.0 |
| Anamnese Premium | 1 | Consolidado | Validado | 3.0.0 |
| Prontuário LM | 2 | Consolidado | Validado | 3.0.0 |
| Pendências operacionais | 2 | Consolidado | Validado | 3.0.0 |
| Weekly Feedback | 4 | Consolidado | Validado | 3.0.0 |
| Lembretes operacionais | 4 | Consolidado | Validado | 3.0.0 |
| Nutrition Workflow | 5 | Consolidado | Validado | 3.0.0 |
| Professional Workspace | 6 | Consolidado | Validado | 3.0.0 |
| Saturday Review | 6 | Consolidado | Validado | 3.0.0 |
| Compatibilidade legada | 0-6 | Preservado | Validado | 3.0.0 |
| Projeto LM isolado | 0-6 | Preservado | Validado | 3.0.0 |

## Build 6.6 — Cutover Admin Premium

| Feature | Flag | Staging | Produção | Fallback |
| --- | --- | --- | --- | --- |
| Workspace Premium oficial | `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED` | ligado | ligar após validação | `/admin-legacy.html` |
| Prontuário LM | `PREMIUM_STUDENT_RECORD_ENABLED` | ligado | ligado | Student 360 legado |
| Feedback semanal | `PREMIUM_WEEKLY_FEEDBACK_ENABLED` | ligado | ligado | check-ins legado |
| Plano alimentar lifecycle | `PREMIUM_NUTRITION_PLAN_WORKFLOW_ENABLED` | ligado | ligado | `admin-nutrition-plan.html` |
