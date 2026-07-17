# LM Premium 3.1 — Matriz Oficial de Migração

## Nível de validação

- análise estática da main/branch;
- testes automatizados locais;
- nenhum request autenticado ao staging/produção;
- nenhuma comparação de contagens reais;
- nenhuma confirmação de flags e deploy remoto.

| Domínio | Funcionalidade | Legado | Workspace | Paridade de dados | Paridade de ação | Backend compartilhado | Status | Evidência | Prioridade |
|---|---|---|---|---|---|---|---|---|---|
| Entrada | `GET /admin` Build 6.6 | Worker consulta `PREMIUM_ADMIN_CUTOVER_ENABLED`; `false` → `/admin-legacy.html` | Worker consulta `PREMIUM_ADMIN_CUTOVER_ENABLED`; `true` → `/admin-premium-workspace.html` | sim | sim | flag Worker | MIGRADO | `workers/api.js` cutover direto; `/admin.html` só fallback estático | P2 |
| Entrada | `/admin.html` | bootstrap estático de compatibilidade/fallback | consulta endpoint de cutover quando servido | parcial | parcial | `/api/admin/premium/cutover-route` | PARCIAL | não é entrada normal com Worker ativo | P3 |
| Dashboard | KPIs gerais | command center legado | summary KPIs | parcial | não | não | PARCIAL | Workspace summary vs `/api/admin/students` | P1 |
| Dashboard | Revisão de sábado | ausente/operacional legado manual | endpoint saturday-review | parcial | parcial | premium repos | PARCIAL | `/workspace/saturday-review` | P2 |
| Alunos | Listagem base | `student_access` | `premium_students` | não confirmada em dados remotos; divergência estrutural confirmada no código | parcial | não | BLOQUEADO | `/api/admin/students` vs `/workspace/students` | P0 |
| Alunos | Busca | e-mail/nome no legado | q no Workspace | parcial | sim | não | PARCIAL | JS workspace search | P1 |
| Alunos | Filtros/status | status legado | filter workspace | parcial | parcial | não | PARCIAL | access/status vs consultation/access status | P1 |
| Alunos | Projeto LM excluído | bloqueio em nutrition legacy | exclusão em Workspace testada localmente, não confirmada remotamente | parcial | incerto | parcial | PARCIAL | testes locais/workspace repository | P1 |
| Student 360 | Perfil | e-mail agrega dados | `student_id` contexto | divergência confirmada; impacto remoto não confirmado | links | não | BLOQUEADO | email vs student_id | P0 |
| Student 360 | Contato | nome/e-mail/WhatsApp | nome/e-mail/phone | parcial | não | não | PARCIAL | `student_access.whatsapp` vs premium phone | P1 |
| Student 360 | Anamnese no 360/record | por e-mail | por `student_id` | parcial | link parcial | parcial | PARCIAL | `premium_anamnesis` | P1 |
| Anamnese | Página `/admin-anamneses.html` | link/redirect esperado | arquivo ausente em `public/` | não | não | não | BLOQUEADO | `test -f public/admin-anamneses.html` retornou ausente | P0 |
| Student 360 | Check-ins/feedback | por e-mail | por `student_id` | parcial | decisão parcial | parcial | PARCIAL | `student_checkins` | P1 |
| Student 360 | Plano semanal/treino | `weekly_plans` | não equivalente completo | não | não | não | NÃO MIGRADO | `/api/admin/weekly-plan` | P1 |
| Student 360 | Plano alimentar | e-mail/fallback | student_id/draft | divergência confirmada; falha remota não confirmada | parcial | mesma tabela, identidade diferente | BLOQUEADO | `premium_nutrition_plans`; `findByStudentId` requirement | P0 |
| Student 360 | Timeline/histórico | `activity_timeline` | evolução resumida | parcial | não | parcial | PARCIAL | Student 360 query | P1 |
| Cadastro | Criar aluno/acesso | POST `student-access` | create premium student use case sem UI equivalente auditada | não | não | não | NÃO MIGRADO | `/api/admin/student-access` | P0 |
| Cadastro | Token/reset | POST token | não | não | não | não | NÃO MIGRADO | `/student-access/token` | P1 |
| Cadastro | Ativar/inativar | activate/status | PATCH premium status parcial | parcial | parcial | não | PARCIAL | `/students/:id/status` | P1 |
| Anamnese | Análise/status | use case existe | record/pending parcial | parcial | parcial | sim | PARCIAL | `analyze-anamnesis`; página dedicada bloqueada | P1 |
| Feedback | Listagem pendentes | checkins legado | weekly feedback pending JS/API divergente | parcial | parcial | parcial | PARCIAL | JS `/weekly-feedbacks/pending` | P1 |
| Feedback | Responder/analisar | PATCH checkin reply | POST decision | parcial | parcial | tabela compartilhada parcial | PARCIAL | `/checkins/:id/reply`, `/feedbacks/:id/decision` | P1 |
| Nutrition | Draft | não no legado | sim | n/a | sim | premium | MIGRADO | draft endpoints | P2 |
| Nutrition | Publicação | POST legado salva atual | publish endpoint | parcial | parcial | premium | PARCIAL | publish endpoint | P1 |
| Treinos | Plano atual/link externo | weekly plan/campos treino | link/ausente | não | não | não | NÃO MIGRADO | `weekly_plans.training_focus` | P1 |
| Evolução | Peso/medidas | checkins/progression | evolution summary | parcial | não | parcial | PARCIAL | checkins/evolution context | P1 |
| Inbox Premium | Carregar pendências | não é fonte legado principal | carrega `premium_pending_items` | n/a | parcial | premium | PARCIAL | `/api/admin/premium/workspace/pending-items` | P1 |
| Follow-up legado | Registro/resolução | `followup_logs` | não consolidado no Workspace | não | não | não | NÃO MIGRADO | `/api/admin/followup-log(s)` | P1 |
| Follow-up Premium | Registro no Prontuário | não | `premium_followup_entries` | não consolidado com legado | parcial | não | PARCIAL | `/students/:id/followup-entries` | P1 |
| Retenção | Ações | `retention_actions` | não | não | não | não | NÃO MIGRADO | endpoint legado only | P2 |
| Auth | Headers admin | token/session | Workspace main ok; subpages inconsistent | divergência no código | parcial | auth shared | BLOQUEADO | JS headers; impacto remoto não confirmado | P0 |
| Observabilidade | Logs/health/usage | endpoints admin | não ligado ao Workspace | parcial | n/a | shared | PARCIAL | ops endpoints | P3 |

## Totais

- Itens: 32
- Status: MIGRADO 2; PARCIAL 20; NÃO MIGRADO 6; BLOQUEADO 4; NÃO APLICÁVEL 0
- Prioridades: P0 7; P1 20; P2 3; P3 2
- Gaps P0: listagem base por fonte divergente; Student 360/perfil por identidade divergente; página `/admin-anamneses.html` ausente/404; plano alimentar atual por identidade divergente; criação/acesso de aluno sem paridade; auth inconsistente em subpáginas; confirmação remota de dados/flags pendente para fechar causa de Workspace vazio.
