# LM Premium 3.1 — Student List Parity Report

**Status:** AUDITORIA REMOTA CONCLUÍDA — CORREÇÃO PENDENTE

| Métrica | Legado | Workspace | Diferença | Causa | Prioridade |
| ------- | -----: | --------: | --------: | ----- | ---------- |
| Total em tabela-fonte | 18 | 0 | 18 | `student_access` contém 18 registros; `premium_students` está vazia | P0 |
| Com e-mail | 18 | 0 | 18 | Legado possui identidade por e-mail; Workspace não possui registros | P0 |
| Sem e-mail | 0 | 0 | 0 | Não há lacuna de e-mail no legado | P2 |
| Com `student_id` | 0 | 0 | 0 | Legado remoto ainda não possui vínculos por `student_id` | P0 |
| Sem `student_id` | 18 | 0 | 18 | 18 alunos legados precisam de bridge read-only por e-mail ou remediação futura | P0 |
| Grupos de e-mail duplicado | 0 | 0 | 0 | E-mail normalizado é determinístico nesta amostra agregada | P1 |
| Grupos de `student_id` duplicado | 0 | 0 | 0 | Não há `student_id` preenchido no legado nem registros no Workspace | P1 |
| Presentes nas duas por e-mail normalizado | 0 | 0 | 0 | Workspace sem fonte `premium_students` | P0 |
| Somente no legado | 18 | N/A | 18 | Causa direta da lista vazia no Workspace | P0 |
| Somente no Workspace | N/A | 0 | 0 | Não há registros em `premium_students` | P1 |
| Divergência de `student_id` por e-mail | 0 | 0 | 0 | Não há pares entre fontes | P1 |
| E-mail com múltiplos `student_id` | 0 | 0 | 0 | Sem duplicidade agregada | P1 |
| `student_id` com múltiplos e-mails | 0 | 0 | 0 | Sem `student_id` preenchido | P1 |
| Dados históricos dependentes com e-mail correspondente | 76 | N/A | N/A | `premium_anamnesis`, `student_checkins`, `followup_logs`, `activity_timeline` e `weekly_plans` possuem vínculo por e-mail em `student_access` | P0 |
| Tabelas novas Premium vazias | N/A | 0 | N/A | `premium_pending_items` e `premium_followup_entries` existem, mas estão vazias | P1 |
| Plano nutricional Premium | N/A | N/A | N/A | `premium_nutrition_plans` ausente; banco remoto usa estrutura legada `nutrition_plans` | P0 |

## Diagnóstico

A diferença de contagem entre legado e Workspace é **18 alunos**. A causa confirmada é que o Admin legado lê `student_access`, enquanto o Workspace lê `premium_students`; no banco remoto, `student_access` tem 18 registros ativos e `premium_students` tem 0 registros.

A correção recomendada deve ser feita em PR separada por um bridge read-only: `premium_students` como fonte preferencial e `student_access` como fallback temporário por e-mail normalizado, sem backfill na primeira PR.
