# LM Premium 3.1 — Student List Parity Report

## Status

**AUDITORIA REMOTA CONCLUÍDA — CORREÇÃO PENDENTE**

## Ambiente

| Campo | Valor |
| --- | --- |
| `environment` | `production` |
| `database` | `lmsystemv2-db` |
| `readOnly` | `true` |
| `zeroWrites` | `true` |
| `status` | `COMPLETED` |
| `errors` | `[]` |
| `capturedAt` | `2026-07-17T17:30:15.939Z` |

## Paridade confirmada

| Métrica | Admin legado (`student_access`) | Workspace (`premium_students`) | Diferença | Diagnóstico |
| --- | ---: | ---: | ---: | --- |
| Total em tabela-fonte | 18 | 0 | 18 | Workspace vazio porque `premium_students` não possui registros |
| Total de ativos | 18 | 0 | 18 | Admin legado possui 18 alunos ativos em `student_access` |
| Presentes nas duas fontes | 0 | 0 | 0 | Não há interseção porque `premium_students` está vazia |
| Presentes apenas no legado | 18 | N/A | 18 | Todos os alunos identificados estão somente em `student_access` |
| Presentes apenas no Workspace | N/A | 0 | 0 | Nenhum registro exclusivo em `premium_students` |
| Registros sem `student_id` | 18 | 0 | 18 | Todos os alunos legados estão sem `student_id` |
| Registros com e-mail | 18 | 0 | 18 | Todos os alunos legados possuem e-mail |
| E-mails duplicados | 0 | 0 | 0 | Sem duplicidade de e-mail nas fontes auditadas |
| `student_id` duplicados | 0 | 0 | 0 | Sem duplicidade de `student_id`; `student_access` não possui `student_id` preenchido |
| `student_id` divergente por e-mail | 0 | 0 | 0 | Sem divergência detectada |
| E-mail com múltiplos `student_id` | 0 | 0 | 0 | Sem ambiguidade detectada |
| `student_id` com múltiplos e-mails | 0 | 0 | 0 | Sem ambiguidade detectada |

## Dados históricos dependentes

| Tabela | Total | Com `student_id` | Com e-mail | Correspondência em `student_access` |
| --- | ---: | ---: | ---: | ---: |
| `premium_anamnesis` | 6 | 0 | 6 | 6 |
| `student_checkins` | 3 | 0 | 3 | 3 |
| `followup_logs` | 6 | 0 | 6 | 6 |
| `activity_timeline` | 45 | 0 | 45 | 45 |
| `weekly_plans` | 16 | 0 | 16 | 16 |
| `premium_pending_items` | 0 | 0 | 0 | 0 |
| `premium_followup_entries` | 0 | 0 | 0 | 0 |
| `premium_nutrition_plans` | ausente | ausente | ausente | ausente |

## Interpretação

A diferença de listagem está confirmada: o Admin legado usa `student_access` e encontra 18 alunos ativos, enquanto o Workspace usa `premium_students` e encontra 0 registros. Como todos os 18 alunos legados estão sem `student_id`, o Workspace não consegue formar a lista a partir da fonte Premium atual nem resolver identidade canônica por `student_id`.

Os dados históricos não foram perdidos. As tabelas legadas auditadas possuem e-mail e correspondência determinística por e-mail normalizado com `student_access`.

## Recomendação

A próxima PR deve implementar **LM Premium 3.1 — Identity Bridge & Student List Parity**, mantendo `premium_students` como fonte preferencial, usando `student_access` como fallback read-only, resolvendo por `student_id` quando existir e usando fallback temporário por e-mail normalizado sem backfill, sem cópia de dados e sem alteração de regras de negócio.
