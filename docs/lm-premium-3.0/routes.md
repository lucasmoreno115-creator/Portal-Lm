# Rotas HTTP

## Convenções de resposta
A maioria das rotas retorna JSON no formato `{ ok: true, data: ... }` ou erro `{ ok: false, error: ... }`. Rotas autenticadas de aluno dependem de `x-student-email`/`x-student-token`; rotas admin dependem dos headers de `admin-auth.js`.

## Públicas
| Método | Endpoint | Arquivo/função | Quem usa | Payload | Resposta |
|---|---|---|---|---|---|
| GET | `/api/health` | `workers/api.js` fetch handler | health/tests | none | status de saúde |
| POST | `/api/diagnostic/evaluate` | `workers/api.js` | landing/legado | diagnóstico | resultado/leads |
| POST | `/api/anamnese-premium` | `workers/api.js` | `anamnese-premium.html` | respostas anamnese | registro criado |
| POST | `/api/portal/login` | `workers/api.js` | `portal-login.html` | `{email, token}` | dados do aluno/acesso |

## Aluno Premium
| Método | Endpoint | Arquivo/função | Quem usa | Payload | Resposta |
|---|---|---|---|---|---|
| GET | `/api/portal/me` | `workers/api.js` | `portal.html` | headers aluno | perfil/acesso |
| GET | `/api/portal/weekly-plan` | `workers/api.js` | `portal.html` | headers aluno | plano semanal ativo/recente |
| GET | `/api/portal/nutrition-plan` | `workers/api.js` | `portal-plano-alimentar*.html` | headers aluno | plano alimentar ativo |
| POST | `/api/portal/checkin` | `workers/api.js` | `portal-checkin.html` | check-in | check-in salvo |
| GET | `/api/portal/checkins` | `workers/api.js` | `portal.html` | headers aluno | histórico check-ins |
| POST | `/api/portal/progression` | `workers/api.js` | `portal-progressao.html` | peso/medidas/fotos/metas | progressão salva |
| GET | `/api/portal/progression` | `workers/api.js` | `portal-progressao.html`, `portal.html` | headers aluno | histórico progressão |

## Admin Premium
| Método | Endpoint | Arquivo/função | Quem usa | Payload | Resposta |
|---|---|---|---|---|---|
| POST | `/api/admin/session/login` | `workers/api.js` | `admin-auth.js` | credenciais admin | sessão/token |
| POST | `/api/admin/session/logout` | `workers/api.js` | `admin-auth.js` | sessão | ok |
| GET | `/api/admin/students` | `workers/api.js` | `admin-students.html`, `admin-student.html` | admin headers | lista alunos |
| GET | `/api/admin/student-360` | `workers/api.js`/`student360` | `admin-student.html` | query `email` | visão consolidada |
| POST | `/api/admin/student-access` | `workers/api.js` | `admin-students.html` | dados acesso | upsert aluno |
| POST | `/api/admin/student-access/token` | `workers/api.js` | `admin-student.html` | email | novo token |
| POST | `/api/admin/student-access/activate` | `workers/api.js` | `admin-student.html` | email/status | ativação |
| POST | `/api/admin/student-access/status` | `workers/api.js` | `admin-student.html`, `admin-command-center.html` | email/status | status atualizado |
| POST | `/api/admin/weekly-plan` | `workers/api.js` | `admin-weekly-plan.html`, `admin-student.html` | plano semanal | plano salvo |
| GET | `/api/admin/nutrition-plan` | `workers/api.js` | `admin-nutrition-plan.html` | query `email` | plano alimentar |
| POST | `/api/admin/nutrition-plan` | `workers/api.js` | `admin-nutrition-plan.html` | plano alimentar | plano salvo/publicado |
| GET | `/api/admin/checkins` | `workers/api.js` | `admin-checkins.html` | filtros | check-ins |
| PATCH | `/api/admin/checkins/:id/reply` | `workers/api.js` | `admin-checkins.html`, `admin-student.html` | resposta/status | check-in atualizado |
| POST | `/api/admin/followup-log` | `workers/api.js` | `admin-followup.html` | log | log salvo |
| GET | `/api/admin/followup-logs` | `workers/api.js` | `admin-followup.html` | filtros | logs |
| POST | `/api/admin/followup-resolve` | `workers/api.js` | admin/follow-up | resolução | ok |
| POST | `/api/admin/retention-action` | `workers/api.js` | `admin-followup.html` | ação | ação salva |
| GET | `/api/admin/retention-actions` | `workers/api.js` | `admin-followup.html` | filtros | ações |
| POST | `/api/admin/reactivation-contact` | `workers/api.js` | `admin-command-center.html` | contato | ok |
| GET | `/api/admin/command-center` | `workers/api.js` | `admin-command-center.html` | admin headers | dashboard |
| GET | `/api/admin/followup-alerts` | `workers/api.js` | `admin-followup.html`, `admin-command-center.html` | admin headers | alertas follow-up |
| GET | `/api/admin/portal-alerts` | `workers/api.js` | `admin-alerts.html`, `admin-command-center.html` | admin headers | alertas portal |
| GET | `/api/admin/anamneses` | `workers/api.js` | `admin-anamneses.html` | admin headers | lista anamneses |
| GET | `/api/admin/anamneses/:id` | `workers/api.js` | `admin-anamneses.html` | admin headers | detalhe anamnese |
| PATCH | `/api/admin/anamneses/:id` | `workers/api.js` | `admin-anamneses.html` | status | anamnese atualizada |
| GET | `/api/admin/endpoint-usage` | `workers/api.js` | comando/testes | filtros | uso endpoints |
| GET | `/api/admin/operational-logs` | `workers/api.js` | `admin-command-center.html` | filtros | logs |
| GET | `/api/admin/health-check` | `workers/api.js` | `admin-command-center.html` | none | health detalhado |
| GET | `/api/admin/leads` | `workers/api.js` | legado | admin headers | leads |
| GET | `/api/admin/metrics` | `workers/api.js` | legado | admin headers | métricas |
| GET | `/api/admin/alerts` | `workers/api.js` | legado | admin headers | alertas |
| POST | `/api/admin/alerts/send` | `workers/api.js` | legado | alerta | ok |
| PATCH | `/api/admin/leads/:id/status` | `workers/api.js` | legado | status | lead atualizado |
| PATCH | `/api/admin/leads/:id/commercial` | `workers/api.js` | legado | dados comerciais | lead atualizado |

## Projeto LM / cruzamentos
Rotas `/api/project-lm-2/*` atendem LM 2; `/api/project-lm/*` atende Projeto LM V5/legado; `/api/portal/project-lm/*` é cruzamento histórico e deve ser protegido em Build 1.
