# V4 API Modularization Plan

## Objetivo

Definir um plano técnico seguro para modularizar o `workers/api.js`, reduzindo complexidade, acoplamento e custo de manutenção sem alterar comportamento observável. A modularização deve preservar rotas, payloads, autenticação, integrações com D1, HTML existente e contratos usados pelos testes.

## Estado atual

O `workers/api.js` ainda atua como worker principal da aplicação e concentra responsabilidades de múltiplos domínios:

- roteamento
- autenticação
- portal do aluno
- admin
- Projeto LM
- Student 360
- Command Center
- health check
- operational logs
- endpoint usage
- schema runtime
- helpers compartilhados

Esse acúmulo torna mudanças futuras mais arriscadas, porque alterações em um domínio podem afetar rotas críticas de outros domínios. O objetivo da modularização é separar responsabilidades de forma incremental, mantendo o worker como ponto de entrada e sem mudar a API pública durante as extrações.

## Princípios de segurança

- Realizar uma mudança estrutural por PR.
- Não remover nenhuma rota durante a modularização.
- Manter smoke tests antes e depois de cada extração.
- Manter o route inventory atualizado quando houver reorganização relevante.
- Manter o dependency inventory atualizado quando houver mudança em dependências internas.
- Manter health check e operational logs funcionando em todos os PRs.
- Preservar exports usados por testes.
- Garantir rollback simples por PR, com escopo pequeno e reversível.
- Não misturar refatoração com feature.

## Ordem recomendada de extração

### Fase 1 — Utils puros

- `lm-utils.js` já existe e deve continuar sendo a base para helpers puros.
- Normalização de email.
- Normalização de plano.
- Helpers de texto.
- `safeJson` / `safeJsonParse`, se aplicável e se não houver dependências de runtime que aumentem o risco.

### Fase 2 — Observabilidade

- `operational-logs.js`.
- `health-check.js`.
- `endpoint-usage.js`.

### Fase 3 — Auth

- `admin-auth.js` ou `auth.js`.
- `validateStudent`.
- `isAdminAuthorized`.

### Fase 4 — Projeto LM

- `project-lm-routes.js`.
- `project-lm-profile`.
- daily actions.
- library.
- consistency.
- milestones.

### Fase 5 — Portal Premium

- `portal-routes.js`.
- checkins.
- nutrition plan.
- progression.
- weekly plan.

### Fase 6 — Admin

- `admin-routes.js`.
- command center.
- students.
- Student 360.
- follow-ups.
- retention.
- anamneses.

### Fase 7 — Schema runtime

- `schema.js`.
- `ensureSchema`.
- migrations/runtime schema consistency.

## Mapa sugerido de arquivos

```text
workers/
  api.js
  routes/
    admin-routes.js
    portal-routes.js
    project-lm-routes.js
  services/
    auth-service.js
    health-check-service.js
    operational-log-service.js
    endpoint-usage-service.js
    student-service.js
    project-lm-service.js
  db/
    schema.js
  shared/
    response.js
```

## Critérios para cada PR de extração

Cada PR deve:

- mover apenas um domínio.
- manter API pública igual.
- manter rotas iguais.
- manter payloads iguais.
- passar `npm test`.
- atualizar docs se necessário.
- não alterar HTML.
- não criar migration.
- não mudar regra de negócio.

## Rotas críticas que não podem quebrar

- `/api/portal/login`
- `/api/portal/me`
- `/api/portal/checkin`
- `/api/portal/nutrition-plan`
- `/api/portal/progression`
- `/api/admin/command-center`
- `/api/admin/student-360`
- `/api/admin/students`
- `/api/admin/health-check`
- `/api/admin/operational-logs`
- `/api/admin/endpoint-usage`
- `/api/project-lm/profile`
- `/api/portal/project-lm/current-mission`
- `/api/portal/project-lm/daily-actions/summary`

## Primeira extração recomendada

Recomenda-se começar por Observabilidade, extraindo primeiro funções e helpers relacionados a:

- `logOperationalEvent`.
- `sanitizeOperationalMetadata`.
- `buildD1HealthCheck`.
- `logEndpointUsage`.
- endpoint usage helpers.

Justificativa:

- baixa dependência de UI.
- domínio claro.
- já coberto por testes V4.
- impacto operacional alto.
- menor risco do que extrair Admin ou Portal primeiro.

## Anti-objetivos

Esta etapa e os PRs de extração não devem:

- reescrever o worker inteiro.
- trocar a arquitetura de uma vez.
- remover endpoints.
- mudar banco.
- mudar autenticação no mesmo PR.
- alterar UI durante extração.
