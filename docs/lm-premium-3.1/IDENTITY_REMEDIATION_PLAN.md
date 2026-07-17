# LM Premium 3.1 — Identity Remediation Plan

**Status:** AUDITORIA REMOTA CONCLUÍDA — CORREÇÃO PENDENTE

Este plano propõe correções futuras. Nenhuma correção funcional, backfill, alteração de schema, alteração de flag, deploy ou mutação de dados foi implementada nesta PR.

## Diagnóstico remoto confirmado

- `student_access` contém 18 alunos ativos.
- `premium_students` contém 0 alunos.
- 18/18 registros em `student_access` não possuem `student_id`.
- Dados históricos dependentes usam e-mail como vínculo e possuem correspondência determinística em `student_access`.
- `premium_pending_items` e `premium_followup_entries` existem, mas estão vazias.
- `premium_nutrition_plans` está ausente no banco remoto; existe a estrutura legada `nutrition_plans`.

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

## 1. Correção de código futura

- Implementar adapter read-only no Workspace que combine fonte preferencial `premium_students` com fallback `student_access`.
- Preservar `premium_students` como fonte canônica quando houver registros.
- Usar `LOWER(TRIM(email))` apenas em consulta/memória para fallback temporário.
- Não copiar dados entre tabelas nesta primeira correção.
- Garantir filtros que excluam alunos exclusivos do Projeto LM e preservem alunos com Premium + Projeto LM.

## 2. Adapter read-only

- Retornar os 18 alunos legados no Workspace enquanto `premium_students` estiver vazia.
- Sinalizar origem do registro internamente como fallback legado, sem expor PII em logs.
- Resolver contextos dependentes por `student_id` quando existir e por e-mail normalizado quando `student_id` estiver ausente.
- Manter paginação, busca e filtros compatíveis com o Workspace.

## 3. Vinculação de identidade futura

- Definir `student_id` como identidade canônica futura.
- Tratar e-mail normalizado como fallback temporário e sinal de reconciliação.
- Não sobrescrever vínculos divergentes automaticamente.
- Exigir revisão manual para ambiguidade: múltiplos e-mails por `student_id` ou múltiplos `student_id` por e-mail.

## 4. Eventual backfill futuro

Qualquer backfill deve ser PR/Sprint separado, após o bridge read-only, e exigir aprovação explícita. Requisitos mínimos:

- idempotente;
- dry-run obrigatório;
- backup antes de escrita;
- saída agregada e sanitizada;
- detecção de ambiguidade;
- zero sobrescrita automática de vínculo divergente;
- lote pequeno inicial em staging;
- validação pós-backfill read-only;
- rollback documentado;
- aprovação explícita antes de produção.

## 5. Validações

- Validar que o Workspace lista 18 alunos quando `premium_students` está vazia e `student_access` tem 18 elegíveis.
- Validar que, quando `premium_students` tiver registros, ela continua fonte preferencial.
- Validar exclusão de alunos exclusivos do Projeto LM.
- Validar preservação de alunos com Premium + Projeto LM.
- Validar que nenhum relatório/log imprime e-mail integral, telefone, nome, token, conteúdo clínico, plano, feedback ou resposta de anamnese.

## 6. Rollback

- O bridge read-only deve poder ser desativado por reversão de código, sem rollback de dados.
- Backfills futuros devem possuir rollback próprio por lote e backup.

## 7. Testes

- Unitários do adapter de listagem.
- Repositórios com `premium_students` vazia e fallback `student_access`.
- Busca/paginação/filtros com fallback.
- Student 360/contexto com `student_id` ausente e e-mail correspondente.
- Exclusão Projeto LM e preservação Premium + Projeto LM.
- Testes de ausência de PII em logs/artefatos.

## 8. Operação

- Rodar primeiro em staging.
- Não fazer deploy junto com backfill.
- Não executar backfill na PR do bridge.
- Manter auditorias read-only antes e depois da correção.
