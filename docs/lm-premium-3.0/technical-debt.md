# Dívida técnica, código morto e duplicações

## P0
- Worker monolítico com Premium, Projeto LM, admin, schema bootstrap e helpers no mesmo arquivo; risco alto em qualquer alteração de Build 1.
- Fronteira de produto incompleta: rotas Projeto LM sob `/api/portal/project-lm/*` e login compartilhado por `student_access.plan`.
- MFit precisa permanecer externo; qualquer uso das tabelas `training_*` no Premium violaria a regra de produto.

## P1
- Contratos de payload/resposta não estão centralizados; páginas consomem objetos implícitos.
- `admin-student.html` é muito grande e concentra múltiplas responsabilidades.
- Bootstrap SQL no Worker duplica migrations.
- Autenticação por headers/localStorage exige revisão de expiração, rotação e isolamento.

## P2
- Código inline repetido em páginas HTML para fetch/render/status.
- CSS e padrões visuais duplicados entre páginas admin/portal.
- Queries agregadas e normalização aparecem em múltiplos handlers.
- Páginas legadas admin (`leads`, `metrics`, `alerts`) ainda expostas no Worker.

## P3
- Documentação prévia extensa e dispersa exige índice de leitura.
- Nomes históricos (`project_lm_profile`, `project_lm_profiles`, LM2/V5) aumentam carga cognitiva.

## Código aparentemente morto ou legado
Sem remoção neste Build:
- Rotas admin de leads/metrics/alerts/commercial parecem legado de funil, não Premium 3.0.
- `project_lm_profile` parece substituída por `project_lm_profiles`.
- Páginas `projeto-lm-*.html` raiz coexistem com `public/project-lm-2.html`, `public/project-lm-v5.html` e `public/projeto-lm/index.html`.
- Relatórios antigos na raiz (`CONSOLIDATION_REPORT.md`, `DEAD_CODE_REPORT.md`, `SYSTEM_FLOW_REPORT.md`) são documentação legado, não runtime.

## Duplicações encontradas
- Profile Projeto LM: tabela singular e plural.
- Rotas profile Projeto LM aceitam `/api/project-lm/profile` e `/api/portal/project-lm/profile`.
- Bootstrap de schema em Worker versus migrations SQL.
- Helpers de fetch/status em várias páginas admin.
- Padrões de listagem/filtro em `admin-followup.html`, `admin-checkins.html`, `admin-command-center.html`.
- Roteamento manual repetido por `if` no Worker em vez de mapa declarativo.

## Performance
- `workers/api.js` tem milhares de linhas e é o principal gargalo de manutenção/performance cognitiva.
- Páginas grandes: `admin-student.html`, `admin-command-center.html`, `admin-followup.html`, `admin-nutrition-plan.html`.
- Consultas agregadas do command center e student-360 devem ser protegidas antes de expandir Premium 3.0.
