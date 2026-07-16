# LM Premium 3.1 — Matriz Oficial de Migração

| Domínio | Funcionalidade | Legado | Workspace | Paridade de dados | Paridade de ação | Backend compartilhado | Status | Evidência | Prioridade |
|---|---|---|---|---|---|---|---|---|---|
| Entrada | Cutover `/admin` | redirect/ponte | workspace/legado por flag | sim | parcial | flag Worker | PARCIAL | `/api/admin/premium/cutover-route` | P2 |
| Dashboard | KPIs gerais | command center legado | summary KPIs | parcial | não | não | PARCIAL | Workspace summary vs `/api/admin/students` | P1 |
| Dashboard | Revisão de sábado | ausente/operacional legado manual | endpoint saturday-review | parcial | parcial | premium repos | PARCIAL | `/workspace/saturday-review` | P2 |
| Alunos | Listagem base | `student_access` | `premium_students` | não | parcial | não | BLOQUEADO | `/api/admin/students` vs `/workspace/students` | P0 |
| Alunos | Busca | e-mail/nome no legado | q no Workspace | parcial | sim | não | PARCIAL | JS workspace search | P1 |
| Alunos | Filtros/status | status legado | filter workspace | parcial | parcial | não | PARCIAL | access/status vs consultation/access status | P1 |
| Alunos | Projeto LM excluído | bloqueio em nutrition legacy | não evidenciado na lista Workspace | incerto | incerto | parcial | PARCIAL | `isProjectLmPlan` só no plano legado | P1 |
| Student 360 | Perfil | e-mail agrega dados | `student_id` contexto | parcial | links | não | BLOQUEADO | email vs student_id | P0 |
| Student 360 | Contato | nome/e-mail/WhatsApp | nome/e-mail/phone | parcial | não | não | PARCIAL | `student_access.whatsapp` vs premium phone | P1 |
| Student 360 | Anamnese | por e-mail | por `student_id` | parcial | link legado | parcial | PARCIAL | `premium_anamnesis` | P1 |
| Student 360 | Check-ins/feedback | por e-mail | por `student_id` | parcial | decisão parcial | parcial | PARCIAL | `student_checkins` | P1 |
| Student 360 | Plano semanal/treino | `weekly_plans` | não equivalente completo | não | não | não | NÃO MIGRADO | `/api/admin/weekly-plan` | P1 |
| Student 360 | Plano alimentar | e-mail/fallback | student_id/draft | parcial | parcial | mesma tabela, identidade diferente | PARCIAL | `premium_nutrition_plans` | P0 |
| Student 360 | Timeline/histórico | `activity_timeline` | evolução resumida | parcial | não | parcial | PARCIAL | Student 360 query | P1 |
| Cadastro | Criar aluno/acesso | POST `student-access` | create premium student use case sem UI equivalente auditada | não | não | não | NÃO MIGRADO | `/api/admin/student-access` | P0 |
| Cadastro | Token/reset | POST token | não | não | não | não | NÃO MIGRADO | `/student-access/token` | P1 |
| Cadastro | Ativar/inativar | activate/status | PATCH premium status parcial | parcial | parcial | não | PARCIAL | `/students/:id/status` | P1 |
| Anamnese | Listagem | página requerida ausente, dados no 360 | record/contexto | parcial | parcial | parcial | PARCIAL | `/api/anamnese-premium` + record | P1 |
| Anamnese | Análise/status | use case existe | record/pending | parcial | parcial | sim | PARCIAL | `analyze-anamnesis` | P1 |
| Feedback | Listagem pendentes | checkins legado | weekly feedback pending JS/API divergente | parcial | parcial | parcial | PARCIAL | JS `/weekly-feedbacks/pending` | P1 |
| Feedback | Responder/analisar | PATCH checkin reply | POST decision | parcial | parcial | tabela compartilhada parcial | PARCIAL | `/checkins/:id/reply`, `/feedbacks/:id/decision` | P1 |
| Nutrition | Plano atual | GET por e-mail | GET por student_id | parcial | sim | tabela compartilhada | BLOQUEADO | `findByStudentId` requirement | P0 |
| Nutrition | Draft | não no legado | sim | n/a | sim | premium | MIGRADO | draft endpoints | P2 |
| Nutrition | Publicação | POST legado salva atual | publish endpoint | parcial | parcial | premium | PARCIAL | publish endpoint | P1 |
| Treinos | Plano atual/link externo | weekly plan/campos treino | link/ausente | não | não | não | NÃO MIGRADO | `weekly_plans.training_focus` | P1 |
| Evolução | Peso/medidas | checkins/progression | evolution summary | parcial | não | parcial | PARCIAL | checkins/evolution context | P1 |
| Pendências | Inbox | followup/retention implícito | premium pending items | não | parcial | não | PARCIAL | `followup_logs` vs `premium_pending_items` | P0 |
| Pendências | Resolver | followup-resolve | pending resolve | não | sim | não | PARCIAL | separate tables | P1 |
| Follow-up | Registro | `followup_logs` | `premium_followup_entries` | não | parcial | não | NÃO MIGRADO | tables differ | P1 |
| Retenção | Ações | `retention_actions` | não | não | não | não | NÃO MIGRADO | endpoint legado only | P2 |
| Auth | Headers admin | token/session | Workspace main ok; subpages inconsistent | parcial | parcial | auth shared | PARCIAL | JS headers | P0 |
| Observabilidade | Logs/health/usage | endpoints admin | não ligado ao Workspace | parcial | n/a | shared | PARCIAL | ops endpoints | P3 |

## Totais

- Itens: 32
- Status: MIGRADO 1; PARCIAL 21; NÃO MIGRADO 6; BLOQUEADO 4; NÃO APLICÁVEL 0
- Prioridades: P0 7; P1 20; P2 4; P3 1
