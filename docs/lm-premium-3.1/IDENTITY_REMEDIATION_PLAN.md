# LM Premium 3.1 — Identity Remediation Plan

## Status

**AUDITORIA REMOTA CONCLUÍDA — CORREÇÃO PENDENTE**

Este plano descreve a correção recomendada para uma PR futura. Nenhuma correção, backfill, cópia de dados, alteração de schema, alteração de flag, deploy, migration ou mutação de dados foi implementada nesta atualização documental.

## Evidência final confirmada

| Campo | Valor |
| --- | --- |
| `environment` | `production` |
| `database` | `lmsystemv2-db` |
| `readOnly` | `true` |
| `zeroWrites` | `true` |
| `status` | `COMPLETED` |
| `errors` | `[]` |
| `capturedAt` | `2026-07-17T17:30:15.939Z` |

## Diagnóstico oficial

O Admin legado lista alunos a partir de `student_access`, que contém 18 alunos ativos.

O Workspace lista alunos a partir de `premium_students`, que contém 0 registros.

Todos os 18 alunos legados estão sem `student_id`.

Os dados históricos permanecem nas tabelas legadas e possuem correspondência determinística por e-mail normalizado com `student_access`:

- `premium_anamnesis`: 6 registros, 0 com `student_id`, 6 com e-mail, 6 correspondentes em `student_access`;
- `student_checkins`: 3 registros, 0 com `student_id`, 3 com e-mail, 3 correspondentes;
- `followup_logs`: 6 registros, 0 com `student_id`, 6 com e-mail, 6 correspondentes;
- `activity_timeline`: 45 registros, 0 com `student_id`, 45 com e-mail, 45 correspondentes;
- `weekly_plans`: 16 registros, 0 com `student_id`, 16 com e-mail, 16 correspondentes;
- `premium_pending_items`: tabela presente, 0 registros;
- `premium_followup_entries`: tabela presente, 0 registros;
- `premium_nutrition_plans`: tabela ausente.

Não foi identificada perda de dados.

A causa confirmada do Workspace vazio é a ausência de registros em `premium_students`, combinada com a ausência de `student_id` nos registros de `student_access`.

## Próxima PR recomendada

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

## 1. Correção de código futura

- Implementar uma ponte de identidade explícita para listagem de alunos Premium.
- Manter `premium_students` como fonte preferencial do Workspace.
- Usar `student_access` apenas como fallback read-only enquanto `premium_students` estiver vazio ou incompleto.
- Resolver por `student_id` quando existir em ambas as fontes.
- Usar e-mail normalizado (`LOWER(TRIM(email))`) como fallback temporário e determinístico quando `student_id` estiver ausente.
- Não copiar dados de `student_access` para `premium_students` nesta primeira PR.
- Não alterar regras de negócio, status, permissões, endpoints públicos ou separação entre Premium e Projeto LM.

## 2. Regras de identidade

- `student_id` é a identidade canônica quando existir.
- E-mail normalizado é chave auxiliar temporária, não identidade canônica permanente.
- Nome, telefone, WhatsApp, status e conteúdo clínico não devem ser usados como vínculo automático isolado.
- Qualquer ambiguidade futura deve bloquear resolução automática e exigir revisão manual.
- Casos a bloquear: e-mail com múltiplos `student_id`, `student_id` com múltiplos e-mails ou divergência de `student_id` por e-mail.

## 3. Restrições para a primeira PR

- Sem backfill.
- Sem cópia de dados.
- Sem writes.
- Sem migration.
- Sem alteração de schema.
- Sem alteração de flags.
- Sem alteração das regras de negócio.
- Sem misturar dados Premium com Projeto LM.

## 4. Validações obrigatórias da correção futura

- A lista do Workspace deve incluir os 18 alunos legados como fallback read-only quando `premium_students` estiver vazia.
- A listagem deve continuar preferindo `premium_students` quando registros Premium existirem.
- Os dados históricos devem ser resolvíveis por e-mail normalizado enquanto `student_id` estiver ausente.
- Nenhum aluno exclusivo do Projeto LM deve entrar no Workspace Premium.
- Alunos que sejam Premium e Projeto LM devem continuar preservados no contexto Premium quando elegíveis.
- Relatórios e logs não devem imprimir e-mail, telefone, nome, token, conteúdo clínico, plano, feedback ou resposta de anamnese.

## 5. Eventual backfill futuro

Qualquer backfill futuro deve ser uma PR separada, posterior à ponte read-only, e exigir aprovação explícita. Requisitos mínimos:

- dry-run obrigatório;
- backup antes de escrita;
- execução idempotente;
- lote pequeno inicial em staging;
- validação read-only antes/depois;
- detecção de ambiguidade;
- zero sobrescrita automática de vínculo divergente;
- saída agregada e sanitizada;
- rollback documentado;
- aprovação explícita antes de produção.

## 6. Operação

- Não misturar auditoria, correção de código e backfill no mesmo release operacional.
- Não fazer deploy junto com auditoria de dados.
- Armazenar artefatos sanitizados fora de logs públicos.
- Exigir confirmação explícita read-only para qualquer nova consulta em produção.
