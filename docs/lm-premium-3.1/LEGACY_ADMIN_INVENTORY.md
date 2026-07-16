# LM Premium 3.1 — Inventário Técnico do Admin Legado e Workspace

Sprint 0 documenta somente leitura: nenhuma correção, schema, migration, endpoint ou regra funcional foi criada.

## Entradas administrativas auditadas

| Rota / página | Arquivo servido | Status | Scripts | CSS | Auth | Flags | Parâmetros | Operacionalidade e navegação |
|---|---|---|---|---|---|---|---|---|
| `/admin` | redirect Worker para `/admin.html` | ponte/cutover | n/a | n/a | sessão admin no endpoint de flag | `PREMIUM_ADMIN_CUTOVER_ENABLED` | nenhum | Worker serve redirect; `/admin.html` consulta cutover e manda para Workspace ou legado. |
| `/admin.html` | `public/admin.html` | ponte | inline + `assets/js/admin-auth.js` | inline | `LMAdminAuth` | `PREMIUM_ADMIN_CUTOVER_ENABLED` | nenhum | Entrada oficial; links: Workspace quando flag on, legado quando off. |
| `/admin-legacy.html` | `public/admin-legacy.html` | legado/rollback | inline | inline | `x-admin-session`/`x-admin-token` via `admin-auth.js` | nenhuma Premium Workspace | e-mail nas ações contextuais | Command center legado: lista alunos, Student 360 por e-mail, acesso, follow-up, retention, weekly plan, nutrition. |
| `/admin-premium-workspace.html` | `public/admin-premium-workspace.html` | novo | `public/admin-premium-workspace.js` e `public/assets/js/admin-premium-workspace.js` duplicado | `admin-premium-workspace.css` | `LMAdminAuth` com fallback `adminToken` | `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED` | `student_id` nas ações | Command Center novo: KPIs, lista, inbox, contexto do aluno. |
| `/admin-student.html` | `public/admin-student.html` | legado/Student 360 | inline/fetch | inline | admin API | `STUDENT360` implícito por endpoint | `email` obrigatório | Student 360 legado por e-mail. |
| `/admin-anamneses.html` | não encontrado em `public/` | compatibilidade ausente | n/a | n/a | endpoint legado existe via anamnese | n/a | provável e-mail/id | Página requerida não existe nesta árvore; há teste de auth e endpoint/anamnese Premium. |
| `/admin-premium-weekly-feedbacks.html` | `public/admin-premium-weekly-feedbacks.html` | novo | `public/admin-premium-weekly-feedbacks.js` e cópia em assets | `admin-premium-weekly-feedbacks.css` | usa `credentials: include`; não injeta headers admin | nenhuma explícita no JS | feedback id | Lista feedbacks pendentes/ausentes e registra decisão. |
| `/admin-premium-nutrition-plan.html` | `public/admin-premium-nutrition-plan.html` | novo | `public/admin-premium-nutrition-plan.js` e cópia em assets | `admin-premium-nutrition-plan.css` | não injeta headers admin no JS de raiz/assets | nenhuma explícita | `student_id` obrigatório | Plano alimentar Premium por `student_id`, draft, publish, history. |
| `/admin-nutrition-plan.html` | não encontrado em `public/` | legado ausente/compatibilidade | n/a | n/a | endpoints legado existem | n/a | `email` | Endpoint legado `/api/admin/nutrition-plan` existe, mas página dedicada não aparece. |
| `/admin-premium-student-record.html` | `public/admin-premium-student-record.html` | novo | `admin-auth.js`, `admin-premium-student-record.js` e cópia assets | `admin-premium-student-record.css` | `LMAdminAuth.getAdminAuthHeaders` | nenhuma explícita | `student_id` obrigatório | Prontuário Premium: perfil, anamnese, feedbacks, plano, pendências, follow-up. |

## Fluxos de dados principais

### Legado como fonte funcional

