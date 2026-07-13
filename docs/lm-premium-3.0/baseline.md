# LM Premium 3.0 — Baseline técnico (Build 0)

## Escopo da auditoria
Este documento é uma fotografia do Portal LM antes da migração LM Premium 3.0. Nenhuma funcionalidade, API, migration, HTML, CSS, JavaScript, Worker ou comportamento foi alterado; somente documentação foi criada.

## Estrutura encontrada

### Raiz
- Páginas Premium/aluno/admin: `portal*.html`, `admin*.html`, `anamnese-premium.html`.
- Páginas Projeto LM legado: `projeto-lm-*.html`, `project-lm-profile.html`, `project-lm-profile.js`, `project-lm-planning.js`, `project-lm.css`.
- Entradas públicas modernas: `public/project-lm-2.html`, `public/project-lm-v5.html`, `public/projeto-lm/index.html`.
- Worker principal: `workers/api.js`.
- Serviços auxiliares do Worker: `workers/services/*.js`, `workers/command-center.js`, `workers/student360.js`, `workers/timeline-engine.js`, `workers/student-lifecycle.js`, `workers/lm-utils.js`.
- Migrations: `migrations/0004` a `0024`.
- Testes: `tests/*.test.mjs` e `src/projeto-lm/tests/*.test.mjs`.
- Assets: `assets/hero-lm.jpg`, `assets/logo-lm-gold.png`, `public/assets/**`.

### Diretórios
- `.github/workflows`: deploy e quality gates do Projeto LM.
- `assets`: imagens compartilhadas da landing/portal.
- `docs`: auditorias anteriores, contratos e roadmaps.
- `migrations`: D1 SQL versionado.
- `public`: artefato estático priorizado para Pages/Projeto LM 2/V5.
- `scripts`: scripts de build/check do runtime Projeto LM.
- `src/projeto-lm`: engines, adapters, services, UI e testes de domínio do Projeto LM.
- `workers`: Cloudflare Worker API e módulos operacionais.

## Produtos e fronteiras atuais

### Consultoria LM Premium
Área centrada em aluno Premium e operação administrativa. Usa login por `student_access`, plano semanal, plano alimentar, check-ins, progressão, follow-up, timeline, anamneses e comando administrativo.

### Projeto LM
Produto automatizado com páginas próprias e APIs `/api/project-lm/*`, `/api/project-lm-2/*` e algumas rotas históricas sob `/api/portal/project-lm/*`. Possui runtime público separado em `public/assets/js` e domínio em `src/projeto-lm`.

## Fluxos Premium encontrados
1. **Login aluno Premium**: `portal-login.html` → `POST /api/portal/login` → `student_access` → localStorage → `portal.html` ou redirecionamento Projeto LM conforme `plan`.
2. **Home aluno**: `portal.html` → `portal-shared.js` → `GET /api/portal/me`, `GET /api/portal/weekly-plan`, `GET /api/portal/checkins`, `GET /api/portal/progression`.
3. **Plano alimentar aluno**: `portal-plano-alimentar.html`/print → `GET /api/portal/nutrition-plan` → `nutrition_plans`.
4. **Check-in aluno**: `portal-checkin.html` → `POST /api/portal/checkin` → `student_checkins` + `activity_timeline`.
5. **Progressão aluno**: `portal-progressao.html` → `POST/GET /api/portal/progression` → `progression_logs` + `activity_timeline`.
6. **Admin login**: `admin-login.html`/`admin-auth.js` → `POST /api/admin/session/login` → session token em localStorage.
7. **Admin aluno 360**: `admin-student.html` → `GET /api/admin/students`, `GET /api/admin/student-360` → agrega acesso, planos, check-ins, progressão, follow-up e timeline.
8. **Admin plano alimentar**: `admin-nutrition-plan.html` → `GET/POST /api/admin/nutrition-plan` → `nutrition_plans` + timeline.
9. **Admin check-ins**: `admin-checkins.html` → `GET /api/admin/checkins`, `PATCH /api/admin/checkins/:id/reply` → `student_checkins` + timeline.
10. **Admin follow-up/comando**: `admin-followup.html`, `admin-command-center.html`, `admin-alerts.html` → rotas `/api/admin/followup-*`, `/retention-*`, `/portal-alerts`, `/command-center`.
11. **Anamnese Premium**: `anamnese-premium.html` → `POST /api/anamnese-premium` → `premium_anamnesis`; admin lê por `/api/admin/anamneses`.
12. **MFit**: `portal.html` apenas expõe link externo para `mfitpersonal.com.br`; treino continua fora do Portal.

## Arquivos que realmente importam para Premium
- Frontend aluno Premium: `portal-login.html`, `portal.html`, `portal-shared.js`, `portal.css`, `portal-plano-alimentar.html`, `portal-plano-alimentar-print.html`, `portal-checkin.html`, `portal-progressao.html`, `portal-biblioteca.html`.
- Frontend admin Premium: `admin-auth.js`, `admin-login.html`, `admin.html`, `admin-student.html`, `admin-students.html`, `admin-checkins.html`, `admin-nutrition-plan.html`, `admin-weekly-plan.html`, `admin-followup.html`, `admin-alerts.html`, `admin-command-center.html`, `admin-anamneses.html`.
- Backend Premium: `workers/api.js`, `workers/services/auth-service.js`, `workers/services/health-check-service.js`, `workers/services/operational-log-service.js`, `workers/services/endpoint-usage-service.js`, `workers/command-center.js`, `workers/student360.js`, `workers/timeline-engine.js`, `workers/student-lifecycle.js`.
- Banco Premium: `student_access`, `student_checkins`, `progression_logs`, `weekly_plans`, `nutrition_plans`, `followup_logs`, `retention_actions`, `activity_timeline`, `premium_anamnesis`, `operational_logs`.

## Resumo executivo
O Portal LM é uma aplicação estática com Cloudflare Worker monolítico. O Premium está funcionalmente presente como portal do aluno + backoffice admin, mas divide autenticação, tabelas e Worker com o Projeto LM. A migração deve começar por proteção de fronteiras, contratos e testes de regressão, não por reescrita imediata.
