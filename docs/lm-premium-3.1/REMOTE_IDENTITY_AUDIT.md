# LM Premium 3.1 — Remote Read-Only Identity Audit

## Status

**AUDITORIA REMOTA CONCLUÍDA — CORREÇÃO PENDENTE**

Auditoria executada em produção contra `lmsystemv2-db` com `readOnly: true`, `zeroWrites: true`, `status: COMPLETED` e `errors: []`. O JSON operacional sanitizado foi gerado fora do Git em `artifacts/lm-premium-3.1-identity-audit/` e permanece ignorado.

Nenhum backfill, migration, deploy, alteração de flag, alteração de schema, alteração de endpoint, alteração de regra de negócio ou escrita de dados foi executado por esta PR.

## Ambiente auditado

| Ambiente | Worker | Pages | D1 | Commit identificado | Flags confirmadas | Validação |
| -------- | ------ | ----- | -- | ------------------- | ----------------- | --------- |
| Produção | `lm-system-api` / rota `portal.lucasmorenopersonal.com.br/api/*` | NÃO CONFIRMADO nesta auditoria | `lmsystemv2-db`; binding `DB`; database ID conhecido no repositório: `1de90532-157b-473e-8e7a-655ca9e0953d` | NÃO CONFIRMADO nesta auditoria | NÃO CONFIRMADO nesta auditoria | CONFIRMADO para D1/read-only identity audit |
| Staging | NÃO TESTADO | NÃO TESTADO | NÃO TESTADO | NÃO TESTADO | NÃO TESTADO | NÃO TESTADO |
| Local | Repositório local | N/A | N/A | branch local | N/A | Usado apenas para documentação/testes |

## Segurança operacional

Comandos read-only validados remotamente antes/na auditoria:

```text
npx wrangler d1 execute lmsystemv2-db --remote --command "SELECT 1 AS ok;"
npx wrangler d1 execute lmsystemv2-db --remote --json --command "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"
npx wrangler d1 execute lmsystemv2-db --remote --json --command "PRAGMA table_info(""student_access"");"
```

Todos retornaram `changes=0`, `rows_written=0` e `changed_db=false`.

O executor final usa allowlist fixa e não introspecta `_cf_KV`, `d1_migrations`, `lm2_*`, `project_lm_*`, `diagnostic_results`, `leads`, `operational_logs`, `training_*` ou qualquer tabela fora da allowlist.

## Causa operacional confirmada da falha do primeiro executor

A primeira versão do executor fazia `PRAGMA table_info()` para todas as tabelas retornadas por `sqlite_schema`. Em Cloudflare D1, `sqlite_schema` retorna `_cf_KV`, uma tabela interna protegida. A tentativa de introspectar `_cf_KV` causou `SQLITE_AUTH`.

Correção já aplicada no tooling: descoberta filtra `sqlite_%` e `_cf_%`, e `PRAGMA table_info()` roda somente para tabelas da allowlist da auditoria que realmente existem.

## Resultado remoto do executor

```json
{
  "environment": "production",
  "database": "lmsystemv2-db",
  "readOnly": true,
  "zeroWrites": true,
  "status": "COMPLETED",
  "errors": []
}
```

## Contagens principais

| Métrica | `student_access` | `premium_students` |
| --- | ---: | ---: |
| Total | 18 | 0 |
| Ativos | 18 | 0 |
| Inativos | 0 | 0 |
| Com e-mail | 18 | 0 |
| Sem e-mail | 0 | 0 |
| Com `student_id` | 0 | 0 |
| Sem `student_id` | 18 | 0 |
| Grupos de e-mail duplicado | 0 | 0 |
| Grupos de `student_id` duplicado | 0 | 0 |

## Paridade entre `student_access` e `premium_students`

| Métrica | Contagem |
| --- | ---: |
| Presentes nas duas por `LOWER(TRIM(email))` | 0 |
| Somente em `student_access` | 18 |
| Somente em `premium_students` | 0 |
| Presentes nas duas com `student_id` divergente | 0 |
| E-mail associado a múltiplos `student_id` | 0 |
| `student_id` associado a múltiplos e-mails | 0 |