| Fluxo | Página → script → endpoint → handler → use case/repository/query → tabela/coluna → campo exibido |
|---|---|
| Lista de alunos | `admin-legacy.html` → fetch `/api/admin/students` → `workers/api.js` → SQL `student_access` → colunas `name,email,status,plan_type,whatsapp,last_login_at,created_at` → cards/lista com nome, e-mail, plano, status, WhatsApp. |
| Student 360 | `admin-student.html`/legado → `/api/admin/student-360?email=` → `workers/api.js` → queries `student_access`, `premium_anamnesis`, `student_checkins`, `weekly_plans`, `premium_nutrition_plans`, `activity_timeline` → presenter inline `buildStudentSummary/buildBaseTimeline` → perfil, anamnese, check-in, plano semanal, plano alimentar, timeline. |
| Acesso do aluno | legado → POST `/api/admin/student-access`, `/token`, `/activate`, `/status` → `workers/api.js` → SQL upsert/update em `student_access` → retorno `{ok,data}` com token/status. |
| Follow-up | legado → POST/GET `/api/admin/followup-log(s)`, `/followup-resolve` → `workers/api.js` → `followup_logs` → lista/pendências de contato e resolução. |
| Retenção | legado → POST/GET `/api/admin/retention-action(s)` → `retention_actions` → ação proposta, aceite, motivo financeiro. |
| Planejamento semanal | legado → POST `/api/admin/weekly-plan` → `weekly_plans` → foco treino/cardio/nutrição/risco/mensagem. |
| Plano alimentar legado | legado → GET/POST `/api/admin/nutrition-plan?email=` → `getActiveNutritionPlanByEmail`/`saveNutritionPlan` → `premium_nutrition_plans` com fallback por e-mail → plano atual. |
| Check-ins | legado → GET `/api/admin/checkins`, PATCH `/api/admin/checkins/:id/reply` → `student_checkins` → adesão, peso, medidas, resposta do coach. |

### Workspace Premium

| Fluxo | Página → script → endpoint → handler → use case/repository/query → tabela/coluna → campo exibido |
|---|---|
| Summary/KPIs | `admin-premium-workspace.html` → `admin-premium-workspace.js` → GET `/api/admin/premium/workspace/summary` → `getProfessionalWorkspaceSummary` → `d1-professional-workspace-repository` → `premium_pending_items`, `student_checkins`, `premium_anamnesis`, `premium_nutrition_plans`, `premium_students` → indicadores e flag. |
| Lista Workspace | Workspace JS → GET `/api/admin/premium/workspace/students?filter=&cursor=&limit=` → `listProfessionalWorkspaceStudents` → repositório profissional → `premium_students` como fonte primária → cards com nome, e-mail, status, contadores, `student_id`. |
| Busca Workspace | Workspace JS → GET `/api/admin/premium/workspace/students/search?q=` → `searchProfessionalWorkspaceStudents` → `premium_students` → cards. |
| Inbox | Workspace JS → GET `/api/admin/premium/workspace/pending-items` e PATCH `/api/admin/premium/pending-items/:id/resolve` → pending use cases → `premium_pending_items` + `premium_followup_entries` → pendências, CTA, resolução. |
| Contexto aluno | Workspace JS → GET `/api/admin/premium/workspace/students/:student_id` → `getProfessionalWorkspaceStudent` → `workspaceRepository.getStudentContext` → `premium_students`, pending, checkins, plans, anamnesis, evolution → resumo e seções. |
| Prontuário | `admin-premium-student-record.html` → GET `/api/admin/premium/students/:student_id/record` → `getStudentRecord` → `d1-student-record-repository` → perfil/anamnese/plano/feedback/follow-up/pendências. |
| Plano novo | `admin-premium-nutrition-plan.html` → GET/POST/PATCH `/api/admin/premium/students/:student_id/nutrition-plan*`, `/api/admin/premium/nutrition-plans/:id/*` → nutrition use cases/repository → `premium_nutrition_plans` por `student_id`. |
| Feedback novo | `admin-premium-weekly-feedbacks.html` → `/api/admin/premium/weekly-feedbacks/*` esperado no frontend; handler real usa `/api/admin/premium/feedbacks/:id/decision` para decisão → incompatibilidade parcial. |

## Endpoints administrativos mapeados

