# Arquitetura atual

## Modelo geral
- **Frontend**: HTML estático sem bundler para Premium/Admin; runtime separado para Projeto LM em `public/assets/js` e `src/projeto-lm`.
- **API**: um Cloudflare Worker principal em `workers/api.js`, com roteamento manual por `if (url.pathname...)`.
- **Banco**: Cloudflare D1 acessado por `env.DB`.
- **Autenticação aluno**: headers `x-student-email` e `x-student-token` enviados por `portal-shared.js`.
- **Autenticação admin**: `admin-auth.js` usa `POST /api/admin/session/login`; headers admin são aplicados em páginas admin.
- **Observabilidade**: logs operacionais e endpoint usage em tabelas D1 e serviços auxiliares.

## Componentes

### Premium aluno
- `portal-login.html`: autentica e roteia por plano.
- `portal.html`: dashboard, plano semanal, histórico, link MFit.
- `portal-plano-alimentar.html` e print: leitura do plano ativo.
- `portal-checkin.html`: submissão de check-in.
- `portal-progressao.html`: registro e leitura de progressão.
- `portal-shared.js`: helper `api()`, armazenamento local e headers.

### Premium admin
- `admin-auth.js`: sessão admin, headers, logout.
- `admin.html`: entrada/admin hub.
- `admin-students.html`: lista e criação/atualização de acesso.
- `admin-student.html`: visão 360 e operações de aluno.
- `admin-checkins.html`: fila e resposta de check-ins.
- `admin-nutrition-plan.html`: edição/publicação de plano alimentar.
- `admin-weekly-plan.html`: plano semanal.
- `admin-followup.html`: logs, ações e alertas de acompanhamento.
- `admin-command-center.html`: painel operacional consolidado.
- `admin-alerts.html`: alertas do portal.
- `admin-anamneses.html`: leitura e status de anamneses.

### Backend
- `workers/api.js`: roteamento, handlers, schema bootstrap, helpers e parte relevante da lógica de domínio.
- `workers/services/auth-service.js`: validação de autenticação.
- `workers/services/health-check-service.js`: checagens de saúde.
- `workers/services/operational-log-service.js`: persistência de logs.
- `workers/services/endpoint-usage-service.js`: telemetria de uso.
- `workers/command-center.js`: agregações do comando central.
- `workers/student360.js`: agregação do aluno.
- `workers/timeline-engine.js`: eventos de timeline.
- `workers/student-lifecycle.js`: lifecycle/follow-up.

## Separação Premium x Projeto LM
- Separação visual: páginas Premium começam com `portal`/`admin`; Projeto LM usa `projeto-lm-*`, `project-lm-*`, `public/project-lm-*` e `src/projeto-lm`.
- Separação incompleta no backend: `workers/api.js` concentra Premium e Projeto LM.
- Dependência cruzada relevante: `portal-login.html` redireciona para `/projeto-lm/` quando `plan === 'projeto_lm'`; `student_access.plan` decide produto.
- Rotas Projeto LM antigas usam prefixo `/api/portal/project-lm/*`, o que mistura namespace de portal com produto automatizado.

## MFit
- O MFit aparece como link externo em `portal.html`.
- Não há evidência de API MFit, sincronização de treino ou tabelas Premium de treino.
- Treino oficial pertence ao MFit; o Portal só organiza acompanhamento Premium e pode apresentar direcionamento/link.

## Pontos fortes
- Páginas estáticas simples e de baixo acoplamento de build.
- D1 bootstrap defensivo com `CREATE TABLE IF NOT EXISTS`.
- Índices de performance já adicionados para check-ins, planos, follow-up e logs.
- Existência de testes para contratos, segurança e runtime Projeto LM.
- Serviços auxiliares já extraídos para saúde, logs, uso e autenticação.

## Pontos fracos
- Worker principal muito grande e com múltiplos domínios.
- Roteamento manual dificulta inventário e teste isolado.
- Fronteira Premium/Projeto LM ainda passa por `student_access` e rotas `/api/portal/project-lm/*`.
- Contratos de payload/resposta vivem implícitos no código e nas páginas.
- HTML admin contém muita lógica inline, especialmente `admin-student.html`.
