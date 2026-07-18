# Build 6.6 — Admin Premium Integration & Cutover

## Rota oficial

A rota canônica do Admin LM Premium é `/admin`. A decisão de cutover real ocorre no Worker (`workers/api.js`) e no bootstrap `public/admin.html`: com `PREMIUM_ADMIN_CUTOVER_ENABLED=true`, `/admin` abre `public/admin-premium-workspace.html`; com a flag desligada, `/admin` abre o Admin legado real em `public/admin-legacy.html`. A página do Workspace preserva o visual atual e adiciona apenas shell administrativo, navegação integrada e ações contextuais.

## Rotas legadas e rollback

| rota | comportamento | fallback |
| --- | --- | --- |
| `/admin` | Worker direciona conforme `PREMIUM_ADMIN_CUTOVER_ENABLED` | desligar a flag para abrir `/admin-legacy.html` |
| `/admin.html` | bootstrap estático consulta `/api/admin/premium/cutover-route` | fallback automático para `/admin-legacy.html` |
| `/admin-student.html` | Student 360 real e protegido, aberto pelo Workspace com `student_id` | fallback por e-mail no fluxo antigo |
| `/admin-premium-workspace.html` | arquivo-base preservado | continua acessível |
| `/admin-legacy.html` | Admin Hub legado real com Command Center, Student 360, cadastro de aluno, auth e logout | uso temporário quando o Workspace ou o cutover estiver desligado |

## Shell administrativo

O shell nativo HTML/CSS/JS fica no Workspace e centraliza cabeçalho, identidade LM Premium, busca, menu, logout, loading global, erro com retry, estado de feature flag desligada, toast de sucesso, área principal e responsividade mobile/tablet/desktop. Nenhum framework novo foi introduzido.

## Módulos integrados

- Prontuário LM: aberto por `student_id` em `/admin-premium-student-record.html?student_id=...`.
- Feedback Semanal: aberto por `student_id` em `/admin-premium-weekly-feedbacks.html?student_id=...` e diretamente pela Inbox.
- Plano Alimentar: CTA principal usa `/admin-premium-nutrition-plan.html?student_id=...` e ciclo `DRAFT → PUBLISHED → ARCHIVED`; o editor antigo fica rotulado como `Editor legado`.
- Anamnese: CTA claramente legado, aberto por `student_id` em `/admin-anamneses.html?student_id=...`, reutilizando a tela funcional existente de Anamneses (`/api/admin/anamneses`).
- Student 360: permanece como aprofundamento de aluno único, aberto pelo contexto do Workspace.
- Evolução: exibida no painel contextual do aluno selecionado.

## Feature flags

| flag | valor atual | staging esperado | produção esperado | fallback | impacto |
| --- | --- | --- | --- | --- | --- |
| `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED` | ambiente | `true` protegido | `true` após validação | `/admin-legacy.html` | habilita Workspace oficial |
| `PREMIUM_STUDENT_RECORD_ENABLED` | ambiente | `true` | `true` | Student 360 legado | habilita Prontuário LM |
| `PREMIUM_WEEKLY_FEEDBACK_ENABLED` | ambiente | `true` | `true` | check-ins/admin legado | habilita revisão semanal |
| `PREMIUM_NUTRITION_PLAN_WORKFLOW_ENABLED` | ambiente | `true` | `true` | `admin-nutrition-plan.html` | habilita lifecycle de plano |
| `PREMIUM_ADMIN_CUTOVER_ENABLED` | Worker/bootstrap | `true` em staging | `true` após aprovação | `/admin-legacy.html` | governa `/admin`: Workspace quando ligada, Admin legado real quando desligada |

## Endpoints usados

- `GET /api/admin/premium/workspace/summary`
- `GET /api/admin/premium/workspace/students`
- `GET /api/admin/premium/workspace/students/search`
- `GET /api/admin/premium/workspace/students/:student_id`
- `GET /api/admin/premium/workspace/pending-items`
- `GET /api/admin/premium/workspace/saturday-review`
- `PATCH /api/admin/premium/pending-items/:id/resolve`
- `GET /api/admin/premium/students/:student_id/record`
- `GET/POST/PATCH /api/admin/premium/...nutrition-plan...`
- `GET/POST /api/admin/premium/weekly-feedbacks...`

## Migrações exigidas

Nenhuma migration nova foi criada neste Build. O cutover depende das tabelas Premium já cobertas pelas migrations existentes de estudantes Premium, pendências, feedback semanal, prontuário, anamnese e planos alimentares. Não executar produção neste Build.

## Checklist de staging

- [ ] Workspace abre
- [ ] Login funciona
- [ ] Logout funciona
- [ ] Busca funciona
- [ ] Filtros funcionam
- [ ] Inbox carrega
- [ ] Alunos carregam
- [ ] Contexto abre
- [ ] Prontuário abre
- [ ] Feedback abre
- [ ] Plano abre
- [ ] Anamnese abre
- [ ] Student 360 abre
- [ ] Pendência é resolvida
- [ ] Contadores atualizam
- [ ] Feature flag funciona
- [ ] Rollback funciona
- [ ] Mobile validado
- [ ] Sem erro no console
- [ ] Sem endpoint 404/500

## Riscos e dependências

- A produção só deve manter `PREMIUM_ADMIN_CUTOVER_ENABLED=true` após validação de staging.
- Nesta PR, a flag não é ativada automaticamente: `PREMIUM_ADMIN_CUTOVER_ENABLED=true` deve ser uma ação operacional separada somente após smoke test em produção validar login, retorno ao Workspace e rollback.
- A Anamnese permanece no destino legado funcional `/admin-anamneses.html?student_id=...`; não há página placeholder.
- Student 360 permanece funcional em `/admin-student.html?student_id=...` e não redireciona para o Workspace.
- Rollback simples: desligar `PREMIUM_ADMIN_CUTOVER_ENABLED` para `/admin` abrir `/admin-legacy.html`; desligar `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED` para bloquear as listas do Workspace e exibir CTA para o legado real.
