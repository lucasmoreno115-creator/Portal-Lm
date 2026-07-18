# LM Premium 3.1 — Matriz Oficial de Migração

## Nível de validação

- Auditoria remota de produção concluída.
- Status: **AUDITORIA REMOTA CONCLUÍDA — CORREÇÃO PENDENTE**.
- Ambiente: `production`.
- Banco: `lmsystemv2-db`.
- Captura: `2026-07-17T17:30:15.939Z`.
- Execução read-only: `true`.
- Zero writes: `true`.
- Status do executor: `COMPLETED`.
- Erros: `[]`.
- Nenhum backfill, deploy, alteração de flag, alteração de schema, migration, cópia de dados ou mudança de regra de negócio foi executado.

## Resultado de identidade confirmado

| Fonte | Total | Ativos | Com e-mail | Sem e-mail | Com `student_id` | Sem `student_id` | E-mails duplicados | `student_id` duplicados |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `student_access` | 18 | 18 | 18 | 0 | 0 | 18 | 0 | 0 |
| `premium_students` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Paridade confirmada

| Métrica | Contagem |
| --- | ---: |
| Presentes nas duas fontes (`in_both`) | 0 |
| Apenas em `student_access` (`only_student_access`) | 18 |
| Apenas em `premium_students` (`only_premium_students`) | 0 |
| `student_id` divergente por e-mail (`divergent_student_id_by_email`) | 0 |
| E-mail com múltiplos `student_id` (`email_with_multiple_student_ids`) | 0 |
| `student_id` com múltiplos e-mails (`student_id_with_multiple_emails`) | 0 |

## Cobertura de tabelas dependentes

| Tabela | Resultado confirmado |
| --- | --- |
| `premium_anamnesis` | 6 registros; 0 com `student_id`; 6 com e-mail; 6 correspondentes em `student_access` |
| `student_checkins` | 3 registros; 0 com `student_id`; 3 com e-mail; 3 correspondentes em `student_access` |
| `followup_logs` | 6 registros; 0 com `student_id`; 6 com e-mail; 6 correspondentes em `student_access` |
| `activity_timeline` | 45 registros; 0 com `student_id`; 45 com e-mail; 45 correspondentes em `student_access` |
| `weekly_plans` | 16 registros; 0 com `student_id`; 16 com e-mail; 16 correspondentes em `student_access` |
| `premium_pending_items` | tabela presente; 0 registros |
| `premium_followup_entries` | tabela presente; 0 registros |
| `premium_nutrition_plans` | tabela ausente |

## Matriz de migração atualizada

