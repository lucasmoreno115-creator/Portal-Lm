# LM Premium 3.1 — Identity Remediation Plan

Este plano propõe correções futuras. Nenhuma correção, backfill, alteração de schema, alteração de flag, deploy ou mutação de dados foi implementada neste Sprint.

## 1. Correção de código futura

- Unificar o contrato de listagem entre Admin legado e Workspace com um adapter explícito que documente fonte, filtros e identidade preferencial.
- Padronizar tratamento de e-mail normalizado apenas em memória/consulta (`LOWER(TRIM(email))`) até existir decisão formal de persistência.
- Garantir que endpoints de Workspace retornem metadados de paginação e filtros aplicados de forma rastreável.
- Garantir que o summary e a listagem usem a mesma regra de habilitação/feature flag ou documentem divergências intencionais.
- Manter namespaces do Projeto LM isolados das fontes principais do Workspace Premium.

## 2. Adapter read-only

- Criar um adapter de auditoria read-only que consiga comparar `student_access` e `premium_students` sem expor PII.
- Todas as saídas devem ser agregadas ou hasheadas.
- O adapter deve recusar qualquer SQL fora de `SELECT` e PRAGMA de schema.
- O adapter deve recusar múltiplas statements.
- O adapter deve emitir resumo com `writesExecuted: false`.

## 3. Vinculação de identidade

- Definir hierarquia de identidade: `student_id` canônico; e-mail normalizado como chave auxiliar de reconciliação; telefone/nome apenas como sinais fracos, nunca como vínculo automático isolado.
- Separar casos determinísticos de casos ambíguos.
- Não sobrescrever `student_id` divergente automaticamente.
- Exigir revisão manual quando um e-mail aparece com múltiplos `student_id` ou um `student_id` aparece com múltiplos e-mails.

## 4. Eventual backfill futuro

Qualquer backfill futuro deve ser tratado como Sprint separado e exigir aprovação explícita. Requisitos mínimos:

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

- Validar contagens antes/depois em staging.
- Validar que alunos exclusivos do Projeto LM não entram no Workspace Premium.
- Validar que alunos com Premium + Projeto LM continuam aparecendo no Premium.
- Validar endpoints com autenticação admin real.
- Validar que nenhum relatório imprime e-mail, telefone, nome, token, conteúdo clínico, plano, feedback ou resposta de anamnese.

## 6. Rollback

- Para qualquer mutação futura, gerar backup versionado.
- Guardar mapping de alterações planejadas e executadas.
- Permitir reversão por lote.
- Interromper rollback automaticamente se o estado atual divergir do esperado.

## 7. Testes

- Testes unitários do guard read-only.
- Testes de contrato dos endpoints Admin legado e Workspace.
- Testes de presenter para garantir ausência de PII em relatórios.
- Testes de exclusão Projeto LM.
- Testes de casos ambíguos de identidade.
- Testes de Student 360 com `student_id` ausente/órfão.

## 8. Operação

- Rodar primeiro em staging.
- Exigir confirmação explícita read-only para qualquer consulta em produção.
- Armazenar artefatos sanitizados fora de logs públicos.
- Não fazer deploy junto com auditoria de dados.
- Não misturar auditoria, backfill e correção de código no mesmo release operacional.
