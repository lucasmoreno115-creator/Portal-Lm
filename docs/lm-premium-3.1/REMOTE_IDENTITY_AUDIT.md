# LM Premium 3.1 — Remote Read-Only Identity Audit

## Status

**AUDITORIA REMOTA CONCLUÍDA — CORREÇÃO PENDENTE**

## Ambiente auditado

| Campo | Valor |
| --- | --- |
| `environment` | `production` |
| `database` | `lmsystemv2-db` |
| `readOnly` | `true` |
| `zeroWrites` | `true` |
| `status` | `COMPLETED` |
| `errors` | `[]` |
| `capturedAt` | `2026-07-17T17:30:15.939Z` |

## Confirmações de segurança

- Auditoria executada em produção com leitura somente.
- Zero writes confirmados (`zeroWrites: true`).
- Nenhum backfill, cópia de dados, deploy, alteração de flag, alteração de schema, migration ou correção de dados foi executado.
- Nenhum dado pessoal individual foi registrado neste documento; apenas contagens agregadas são documentadas.

## `student_access`

| Métrica | Contagem |
| --- | ---: |
| Total | 18 |
| Ativos | 18 |
| Inativos | 0 |
| Com e-mail | 18 |
| Sem e-mail | 0 |
| Com `student_id` | 0 |
| Sem `student_id` | 18 |
| Grupos com e-mail duplicado | 0 |
| Grupos com `student_id` duplicado | 0 |

## `premium_students`

| Métrica | Contagem |
| --- | ---: |
| Total | 0 |
| Grupos com e-mail duplicado | 0 |
| Grupos com `student_id` duplicado | 0 |

## Paridade entre fontes

| Métrica | Contagem |
| --- | ---: |
| Presentes nas duas fontes (`in_both`) | 0 |
| Apenas em `student_access` (`only_student_access`) | 18 |
| Apenas em `premium_students` (`only_premium_students`) | 0 |
| `student_id` divergente por e-mail (`divergent_student_id_by_email`) | 0 |
| E-mail com múltiplos `student_id` (`email_with_multiple_student_ids`) | 0 |
| `student_id` com múltiplos e-mails (`student_id_with_multiple_emails`) | 0 |

## Tabelas dependentes

| Tabela | Status | Total | Com `student_id` | Com e-mail | Correspondentes por e-mail normalizado em `student_access` |
| --- | --- | ---: | ---: | ---: | ---: |
| `premium_anamnesis` | presente | 6 | 0 | 6 | 6 |
| `student_checkins` | presente | 3 | 0 | 3 | 3 |
| `followup_logs` | presente | 6 | 0 | 6 | 6 |
| `activity_timeline` | presente | 45 | 0 | 45 | 45 |
| `weekly_plans` | presente | 16 | 0 | 16 | 16 |
| `premium_pending_items` | presente | 0 | 0 | 0 | 0 |
| `premium_followup_entries` | presente | 0 | 0 | 0 | 0 |
| `premium_nutrition_plans` | ausente | N/A | N/A | N/A | N/A |

## Diagnóstico oficial

O Admin legado lista alunos a partir de `student_access`, que contém 18 alunos ativos.

O Workspace lista alunos a partir de `premium_students`, que contém 0 registros.

Todos os 18 alunos legados estão sem `student_id`.

Os dados históricos permanecem nas tabelas legadas e possuem correspondência determinística por e-mail normalizado com `student_access`.

Não foi identificada perda de dados.

A causa confirmada do Workspace vazio é a ausência de registros em `premium_students`, combinada com a ausência de `student_id` nos registros de `student_access`.

## Recomendação oficial

Próxima PR:

**LM Premium 3.1 — Identity Bridge & Student List Parity**

Escopo recomendado:

- `premium_students` como fonte preferencial;
- `student_access` como fallback read-only;
- resolução por `student_id` quando existir;
- fallback temporário por e-mail normalizado;
- sem backfill na primeira PR;
- sem cópia de dados;
- sem alteração das regras de negócio;
- preservação da separação entre Premium e Projeto LM.

## Conclusão

A auditoria remota de produção foi concluída em `2026-07-17T17:30:15.939Z` no banco `lmsystemv2-db`, em modo read-only e com zero writes. A correção permanece pendente e deve ser tratada em PR separada, sem misturar auditoria, backfill e alteração de regra de negócio.
