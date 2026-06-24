# V4 Dependency Inventory

## Resumo
- total_html_files: 31
- total_js_files: 5
- total_css_files: 2
- total_asset_files: 0
- referenced_files: 30
- potential_orphan_files: 8

> Arquivos marcados como potential_orphan não devem ser removidos automaticamente. Revisar manualmente e cruzar com uso real antes de excluir.

## HTML Pages

| Arquivo | Referenciado por | Status |
|---|---|---|
| admin-alerts.html | — | potential_orphan |
| admin-anamneses.html | admin-student.html | referenced |
| admin-checkins.html | — | potential_orphan |
| admin-command-center.html | admin-anamneses.html, admin-command-center.html, admin-student.html, admin-students.html, admin.html | entrypoint |
| admin-followup.html | — | potential_orphan |
| admin-login.html | admin-auth.js | entrypoint |
| admin-nutrition-plan.html | admin-student.html | referenced |
| admin-student.html | admin-anamneses.html, admin-command-center.html, admin-nutrition-plan.html, admin-student.html, admin-students.html, admin.html | entrypoint |
| admin-students.html | admin-command-center.html, admin-student.html, admin-students.html, admin.html | entrypoint |
| admin-weekly-plan.html | — | potential_orphan |
| admin.html | admin-anamneses.html, admin-command-center.html, admin-login.html, admin-nutrition-plan.html, admin-student.html, admin-students.html, admin.html | entrypoint |
| anamnese-premium.html | — | entrypoint |
| index.html | admin-alerts.html, admin-followup.html, admin-weekly-plan.html | referenced |
| portal-biblioteca.html | portal.html | referenced |
| portal-checkin.html | portal-shared.js, portal.html, public/assets/js/lm-access.js | entrypoint |
| portal-login.html | index.html, portal-shared.js | entrypoint |
| portal-plano-alimentar-print.html | — | potential_orphan |
| portal-plano-alimentar.html | portal-plano-alimentar-print.html, portal-shared.js, portal.html, public/assets/js/lm-access.js | entrypoint |
| portal-progressao.html | portal-shared.js, portal.html, public/assets/js/lm-access.js | entrypoint |
| portal.html | portal-shared.js, project-lm-profile.js, public/assets/js/lm-access.js | entrypoint |
| project-lm-profile.html | project-lm-planning.js, public/assets/js/lm-access.js | referenced |
| projeto-lm-biblioteca.html | projeto-lm-conteudo.html, projeto-lm-estatisticas.html, projeto-lm-jornada.html, public/assets/js/lm-access.js | entrypoint |
| projeto-lm-conquistas.html | projeto-lm-jornada.html, public/assets/js/lm-access.js | entrypoint |
| projeto-lm-consistencia.html | portal.html, public/assets/js/lm-access.js | referenced |
| projeto-lm-conteudo.html | — | potential_orphan |
| projeto-lm-dia-dificil.html | portal.html, projeto-lm-consistencia.html, projeto-lm-estatisticas.html, public/assets/js/lm-access.js | referenced |
| projeto-lm-estatisticas.html | — | potential_orphan |
| projeto-lm-jornada.html | portal.html, project-lm-profile.js, projeto-lm-dia-dificil.html, projeto-lm-estatisticas.html, projeto-lm-plano-inicial.html, public/assets/js/lm-access.js | entrypoint |
| projeto-lm-onboarding.html | — | entrypoint |
| projeto-lm-planejamento.html | projeto-lm-jornada.html, public/assets/js/lm-access.js | entrypoint |
| projeto-lm-plano-inicial.html | — | potential_orphan |

## JS Files

| Arquivo | Referenciado por | Status |
|---|---|---|
| admin-auth.js | admin-alerts.html, admin-anamneses.html, admin-checkins.html, admin-command-center.html, admin-followup.html, admin-login.html, admin-nutrition-plan.html, admin-student.html, admin-students.html, admin-weekly-plan.html, admin.html | referenced |
| portal-shared.js | portal-biblioteca.html, portal-checkin.html, portal-login.html, portal-plano-alimentar-print.html, portal-plano-alimentar.html, portal-progressao.html, portal.html, project-lm-profile.html, projeto-lm-biblioteca.html, projeto-lm-conquistas.html, projeto-lm-consistencia.html, projeto-lm-conteudo.html, projeto-lm-dia-dificil.html, projeto-lm-estatisticas.html, projeto-lm-jornada.html, projeto-lm-planejamento.html, projeto-lm-plano-inicial.html | referenced |
| project-lm-planning.js | projeto-lm-planejamento.html | referenced |
| project-lm-profile.js | project-lm-profile.html | referenced |
| public/assets/js/lm-access.js | portal-biblioteca.html, portal-checkin.html, portal-plano-alimentar.html, portal-progressao.html, portal.html, project-lm-profile.html, projeto-lm-biblioteca.html, projeto-lm-conquistas.html, projeto-lm-consistencia.html, projeto-lm-conteudo.html, projeto-lm-dia-dificil.html, projeto-lm-estatisticas.html, projeto-lm-jornada.html, projeto-lm-planejamento.html, projeto-lm-plano-inicial.html | referenced |

## CSS Files

| Arquivo | Referenciado por | Status |
|---|---|---|
| portal.css | admin-alerts.html, admin-anamneses.html, admin-checkins.html, admin-command-center.html, admin-followup.html, admin-login.html, admin-nutrition-plan.html, admin-student.html, admin-students.html, admin-weekly-plan.html, admin.html, anamnese-premium.html, portal-biblioteca.html, portal-checkin.html, portal-login.html, portal-plano-alimentar.html, portal-progressao.html, portal.html, project-lm-profile.html, projeto-lm-biblioteca.html, projeto-lm-conquistas.html, projeto-lm-consistencia.html, projeto-lm-conteudo.html, projeto-lm-dia-dificil.html, projeto-lm-estatisticas.html, projeto-lm-jornada.html, projeto-lm-planejamento.html, projeto-lm-plano-inicial.html | referenced |
| project-lm.css | project-lm-profile.html, projeto-lm-planejamento.html | referenced |

## Assets

| Arquivo | Referenciado por | Status |
|---|---|---|
| — | — | — |

## potential_orphan

- admin-alerts.html
- admin-checkins.html
- admin-followup.html
- admin-weekly-plan.html
- portal-plano-alimentar-print.html
- projeto-lm-conteudo.html
- projeto-lm-estatisticas.html
- projeto-lm-plano-inicial.html
