# V4 Route Inventory

Auditoria automática informativa das rotas declaradas no Worker e endpoints consumidos pelo frontend. Não remove endpoints e não altera runtime.

Resumo: 51 rotas declaradas/prefixos/padrões no Worker; 38 rotas consumidas pelo frontend; 11 possíveis rotas órfãs para revisão manual.

## Rotas declaradas no Worker

| Método | Rota | Tipo | Observação |
|---|---|---|---|
| ANY | /api/admin/* | startsWith | rota/prefixo dinâmico |
| GET | /api/admin/alerts | exact | — |
| POST | /api/admin/alerts/send | exact | — |
| GET | /api/admin/anamneses | exact | — |
| GET | /api/admin/checkins | exact | — |
| GET | /api/admin/command-center | exact | — |
| GET | /api/admin/endpoint-usage | exact | — |
| GET | /api/admin/followup-alerts | exact | — |
| POST | /api/admin/followup-log | exact | — |
| GET | /api/admin/followup-logs | exact | — |
| POST | /api/admin/followup-resolve | exact | — |
| GET | /api/admin/health-check | exact | — |
| GET | /api/admin/leads | exact | — |
| GET | /api/admin/metrics | exact | — |
| GET | /api/admin/nutrition-plan | exact | — |
| POST | /api/admin/nutrition-plan | exact | — |
| GET | /api/admin/operational-logs | exact | — |
| GET | /api/admin/portal-alerts | exact | — |
| POST | /api/admin/reactivation-contact | exact | — |
| POST | /api/admin/retention-action | exact | — |
| GET | /api/admin/retention-actions | exact | — |
| GET | /api/admin/student-360 | exact | — |
| POST | /api/admin/student-access | exact | — |
| POST | /api/admin/student-access/activate | exact | — |
| POST | /api/admin/student-access/status | exact | — |
| POST | /api/admin/student-access/token | exact | — |
| GET | /api/admin/students | exact | — |
| POST | /api/admin/weekly-plan | exact | — |
| POST | /api/anamnese-premium | exact | — |
| POST | /api/diagnostic/evaluate | exact | — |
| GET | /api/health | exact | — |
| ANY | /api/portal/* | startsWith | rota/prefixo dinâmico |
| POST | /api/portal/checkin | exact | — |
| GET | /api/portal/checkins | exact | — |
| POST | /api/portal/login | exact | — |
| GET | /api/portal/me | exact | — |
| GET | /api/portal/nutrition-plan | exact | — |
| GET | /api/portal/progression | exact | — |
| POST | /api/portal/progression | exact | — |
| GET | /api/portal/project-lm/consistency | exact | — |
| GET | /api/portal/project-lm/current-mission | exact | — |
| POST | /api/portal/project-lm/daily-actions | exact | — |
| GET | /api/portal/project-lm/daily-actions/summary | exact | — |
| GET | /api/portal/project-lm/library | exact | — |
| POST | /api/portal/project-lm/library/complete | exact | — |
| GET | /api/portal/project-lm/profile | exact | — |
| POST | /api/portal/project-lm/profile | exact | — |
| GET | /api/portal/weekly-plan | exact | — |
| ANY | /api/project-lm/* | startsWith | rota/prefixo dinâmico |
| GET | /api/project-lm/profile | exact | — |
| POST | /api/project-lm/profile | exact | — |

## Rotas consumidas pelo Frontend

| Rota | Arquivos |
|---|---|
| /api/admin/anamneses | admin-anamneses.html |
| /api/admin/anamneses/ | admin-anamneses.html |
| /api/admin/anamneses/:param | admin-anamneses.html |
| /api/admin/checkins | admin-checkins.html |
| /api/admin/checkins/:param/reply | admin-checkins.html, admin-student.html |
| /api/admin/command-center | admin-command-center.html, admin-login.html |
| /api/admin/followup-alerts | admin-followup.html |
| /api/admin/followup-log | admin-followup.html |
| /api/admin/followup-logs | admin-followup.html |
| /api/admin/health-check | admin-command-center.html |
| /api/admin/nutrition-plan | admin-nutrition-plan.html |
| /api/admin/operational-logs | admin-command-center.html |
| /api/admin/portal-alerts | admin-alerts.html |
| /api/admin/reactivation-contact | admin-command-center.html |
| /api/admin/retention-action | admin-followup.html |
| /api/admin/retention-actions | admin-followup.html |
| /api/admin/student-360 | admin-student.html |
| /api/admin/student-access | admin-students.html |
| /api/admin/student-access/activate | admin-student.html |
| /api/admin/student-access/status | admin-command-center.html, admin-student.html |
| /api/admin/student-access/token | admin-student.html |
| /api/admin/students | admin-student.html |
| /api/admin/weekly-plan | admin-student.html, admin-weekly-plan.html |
| /api/anamnese-premium | anamnese-premium.html |
| /api/portal/checkin | portal-checkin.html |
| /api/portal/checkins | portal-checkin.html, portal.html |
| /api/portal/login | portal-login.html |
| /api/portal/nutrition-plan | portal-plano-alimentar-print.html, portal-plano-alimentar.html |
| /api/portal/progression | portal-progressao.html |
| /api/portal/project-lm/consistency | projeto-lm-conquistas.html, projeto-lm-consistencia.html, projeto-lm-estatisticas.html, projeto-lm-jornada.html |
| /api/portal/project-lm/current-mission | projeto-lm-jornada.html |
| /api/portal/project-lm/daily-actions | projeto-lm-dia-dificil.html, projeto-lm-planejamento.html |
| /api/portal/project-lm/daily-actions/summary | projeto-lm-conquistas.html, projeto-lm-estatisticas.html, projeto-lm-jornada.html |
| /api/portal/project-lm/library | projeto-lm-biblioteca.html, projeto-lm-conquistas.html, projeto-lm-estatisticas.html, projeto-lm-jornada.html |
| /api/portal/project-lm/library/:param | projeto-lm-conteudo.html |
| /api/portal/project-lm/library/complete | projeto-lm-conteudo.html |
| /api/portal/weekly-plan | portal.html |
| /api/project-lm/profile | project-lm-profile.js, public/assets/js/lm-access.js |

## Rotas críticas protegidas

- /api/portal/login
- /api/portal/me
- /api/portal/checkin
- /api/portal/nutrition-plan
- /api/portal/progression
- /api/admin/command-center
- /api/admin/student-360
- /api/admin/students
- /api/admin/health-check
- /api/admin/operational-logs
- /api/project-lm/profile
- /api/portal/project-lm/current-mission
- /api/portal/project-lm/daily-actions/summary

## Possíveis rotas órfãs

- GET /api/admin/alerts — não encontrada no frontend — revisar manualmente
- POST /api/admin/alerts/send — não encontrada no frontend — revisar manualmente
- GET /api/admin/endpoint-usage — não encontrada no frontend — revisar manualmente
- POST /api/admin/followup-resolve — não encontrada no frontend — revisar manualmente
- GET /api/admin/leads — não encontrada no frontend — revisar manualmente
- GET /api/admin/metrics — não encontrada no frontend — revisar manualmente
- POST /api/diagnostic/evaluate — não encontrada no frontend — revisar manualmente
- GET /api/health — não encontrada no frontend — revisar manualmente
- GET /api/portal/me — não encontrada no frontend — revisar manualmente
- GET /api/portal/project-lm/profile — não encontrada no frontend — revisar manualmente
- POST /api/portal/project-lm/profile — não encontrada no frontend — revisar manualmente

## Auditoria de uso real dos endpoints (V4-08)

Rotas marcadas como possíveis órfãs na V4-07 não devem ser removidas antes de 2–4 semanas de observação via /api/admin/endpoint-usage.
