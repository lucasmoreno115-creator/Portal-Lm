# V4 Architecture Freeze

## Objetivo

Registrar a arquitetura V4 como baseline oficial do Portal LM.

## Status da V4

As etapas abaixo estão concluídas e compõem a baseline técnica e operacional da V4:

- V4-01 Smoke Tests — concluída.
- V4-02 Event Registry Guard — concluída.
- V4-03 Health Check D1 — concluída.
- V4-04 Operational Logs — concluída.
- V4-05 Health Panel — concluída.
- V4-06 Hardening Logs — concluída.
- V4-07 Route Inventory — concluída.
- V4-08 Endpoint Usage Audit — concluída.
- V4-09 Dependency Inventory — concluída.
- V4-10 Admin Flow Consolidation — concluída.
- V4-11 API Modularization Plan — concluída.
- V4-12 Observability Extraction — concluída.
- V4-13 Student 360 Expansion — concluída.
- V4-14 Command Center Consolidation — concluída.
- V4-15 Auth Service Extraction — concluída.

## Fluxo operacional oficial

O fluxo operacional oficial do Admin é:

```text
Admin Login
↓
Command Center
↓
Student 360
↓
Cadastro de Aluno
```

O fluxo operacional oficial do aluno é:

```text
Portal Login
↓
Portal Premium ou Projeto LM conforme produto
```

## Superfícies CORE

### Admin

- `admin-login.html`
- `admin-command-center.html`
- `admin-student.html`
- `admin-students.html`
- `admin.html`

### Aluno Premium

- `portal-login.html`
- `portal.html`
- `portal-checkin.html`
- `portal-plano-alimentar.html`
- `portal-progressao.html`

### Projeto LM

- `projeto-lm-jornada.html`
- `projeto-lm-planejamento.html`
- `projeto-lm-biblioteca.html`
- `projeto-lm-conquistas.html`
- `projeto-lm-onboarding.html`

## Superfícies AUXILIARY preservadas

As telas auxiliares abaixo permanecem preservadas como parte da arquitetura V4:

- `admin-checkins.html`
- `admin-weekly-plan.html`
- `admin-nutrition-plan.html`
- `admin-anamneses.html`
- `admin-followup.html`
- `admin-alerts.html`

Essas telas não devem ser removidas sem:

- route inventory
- dependency inventory
- endpoint usage
- validação operacional manual

## Serviços modularizados

Os serviços abaixo são módulos oficiais da arquitetura V4:

- `workers/services/auth-service.js`
- `workers/services/operational-log-service.js`
- `workers/services/health-check-service.js`
- `workers/services/endpoint-usage-service.js`

## Worker principal

`workers/api.js` permanece como entrypoint principal da aplicação e ainda concentra:

- roteamento
- Portal Premium
- Projeto LM
- Admin
- Student 360
- Command Center
- ensureSchema

O `workers/api.js` não deve voltar a receber helpers genéricos de Auth ou Observabilidade se já houver serviço dedicado para essa responsabilidade.

## Regras para futuros PRs

- Não misturar feature com refatoração estrutural.
- Não remover endpoint sem checar route inventory e endpoint usage.
- Não remover tela sem checar dependency inventory.
- Não criar tela admin paralela se puder ser bloco no Command Center ou Student 360.
- Não expor tokens no Student 360.
- Não logar payloads brutos.
- Não alterar schema sem migration.
- Atualizar testes quando contrato mudar.
- Preservar fluxo Admin Login → Command Center → Student 360 → Cadastro de Aluno.

## Inventários oficiais

Os documentos abaixo são referências oficiais para evolução da arquitetura V4:

- `docs/v4-route-inventory.md`
- `docs/v4-dependency-inventory.md`
- `docs/v4-admin-flow-consolidation.md`
- `docs/v4-api-modularization-plan.md`

## Observabilidade oficial

A observabilidade oficial da V4 é composta por:

- `/api/admin/health-check`
- `/api/admin/operational-logs`
- `/api/admin/endpoint-usage`
- painel de saúde no Command Center

## Critérios para iniciar V5

V5 só deve começar quando:

- V4-16 estiver mergeada.
- `npm test` passar.
- Command Center e Student 360 forem considerados superfícies principais.
- Nenhuma rota crítica estiver quebrada.
- Arquitetura V4 estiver documentada.

## Próxima fase sugerida: V5 — Operação Solo

A próxima fase sugerida é V5 — Operação Solo, com foco em:

- reduzir cliques
- aumentar automação operacional
- melhorar retenção
- priorizar alunos por risco/valor
- facilitar reativação
- reduzir manutenção manual