| Domínio | Funcionalidade | Legado | Workspace | Paridade de dados | Paridade de ação | Backend compartilhado | Status | Evidência | Prioridade |
|---|---|---|---|---|---|---|---|---|---|
| Entrada | `GET /admin` Build 6.6 | Worker consulta `PREMIUM_ADMIN_CUTOVER_ENABLED`; `false` → `/admin-legacy.html` | Worker consulta `PREMIUM_ADMIN_CUTOVER_ENABLED`; `true` → `/admin-premium-workspace.html` | sim | sim | flag Worker | MIGRADO | `workers/api.js` cutover direto; `/admin.html` só fallback estático | P2 |
| Entrada | `/admin.html` | bootstrap estático de compatibilidade/fallback | consulta endpoint de cutover quando servido | parcial | parcial | `/api/admin/premium/cutover-route` | PARCIAL | não é entrada normal com Worker ativo | P3 |
| Dashboard | KPIs gerais | command center legado | summary KPIs | parcial | não | não | PARCIAL | Workspace summary vs `/api/admin/students` | P1 |
| Dashboard | Revisão de sábado | ausente/operacional legado manual | endpoint saturday-review | parcial | parcial | premium repos | PARCIAL | `/workspace/saturday-review` | P2 |
| Alunos | Listagem base | `student_access` com 18 alunos ativos | `premium_students` com 0 registros | não | parcial | não | BLOQUEADO | causa confirmada do Workspace vazio: ausência de registros em `premium_students` e ausência de `student_id` em `student_access` | P0 |
| Alunos | Busca | e-mail/nome no legado | q no Workspace | parcial | sim | não | PARCIAL | Busca depende da fonte; ponte de identidade ainda pendente | P1 |
| Alunos | Filtros/status | 18 ativos em `student_access` | sem registros em `premium_students` | não | parcial | não | BLOQUEADO | Sem paridade enquanto Workspace não tiver fallback read-only | P0 |
| Alunos | Projeto LM excluído | deve permanecer separado | deve permanecer separado | critério obrigatório | critério obrigatório | parcial | PARCIAL | Próxima PR deve preservar separação entre Premium e Projeto LM | P0 |
| Student 360 | Perfil | dados legados resolvíveis por e-mail | contexto preferencial por `student_id` | não | links | não | BLOQUEADO | 18 alunos sem `student_id`; dados históricos correspondem por e-mail normalizado | P0 |
| Student 360 | Contato | nome/e-mail/WhatsApp | nome/e-mail/phone | parcial | não | não | PARCIAL | Requer adapter com e-mail normalizado temporário | P1 |
| Student 360 | Anamnese no 360/record | 6 registros por e-mail | por `student_id` | parcial | link parcial | parcial | PARCIAL | `premium_anamnesis`: 6/6 correspondentes por e-mail; 0 com `student_id` | P1 |
| Anamnese | Página `/admin-anamneses.html` | link/redirect esperado | arquivo ausente em `public/` | não | não | não | BLOQUEADO | Gap funcional já conhecido; fora do escopo desta auditoria documental | P0 |
| Student 360 | Check-ins/feedback | 3 registros por e-mail | por `student_id` | parcial | decisão parcial | parcial | PARCIAL | `student_checkins`: 3/3 correspondentes por e-mail; 0 com `student_id` | P1 |
| Student 360 | Plano semanal/treino | 16 registros por e-mail | não equivalente completo | não | não | não | NÃO MIGRADO | `weekly_plans`: 16/16 correspondentes por e-mail; 0 com `student_id` | P1 |
| Student 360 | Plano alimentar | e-mail/fallback legado | `premium_nutrition_plans` | não | parcial | não | BLOQUEADO | `premium_nutrition_plans` ausente em produção | P0 |
| Student 360 | Timeline/histórico | 45 registros por e-mail | evolução resumida | parcial | não | parcial | PARCIAL | `activity_timeline`: 45/45 correspondentes por e-mail; 0 com `student_id` | P1 |
| Cadastro | Criar aluno/acesso | POST `student-access` | create premium student use case sem UI equivalente auditada | não | não | não | NÃO MIGRADO | Fonte legada preenchida; fonte Premium vazia | P0 |
| Cadastro | Token/reset | POST token | não | não | não | não | NÃO MIGRADO | endpoint legado only | P1 |
| Cadastro | Ativar/inativar | activate/status | PATCH premium status parcial | parcial | parcial | não | PARCIAL | Requer paridade de identidade antes de equivalência operacional | P1 |
| Anamnese | Análise/status | use case existe | record/pending parcial | parcial | parcial | sim | PARCIAL | Dados existem e são resolvíveis por e-mail normalizado | P1 |
| Feedback | Listagem pendentes | checkins legado | weekly feedback pending JS/API divergente | parcial | parcial | parcial | PARCIAL | Dados existem e são resolvíveis por e-mail normalizado | P1 |
| Feedback | Responder/analisar | PATCH checkin reply | POST decision | parcial | parcial | tabela compartilhada parcial | PARCIAL | Requer ponte de identidade antes de consolidação | P1 |
| Nutrition | Draft | não no legado | sim | n/a | sim | premium | MIGRADO | Sem registros em `premium_nutrition_plans`; tabela ausente | P2 |
| Nutrition | Publicação | POST legado salva atual | publish endpoint | parcial | parcial | premium | PARCIAL | Fora do escopo de correção desta auditoria | P1 |
| Treinos | Plano atual/link externo | weekly plan/campos treino | link/ausente | não | não | não | NÃO MIGRADO | `weekly_plans` presente com 16 registros por e-mail | P1 |
| Evolução | Peso/medidas | checkins/progression | evolution summary | parcial | não | parcial | PARCIAL | Requer fallback temporário por e-mail normalizado | P1 |
| Inbox Premium | Carregar pendências | não é fonte legado principal | carrega `premium_pending_items` | n/a | parcial | premium | PARCIAL | `premium_pending_items` presente com 0 registros | P1 |
| Follow-up legado | Registro/resolução | `followup_logs` | não consolidado no Workspace | não | não | não | NÃO MIGRADO | `followup_logs`: 6/6 correspondentes por e-mail; 0 com `student_id` | P1 |
| Follow-up Premium | Registro no Prontuário | não | `premium_followup_entries` | não consolidado com legado | parcial | não | PARCIAL | `premium_followup_entries` presente com 0 registros | P1 |
| Retenção | Ações | `retention_actions` | não | não | não | não | NÃO MIGRADO | endpoint legado only | P2 |
| Auth | Headers admin | token/session | Workspace main ok; subpages inconsistent | divergência operacional conhecida | parcial | auth shared | BLOQUEADO | Fora do escopo da auditoria de dados; manter como gap P0 | P0 |
| Observabilidade | Logs/health/usage | endpoints admin | não ligado ao Workspace | parcial | n/a | shared | PARCIAL | ops endpoints | P3 |

## Totais

- Itens: 32
- Status: MIGRADO 2; PARCIAL 19; NÃO MIGRADO 6; BLOQUEADO 5; NÃO APLICÁVEL 0
- Prioridades: P0 8; P1 19; P2 3; P3 2
- Gaps P0 principais: Listagem base; Filtros/status; Projeto LM excluído; Student 360 — Perfil; Página `/admin-anamneses.html`; Student 360 — Plano alimentar; Cadastro — Criar aluno/acesso; Auth — Headers admin.

## Diagnóstico oficial

O Admin legado lista alunos a partir de `student_access`, que contém 18 alunos ativos. O Workspace lista alunos a partir de `premium_students`, que contém 0 registros. Todos os 18 alunos legados estão sem `student_id`.

Os dados históricos permanecem nas tabelas legadas e possuem correspondência determinística por e-mail normalizado com `student_access`. Não foi identificada perda de dados.

A causa confirmada do Workspace vazio é a ausência de registros em `premium_students`, combinada com a ausência de `student_id` nos registros de `student_access`.