| Endpoint | Método | Consumidor legado | Consumidor Workspace | Auth | Fonte de dados | Status |
|---|---:|---|---|---|---|---|
| `/api/admin/premium/cutover-route` | GET | `/admin.html` | ponte | admin headers | env flag | reutilizado/ponte |
| `/api/admin/premium/workspace/summary` | GET | não | Workspace | admin | premium repos | apenas Workspace |
| `/api/admin/premium/workspace/students` | GET | não | Workspace | admin | `premium_students` | apenas Workspace |
| `/api/admin/premium/workspace/students/search` | GET | não | Workspace | admin | `premium_students` | apenas Workspace |
| `/api/admin/premium/workspace/students/:student_id` | GET | não | Workspace | admin | premium workspace repo | apenas Workspace |
| `/api/admin/premium/workspace/pending-items` | GET | não | Workspace | admin | `premium_pending_items` | apenas Workspace |
| `/api/admin/premium/workspace/saturday-review` | GET | não | Workspace | admin | premium repos | apenas Workspace |
| `/api/admin/premium/students/:student_id/record` | GET | não | Premium record | admin | premium/student record repos | apenas Workspace |
| `/api/admin/premium/students/:student_id/followup-entries` | POST | não | Premium record | admin | `premium_followup_entries` | apenas Workspace |
| `/api/admin/premium/students/:student_id/pending-items` | POST | não | Premium record | admin | `premium_pending_items` | apenas Workspace |
| `/api/admin/premium/pending-items/:id/resolve` | PATCH | não | Workspace/record | admin | `premium_pending_items` | apenas Workspace |
| `/api/admin/premium/students/:student_id/status` | PATCH | não | futuro Workspace | admin | `premium_students` | apenas Workspace |
| `/api/admin/premium/feedbacks/:id/decision` | POST | não | API nova; JS feedback chama rota diferente | admin | feedback/pending/followup | incompatível |
| `/api/admin/students` | GET | legado | não | admin | `student_access` | apenas legado; entrega alunos que Workspace não lista se ausentes de `premium_students` |
| `/api/admin/student-360` | GET | legado | só link | admin | `student_access`, `premium_anamnesis`, `student_checkins`, `weekly_plans`, `premium_nutrition_plans`, `activity_timeline` | apenas legado; fonte funcional |
| `/api/admin/student-access` | POST | legado | não | admin | `student_access` | apenas legado |
| `/api/admin/student-access/token` | POST | legado | não | admin | `student_access` | apenas legado |
| `/api/admin/student-access/activate` | POST | legado | não | admin | `student_access` | apenas legado |
| `/api/admin/student-access/status` | POST | legado | não | admin | `student_access` | apenas legado |
| `/api/admin/reactivation-contact` | POST | legado | não | admin | `activity_timeline` | apenas legado |
| `/api/admin/followup-log(s)` | POST/GET | legado | não | admin | `followup_logs` | apenas legado |
| `/api/admin/followup-resolve` | POST | legado | não | admin | `followup_logs` | apenas legado |
| `/api/admin/retention-action(s)` | POST/GET | legado | não | admin | `retention_actions` | apenas legado |
| `/api/admin/weekly-plan` | POST | legado | não | admin | `weekly_plans` | apenas legado |
| `/api/admin/nutrition-plan` | GET/POST | legado | não | admin | `premium_nutrition_plans`, identity fallback | apenas legado/compatibilidade |
| `/api/admin/checkins` | GET | legado | não | admin | `student_checkins` | apenas legado |
| `/api/admin/checkins/:id/reply` | PATCH | legado | não | admin | `student_checkins` | apenas legado |
| `/api/admin/endpoint-usage`, `/operational-logs`, `/health-check` | GET | legado/ops | não | admin | logs/health | legado/ops |

## Tabelas e colunas auditadas

