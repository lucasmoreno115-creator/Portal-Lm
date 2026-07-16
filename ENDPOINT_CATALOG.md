# Endpoint Catalog — LM Premium 3.0.0

## Aluno Premium

| Método | Endpoint | Payload | Resposta |
|---|---|---|---|
| POST | `/api/anamnese-premium` | Dados da anamnese Premium | `{ ok, ... }` com registro/análise |
| GET | `/api/portal/nutrition-plan` | Nenhum | Plano alimentar público atual |
| GET | `/api/portal/premium/nutrition-plan/current` | Nenhum | Plano publicado apresentado pelo presenter público |
| POST | `/api/portal/weekly-feedback` | Respostas semanais legadas/compatíveis | Confirmação de envio |
| GET | `/api/portal/weekly-feedback` | Nenhum | Histórico compatível de feedbacks |
| GET | `/api/portal/premium/weekly-feedback/current` | Nenhum | Feedback semanal atual/disponível |
| POST | `/api/portal/premium/weekly-feedback/current` | Campos de aderência, medidas, contexto e suporte | Feedback criado/atualizado |
| GET | `/api/portal/premium/weekly-feedback/history` | Nenhum | Histórico do aluno |

## Admin

| Método | Endpoint | Payload | Resposta |
|---|---|---|---|
| GET | `/api/admin/nutrition-plan` | Query compatível por aluno | Plano admin compatível |
| POST | `/api/admin/nutrition-plan` | Plano alimentar compatível | Plano salvo |
| GET | `/api/admin/premium/students/:student_id/record` | Nenhum | Prontuário LM |
| POST | `/api/admin/premium/students/:student_id/followup-entries` | Entrada de prontuário | Entrada criada |
| POST | `/api/admin/premium/students/:student_id/pending-items` | Pendência | Pendência criada |
| POST | `/api/admin/premium/pending-items/:id/resolve` | Responsável/contexto | Pendência resolvida |
| POST | `/api/admin/premium/students/:student_id/status` | `{ status }` | Status atualizado |
| POST | `/api/admin/premium/feedbacks/:id/decision` | `{ decision_type, note }` | Decisão registrada |
| GET | `/api/admin/premium/weekly-feedbacks/pending` | Query `limit` | Feedbacks aguardando análise |
| GET | `/api/admin/premium/weekly-feedbacks/missing` | Query `limit` | Alunos sem feedback esperado |
| POST | `/api/admin/premium/weekly-feedbacks/reminders/prepare` | Nenhum | Lembretes preparados |
| GET | `/api/admin/premium/weekly-feedbacks/:id` | Nenhum | Feedback para revisão |
| POST | `/api/admin/premium/weekly-feedbacks/:id/decision` | `{ decision_type, note }` | Decisão registrada |

## Workspace profissional

| Método | Endpoint | Payload | Resposta |
|---|---|---|---|
| GET | `/api/admin/premium/workspace/summary` | Nenhum | Resumo operacional |
| GET | `/api/admin/premium/workspace/students` | Query de filtros/paginação | Lista de alunos |
| GET | `/api/admin/premium/workspace/students/search` | Query `q`, `limit` | Resultados de busca |
| GET | `/api/admin/premium/workspace/students/:student_id` | Nenhum | Contexto do aluno |
| GET | `/api/admin/premium/workspace/pending-items` | Query de filtros | Pendências |
| GET | `/api/admin/premium/workspace/saturday-review` | Nenhum | Revisão de sábado |

## Nutrition Workflow admin

| Método | Endpoint | Payload | Resposta |
|---|---|---|---|
| GET | `/api/admin/premium/students/:student_id/nutrition-plan` | Nenhum | Atual, rascunho e histórico |
| GET | `/api/admin/premium/students/:student_id/nutrition-plan/history` | Nenhum | Histórico de planos |
| GET | `/api/admin/premium/students/:student_id/nutrition-plan/draft` | Nenhum | Rascunho atual |
| POST | `/api/admin/premium/students/:student_id/nutrition-plan/draft` | `{ plan, source_feedback_id }` | Rascunho criado |
| PATCH | `/api/admin/premium/nutrition-plans/:id/draft` | Campos do rascunho | Rascunho atualizado |
| POST | `/api/admin/premium/nutrition-plans/:id/publish` | `{ professional_note }` | Plano publicado |
| POST | `/api/admin/premium/nutrition-plans/:id/archive` | Nenhum | Plano arquivado |
| POST | `/api/admin/premium/nutrition-plans/:id/duplicate-as-draft` | `{ source_feedback_id }` | Novo rascunho |

## Internos

Rotas internas são compostas no worker por use cases, repositories, services e presenters. Scripts operacionais de auditoria, smoke e verify suportam validação fora do runtime HTTP.

## Compatibilidade

Rotas legadas de plano alimentar e feedback semanal permanecem documentadas como compatíveis. Payloads públicos não foram alterados nesta release.

## Projeto LM

Endpoints e arquivos do Projeto LM permanecem fora do escopo funcional da Release 3.0.0. Qualquer referência é apenas de isolamento/compatibilidade.

## Build 6.6 — Admin Premium cutover

A rota oficial `/admin` consome os endpoints `/api/admin/premium/workspace/*`, resolução de pendências em `/api/admin/premium/pending-items/:id/resolve`, Prontuário em `/api/admin/premium/students/:student_id/record`, Feedback Semanal em `/api/admin/premium/weekly-feedbacks/*` e Plano Alimentar em `/api/admin/premium/students/:student_id/nutrition-plan*`.