## Cobertura de identidade em tabelas dependentes

| Tabela | Presença | Total | Com `student_id` | Sem `student_id` | Com e-mail | Sem e-mail | `student_id` válido em `premium_students` | `student_id` órfão | E-mail correspondente em `student_access` | E-mail sem correspondência |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `premium_anamnesis` | PRESENTE | 6 | 0 | 6 | 6 | 0 | 0 | 0 | 6 | 0 |
| `student_checkins` | PRESENTE | 3 | 0 | 3 | 3 | 0 | 0 | 0 | 3 | 0 |
| `premium_nutrition_plans` | AUSENTE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `premium_pending_items` | PRESENTE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `premium_followup_entries` | PRESENTE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `followup_logs` | PRESENTE | 6 | 0 | 6 | 6 | 0 | 0 | 0 | 6 | 0 |
| `activity_timeline` | PRESENTE | 45 | 0 | 45 | 45 | 0 | 0 | 0 | 45 | 0 |
| `weekly_plans` | PRESENTE | 16 | 0 | 16 | 16 | 0 | 0 | 0 | 16 | 0 |

## Diagnóstico oficial da lista vazia

A causa confirmada do Workspace vazio é a ausência de registros em `premium_students`, combinada com a inexistência de `student_id` nos 18 registros de `student_access`.

Não houve perda de dados. Os dados continuam armazenados nas estruturas legadas e são relacionáveis por e-mail normalizado.

## Hipóteses

| Hipótese | Classificação | Evidência |
| --- | --- | --- |
| A. `premium_students` vazia | CONFIRMADA | `premium_students.total = 0` |
| B. Dados existem, mas flag desliga Workspace | INCONCLUSIVA | Flags não foram objetivo da execução remota de D1 |
| C. Endpoint retorna 401/403 | NÃO TESTADA | Auditoria executada no D1, sem GET autenticado |
| D. Endpoint retorna 200 com lista vazia | NÃO TESTADA | Auditoria executada no D1, sem GET autenticado |
| E. Registros são excluídos por filtros/status | DESCARTADA como causa primária | Fonte `premium_students` está vazia |
| F. `student_id` ausente ou órfão | CONFIRMADA parcialmente | 18/18 registros em `student_access` sem `student_id`; sem órfãos mensuráveis porque não há IDs |
| G. Deploy frontend e Worker dessincronizados | INCONCLUSIVA | Não avaliado por D1 |
| H. Assets duplicados servem versões diferentes | INCONCLUSIVA | Não avaliado por D1 |
| I. D1 binding aponta para banco diferente | DESCARTADA para a auditoria | Auditoria executada em `lmsystemv2-db` |
| J. Workspace exclui incorretamente alunos Premium ou inclui Projeto LM | INCONCLUSIVA | Sem registros em `premium_students`; próxima PR deve validar filtros Produto/Projeto LM no adapter |

## Causas confirmadas

1. O Admin legado lista alunos a partir de `student_access`, que contém 18 alunos.
2. O Workspace lista alunos a partir de `premium_students`, que contém 0 alunos.
3. Os 18 alunos do legado não possuem `student_id`.
4. Os dados históricos existentes usam e-mail como vínculo e possuem correspondência determinística em `student_access`.
5. As tabelas novas de Inbox e follow-up Premium existem, mas estão vazias.
6. `premium_nutrition_plans` não existe no banco remoto; o banco possui a estrutura legada `nutrition_plans`.

## Próxima PR recomendada

**LM Premium 3.1 — Identity Bridge & Student List Parity**

Objetivo:

- fazer o Workspace listar os 18 alunos sem copiar ou alterar dados;
- usar `premium_students` como fonte preferencial;
- usar `student_access` como fallback read-only;
- resolver contexto por `student_id` quando existir;
- usar e-mail normalizado como fallback temporário;
- excluir corretamente alunos exclusivos do Projeto LM;
- preservar alunos com Premium e Projeto LM;
- não executar backfill nesta primeira PR.
