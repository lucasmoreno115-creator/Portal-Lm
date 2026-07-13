# Mapa de dependências

## Premium aluno
```text
portal-login.html
  -> portal-shared.js api()
  -> POST /api/portal/login
  -> workers/api.js
  -> student_access
  -> localStorage lm_student_*
  -> portal.html ou /projeto-lm/
```

```text
portal.html
  -> portal.css
  -> portal-shared.js
  -> GET /api/portal/me -> student_access
  -> GET /api/portal/weekly-plan -> weekly_plans
  -> GET /api/portal/checkins -> student_checkins
  -> GET /api/portal/progression -> progression_logs
  -> link externo MFit
```

```text
portal-plano-alimentar.html / print
  -> portal.css
  -> portal-shared.js
  -> GET /api/portal/nutrition-plan
  -> nutrition_plans
```

```text
portal-checkin.html
  -> portal.css
  -> portal-shared.js
  -> POST /api/portal/checkin
  -> student_checkins
  -> activity_timeline
```

```text
portal-progressao.html
  -> portal.css
  -> portal-shared.js
  -> POST/GET /api/portal/progression
  -> progression_logs
  -> activity_timeline
```

## Premium admin
```text
admin-login.html
  -> admin-auth.js
  -> POST /api/admin/session/login
  -> workers/services/auth-service.js
```

```text
admin-student.html
  -> admin-auth.js
  -> /api/admin/students
  -> /api/admin/student-360
  -> workers/student360.js + workers/api.js
  -> student_access, weekly_plans, nutrition_plans, student_checkins, progression_logs, followup_logs, retention_actions, activity_timeline
```

```text
admin-nutrition-plan.html
  -> admin-auth.js
  -> GET/POST /api/admin/nutrition-plan
  -> nutrition_plans
  -> activity_timeline
```

```text
admin-command-center.html
  -> admin-auth.js
  -> /api/admin/command-center
  -> /api/admin/health-check
  -> /api/admin/operational-logs
  -> /api/admin/followup-alerts
  -> /api/admin/portal-alerts
  -> workers/command-center.js, health/log services
```

## Projeto LM
```text
public/project-lm-2.html
  -> public/assets/js/project-lm-2-router.js
  -> public/assets/js/project-lm-2-app.js
  -> /api/project-lm-2/*
  -> lm2_* tables
```

```text
public/project-lm-v5.html
  -> /assets/js/project-lm-v5-app.js
  -> /api/project-lm/*
  -> project_lm_* tables
```

## Dependências cruzadas
- Login Premium consulta `student_access.plan` e redireciona para Projeto LM.
- Projeto LM usa algumas rotas sob `/api/portal/project-lm/*`.
- Worker e D1 são compartilhados entre produtos.
- `endpoint-usage-service` classifica áreas por prefixo; namespaces mistos podem afetar métricas.