| Tabela | Uso legado | Uso Workspace | Identidade | Dados relevantes | Risco |
|---|---|---|---|---|---|
| `student_access` | fonte da lista legado e acesso | não é fonte primária | e-mail, `student_id` opcional | nome, e-mail, WhatsApp, plano, status, token | P0: aluno antigo pode existir aqui e não em `premium_students`. |
| `premium_students` | usado por fluxos novos e identity | fonte primária Workspace | `student_id` | nome, email, phone, consultation/access status | P0: Workspace vazio se tabela não vinculada/backfilled. |
| `premium_anamnesis` | Student 360 por e-mail | record/workspace por `student_id` | e-mail e/ou `student_id` | status, respostas, scores | P1: anamnese antiga sem `student_id` some no Workspace. |
| `student_checkins` | check-ins legado por e-mail | feedbacks/summary por `student_id` | e-mail e `student_id` | aderência, peso, cintura, status coach, week_ref | P1/P0: feedback antigo sem `student_id` não aparece. |
| `weekly_plans` | plano semanal legado | pouco/ausente no Workspace | e-mail | foco treino/cardio/nutrição, risco, mensagem | P1: planejamento profissional não migra. |
| `premium_nutrition_plans` | legado por e-mail com fallback | novo por `student_id` | e-mail e `student_id` | refeições, substituições, status, versão | P0/P1: plano por e-mail pode não carregar em telas por `student_id`. |
| `premium_pending_items` | não | inbox/record | `student_id` | tipo, status, prioridade, CTA | P0: Workspace depende desta tabela. |
| `premium_followup_entries` | não | record/contexto | `student_id` | histórico profissional | P1: histórico legado está em outra tabela. |
| `followup_logs` | legado follow-up | não | e-mail | contato, risco, próxima ação, resolução | P1: comunicação/follow-up legado ausente no Workspace. |
| `retention_actions` | legado retenção | não | e-mail | ação proposta, aceite, razão financeira | P2/P1: decisão operacional ausente. |
| `activity_timeline` | Student 360 timeline | Workspace/evolução parcial | e-mail e/ou `student_id` | eventos, metadata | P1: timeline pode divergir. |
| `admin_sessions`/KV implícito | auth admin | auth admin | sessão/token | autorização | P0 se header/cookie diverge. |

## Causas para Workspace vazio — classificação

1. **CONFIRMADA — fonte de alunos diferente**: legado lista `student_access`; Workspace lista `premium_students`. Alunos antigos apenas no legado não entram na lista Workspace.
2. **CONFIRMADA — identificador diferente**: legado Student 360 exige `email`; Workspace exige `student_id` em contexto, prontuário, plano, pendência e follow-up.
3. **CONFIRMADA — fallback legado não existe no Workspace**: plano legado usa fluxo por e-mail/identity fallback; plano Workspace valida `findByStudentId`.
4. **CONFIRMADA — auth inconsistente em páginas novas auxiliares**: Workspace principal injeta `LMAdminAuth`; feedback e nutrition usam `credentials: include` ou sem headers explícitos, arriscando 401 silencioso.
5. **PROVÁVEL — contratos/rotas de feedback divergentes**: JS chama `/api/admin/premium/weekly-feedbacks/...`, mas handler auditado expõe decisão em `/api/admin/premium/feedbacks/:id/decision`.
6. **POSSÍVEL — flag desliga renderização**: summary retorna `featureFlag.enabled`; frontend oculta revisão semanal e loga flag disabled quando `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED` é falso.
7. **POSSÍVEL — assets duplicados dessincronizam**: existem arquivos na raiz `public/admin-premium-*.js` e em `public/assets/js/admin-premium-*.js`.

## Módulos auditados

- Dashboard/Command Center: KPIs, saturday review, indicadores de pendência, feedback, missing, plano, anamnese; legado tem command center por alunos e operações.
- Lista de alunos: legado por `student_access`; Workspace por `premium_students` com cursor/filtro/busca.
- Student 360/Workspace: legado por e-mail agrega várias tabelas; Workspace por `student_id` usa presenter contextual.
- Cadastro/acesso: legado cria/atualiza `student_access`; Workspace não possui paridade plena.
- Anamnese: legado aparece no 360 por e-mail; Workspace record/contexto por `student_id` e link para anamnese legada.
- Feedback semanal: legado checkins e reply; Workspace pendentes/decisão parcial.
- Plano alimentar: legado GET/POST por e-mail; Workspace draft/publication/history por `student_id`.
- Treinos: não há módulo Workspace equivalente completo; links/planos semanais legados cobrem parte.
- Evolução: legado usa checkins/progression/timeline; Workspace mostra evolução recente resumida.
- Pendências/Inbox: Workspace novo tem `premium_pending_items`; legado follow-up/retention ficam fora.
- Follow-up/comunicação: legado `followup_logs` e retention; Workspace `premium_followup_entries` não consome histórico legado.
