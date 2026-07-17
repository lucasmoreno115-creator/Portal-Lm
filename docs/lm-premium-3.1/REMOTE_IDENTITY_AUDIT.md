# LM Premium 3.1 — Remote Read-Only Identity Audit

## Escopo e resultado executivo

Sprint de auditoria somente leitura para comparar Admin legado, Workspace Premium, identidade por e-mail, identidade por `student_id` e vínculos entre `student_access` e `premium_students`.

**Status em 2026-07-17:** PREPARADA — EXECUÇÃO REMOTA PENDENTE. A execução remota real não foi concluída neste ambiente porque o binário/local package do Wrangler não está disponível e o fallback `npx wrangler` foi bloqueado por `403 Forbidden` no registry. Portanto, nenhuma consulta D1 remota e nenhum GET autenticado remoto foram executados. O PR agora inclui o comando específico `identity-audit`, que calcula automaticamente métricas agregadas de identidade quando executado em um ambiente com Wrangler/autenticação disponíveis.

**Confirmações de segurança:**

- Zero writes executados.
- Nenhum `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, `UPSERT`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `VACUUM` ou `PRAGMA` mutável foi enviado a D1.
- Nenhum dado pessoal real foi exposto neste relatório.
- Nenhum token foi registrado.
- Nenhum backfill, deploy, alteração de flag, alteração de schema ou correção de dados foi executado.

## Ambientes auditados

| Ambiente | Worker | Pages | D1 | Commit identificado | Flags confirmadas | Validação |
| -------- | ------ | ----- | -- | ------------------- | ----------------- | --------- |
| Local | `lm-system-api` em `wrangler.toml`; `main = workers/api.js` | `public/` presente no repositório, Pages remoto não consultado | Binding `DB`; database name `lmsystemv2-db`; database ID `1de90532-157b-473e-8e7a-655ca9e0953d` | `5f04c56fac6ea39fcaaa9633d9fea7c66d1e5029` | `PREMIUM_ADMIN_CUTOVER_ENABLED` e `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED` identificadas no código, valores locais/remotos não confirmados | CONFIRMADO parcialmente por leitura local; remoto NÃO CONFIRMADO |
| Staging | NÃO CONFIRMADO | NÃO CONFIRMADO | Nome default do tooling: `lmsystemv2-staging-db`; database ID NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO CONFIRMADO | NÃO CONFIRMADO |
| Produção | Rota configurada `portal.lucasmorenopersonal.com.br/api/*` | NÃO CONFIRMADO | Binding `DB`; database name `lmsystemv2-db`; database ID `1de90532-157b-473e-8e7a-655ca9e0953d` | NÃO DISPONÍVEL | NÃO CONFIRMADO | NÃO CONFIRMADO remotamente |

## Segurança operacional read-only

Antes de qualquer tentativa remota, foi adicionado guard no tooling de D1 remoto:

- aceita somente uma statement;
- aceita `SELECT`;
- aceita apenas `PRAGMA` de leitura de schema: `table_info`, `table_xinfo`, `index_list`, `index_info`, `foreign_key_list`;
- bloqueia palavras de mutação: `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, `UPSERT`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `VACUUM`, `ATTACH`, `DETACH`, `REINDEX`;
- normaliza a remoção de `;` final;
- mensagens de erro não incluem SQL completo, tokens, e-mails ou valores pessoais.

### Comando específico preparado

- Windows produção: `node scripts\db-tool.mjs identity-audit --environment production --confirm-read-only-production`
- Windows staging: `node scripts\db-tool.mjs identity-audit --environment staging --database lmsystemv2-staging-db --confirm-read-only-staging`
- Saída JSON esperada: `artifacts/lm-premium-3.1-identity-audit/identity-audit-<environment>.json`
- Estrutura: `environment`, `database`, `capturedAt`, `readOnly`, `zeroWrites`, `studentAccess`, `premiumStudents`, `parity`, `dependentTables`, `errors`.

### Comandos executados

| Timestamp UTC | Ambiente | Database | Comando | Resultado agregado | Zero writes |
| --- | --- | --- | --- | --- | --- |
| 2026-07-17T16:14:20Z | Local | N/A | `npx wrangler whoami && node scripts/db-tool.mjs audit --environment production --confirm-read-only-production` | Falhou antes de autenticar/consultar D1: `npm` retornou `403 Forbidden` ao buscar `wrangler`; nenhuma consulta remota foi executada | SIM |
| 2026-07-17T16:14:00Z | Local | N/A | `node --test tests/lm-premium-3.1-remote-readonly-sql.test.mjs` | Guard read-only passou: aceita SELECT/schema e rejeita escrita/múltiplas statements | SIM |

## Consultas agregadas incluídas no executor `identity-audit`

As consultas abaixo são agregadas/sanitizadas, ficam versionadas no código e são executadas automaticamente pelo comando `identity-audit`; o operador não informa SQL arbitrário.

### `student_access`

```sql
SELECT COUNT(*) AS total,
  SUM(CASE WHEN UPPER(COALESCE(status,''))='ACTIVE' THEN 1 ELSE 0 END) AS active,
  SUM(CASE WHEN UPPER(COALESCE(status,'')) NOT IN ('ACTIVE','') THEN 1 ELSE 0 END) AS inactive_or_other,
  SUM(CASE WHEN COALESCE(student_id,'')<>'' THEN 1 ELSE 0 END) AS with_student_id,
  SUM(CASE WHEN COALESCE(student_id,'')='' THEN 1 ELSE 0 END) AS without_student_id,
  SUM(CASE WHEN COALESCE(TRIM(email),'')<>'' THEN 1 ELSE 0 END) AS with_email,
  SUM(CASE WHEN COALESCE(TRIM(email),'')='' THEN 1 ELSE 0 END) AS without_email
FROM student_access;
```

```sql
SELECT COUNT(*) AS duplicated_email_groups
FROM (SELECT LOWER(TRIM(email)) AS email_norm FROM student_access WHERE COALESCE(TRIM(email),'')<>'' GROUP BY email_norm HAVING COUNT(*)>1);
```

```sql
SELECT COUNT(*) AS duplicated_student_id_groups
FROM (SELECT student_id FROM student_access WHERE COALESCE(student_id,'')<>'' GROUP BY student_id HAVING COUNT(*)>1);
```

```sql
SELECT COALESCE(plan_type,'__NULL__') AS plan_type, COUNT(*) AS total
FROM student_access
GROUP BY COALESCE(plan_type,'__NULL__')
ORDER BY total DESC;
```

### `premium_students`

```sql
SELECT COUNT(*) AS total,
  SUM(CASE WHEN UPPER(COALESCE(consultation_status,'')) IN ('ACTIVE','ATIVO','NEW','IN_PROGRESS') THEN 1 ELSE 0 END) AS active_like,
  SUM(CASE WHEN UPPER(COALESCE(consultation_status,'')) IN ('PAUSED','PAUSADO') THEN 1 ELSE 0 END) AS paused,
  SUM(CASE WHEN UPPER(COALESCE(consultation_status,'')) IN ('ENDED','ENCERRADO','CLOSED') THEN 1 ELSE 0 END) AS ended,
  SUM(CASE WHEN COALESCE(TRIM(email),'')<>'' THEN 1 ELSE 0 END) AS with_email,
  SUM(CASE WHEN COALESCE(TRIM(email),'')='' THEN 1 ELSE 0 END) AS without_email
FROM premium_students;
```

```sql
SELECT COUNT(*) AS duplicated_student_id_groups
FROM (SELECT student_id FROM premium_students WHERE COALESCE(student_id,'')<>'' GROUP BY student_id HAVING COUNT(*)>1);
```

```sql
SELECT COUNT(*) AS duplicated_email_groups
FROM (SELECT LOWER(TRIM(email)) AS email_norm FROM premium_students WHERE COALESCE(TRIM(email),'')<>'' GROUP BY email_norm HAVING COUNT(*)>1);
```

## Contagens principais

| Métrica | `student_access` | `premium_students` | Status |
| --- | ---: | ---: | --- |
| Total | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Ativos | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Inativos/pausados/encerrados | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Com `student_id` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Sem `student_id` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Com e-mail | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Sem e-mail | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| E-mails duplicados | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| `student_id` duplicados | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA remotamente |

## Paridade entre fontes

| Métrica | Contagem | Status |
| --- | ---: | --- |
| Presentes nas duas tabelas por e-mail normalizado | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Apenas em `student_access` | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Apenas em `premium_students` | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Nas duas com `student_id` incompatível | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Nas duas com status divergente | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Nas duas com nome divergente | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Nas duas com telefone divergente | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| E-mails vazios | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| E-mails inválidos | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Diferença apenas de caixa/espaços | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Múltiplos registros por e-mail | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Um e-mail com mais de um `student_id` | NÃO DISPONÍVEL | NÃO TESTADA remotamente |
| Um `student_id` com mais de um e-mail | NÃO DISPONÍVEL | NÃO TESTADA remotamente |

## Cobertura de identidade em dados dependentes

| Tabela | Total | Com `student_id` | Sem `student_id` | Com e-mail | Sem e-mail | `student_id` em `premium_students` | `student_id` órfão | E-mail em `student_access` | E-mail sem correspondência | Resolúvel por e-mail | Ambígua por duplicidade | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `premium_anamnesis` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA |
| `student_checkins` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA |
| `premium_nutrition_plans` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA |
| `premium_pending_items` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA |
| `premium_followup_entries` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA |
| `followup_logs` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA |
| `activity_timeline` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA |
| `weekly_plans` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADA |

## Endpoints reais

Nenhum GET autenticado remoto foi executado porque não havia mecanismo autenticado/seguro disponível neste ambiente e o Wrangler não pôde ser obtido.

| Endpoint | Status HTTP | Formato | Quantidade | Paginação | Headers exigidos | Flag | Tempo | Resultado |
| --- | --- | --- | ---: | --- | --- | --- | ---: | --- |
| `GET /api/admin/students` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Admin auth no código | N/A | NÃO DISPONÍVEL | NÃO TESTADO |
| `GET /api/admin/premium/workspace/students` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Admin auth no código | Sem flag direta neste endpoint | NÃO DISPONÍVEL | NÃO TESTADO |
| `GET /api/admin/premium/workspace/summary` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Admin auth no código | `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED` no summary | NÃO DISPONÍVEL | NÃO TESTADO |
| `GET /api/admin/premium/workspace/students/search` | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | Admin auth no código | Sem flag direta neste endpoint | NÃO DISPONÍVEL | NÃO TESTADO |

## Amostragem sanitizada

Nenhuma amostra real foi gerada. Quando a auditoria remota estiver disponível, amostras de divergência devem usar exclusivamente `email_hash = SHA-256(LOWER(TRIM(email)))` truncado para 10–12 caracteres.

| email_hash | student_access | premium_students | student_id presente | status |
| ---------- | -------------: | ---------------: | ------------------: | ------ |
| NÃO GERADO | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO DISPONÍVEL | NÃO TESTADO |

## Diagnóstico da lista vazia

| Hipótese | Classificação | Evidência |
| --- | --- | --- |
| A. `premium_students` vazia | NÃO TESTADA | Sem consulta remota agregada |
| B. Dados existem, mas flag desliga Workspace | INCONCLUSIVA | Flag do summary existe no código; valor remoto inacessível |
| C. Endpoint retorna 401/403 | NÃO TESTADA | Sem GET autenticado remoto |
| D. Endpoint retorna 200 com lista vazia | NÃO TESTADA | Sem GET autenticado remoto |
| E. Registros são excluídos por filtros/status | INCONCLUSIVA | Filtros existem no Workspace, mas contagens remotas indisponíveis |
| F. `student_id` ausente ou órfão | NÃO TESTADA | Sem contagem remota |
| G. Deploy frontend e Worker dessincronizados | INCONCLUSIVA | Commit remoto/Pages não identificado |
| H. Assets duplicados servem versões diferentes | INCONCLUSIVA | Assets duplicados existem localmente, mas versão remota não foi identificada |
| I. D1 binding aponta para banco diferente | INCONCLUSIVA | Binding local confirmado; binding remoto não verificado por Cloudflare |
| J. Workspace exclui incorretamente alunos Premium ou inclui Projeto LM | INCONCLUSIVA | Exclusão Projeto LM tem evidência local/testes, mas remoto não confirmado |

## Projeto LM

Auditoria remota não confirmou a composição real das listas. Evidência estática local indica que o Workspace usa repositórios Premium e endpoints `/api/admin/premium/workspace/*`, enquanto rotas e assets do Projeto LM ficam em namespace próprio. A exclusão correta do Projeto LM deve permanecer como critério obrigatório da próxima execução remota.

## Limitações

- Branch `main` remota não estava disponível: o repositório não possui remote `origin` neste ambiente.
- Apenas a branch local existente pôde ser usada como base.
- `wrangler` local não estava instalado.
- `npx wrangler` falhou por política/registry com `403 Forbidden`.
- Não havia token, sessão admin, URL staging autenticável ou mecanismo seguro de GET autenticado disponível.
- Por isso, as métricas reais de D1 e endpoints permanecem NÃO DISPONÍVEIS/NÃO TESTADAS.

## Risco operacional

- Risco de escrita: baixo nesta execução, porque nenhuma consulta remota foi executada e o guard bloqueia SQL mutável.
- Risco de PII: baixo nesta documentação, porque não há dados reais individuais.
- Risco de decisão: alto se alguém usar este relatório como prova de paridade, pois a paridade remota não foi medida.

## Conclusão

PREPARADA — EXECUÇÃO REMOTA PENDENTE. A causa da lista vazia **não pôde ser confirmada** nesta execução. A causa está delimitada como dependente de executar o comando `identity-audit` e os GETs autenticados em ambiente remoto read-only. A evidência estática continua apontando divergência estrutural entre Admin legado (`student_access`) e Workspace (`premium_students`), mas sem prova quantitativa remota neste ambiente.
