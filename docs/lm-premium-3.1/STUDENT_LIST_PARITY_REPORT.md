# LM Premium 3.1 — Student List Parity Report

| Métrica | Legado | Workspace | Diferença | Causa | Prioridade |
| ------- | -----: | --------: | --------: | ----- | ---------- |
| Total de alunos retornados pelo endpoint | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | GET remoto autenticado não executado; Wrangler indisponível (`npx wrangler` bloqueado por 403) | P0 |
| Total em tabela-fonte | NÃO DISPONÍVEL (`student_access`) | NÃO DISPONÍVEL (`premium_students`) | NÃO DISPONÍVEL | Consultas D1 remotas não executadas | P0 |
| Presentes apenas no legado | NÃO DISPONÍVEL | N/A | NÃO DISPONÍVEL | Requer comparação por `LOWER(TRIM(email))` no D1 remoto | P0 |
| Presentes apenas no Workspace | N/A | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Requer comparação por `LOWER(TRIM(email))` no D1 remoto | P0 |
| Presentes nas duas fontes | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Requer join agregado remoto | P0 |
| Registros sem `student_id` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Requer contagem agregada remota | P0 |
| Registros com `student_id` órfão | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Requer anti-join agregado remoto | P0 |
| E-mails duplicados | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Requer agrupamento agregado remoto | P1 |
| `student_id` duplicados | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Requer agrupamento agregado remoto | P1 |
| Status divergente | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Sem dados remotos; mapeamento de status deve ser definido antes da conclusão | P1 |
| Nome divergente | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Comparação deve retornar apenas contagem/hash, nunca nome real | P2 |
| Telefone divergente | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Comparação deve retornar apenas contagem/hash, nunca telefone real | P2 |
| Exclusão de alunos exclusivos Projeto LM | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Evidência local existe, mas endpoint remoto não foi validado | P0 |
| Alunos com Premium + Projeto LM preservados no Premium | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Requer métricas remotas por produto/plan_type sem expor PII | P0 |

## Interpretação

A diferença de contagem entre legado e Workspace permanece **não conhecida** nesta execução porque o ambiente não permitiu autenticação/execução remota read-only. A prioridade imediata é repetir a auditoria em um runner com Wrangler disponível, token Cloudflare read-only e credenciais admin de staging para GETs sanitizados.
