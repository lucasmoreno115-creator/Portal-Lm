# Release 3.0.0 — Backup, restore e rollback

> Release 3.0.0: este documento é mantido como histórico da RC1 e referência operacional para a release oficial.


## Tabelas críticas
`premium_students`, `student_access`, `premium_anamnesis`, `student_checkins`, `nutrition_plans`, `premium_pending_items`, `premium_followup_entries`, `activity_timeline`.

## Evidência real local
Procedimento documentado e verify preparado para consumir evidências (`snapshot`, `schema`, `smoke-results`, `flags`). Não houve restore real de D1 nesta etapa.

## Export D1
1. Registrar SHA da release e ambiente.
2. Exportar D1 por operador autorizado, sem versionar tokens.
3. Gerar snapshot JSON no contrato obrigatório da auditoria ou converter dump SQL para esse contrato.
4. Guardar dump com data/hora UTC e hash SHA-256.
5. Extrair contagens das tabelas críticas antes do deploy.

## Validação do backup
- Importar dump em ambiente de teste/staging.
- Confirmar schema, colunas, índices e contagens.
- Executar `node scripts/audit-lm-premium-rc1.mjs --snapshot ./snapshot.json`.
- Executar `node scripts/verify-lm-premium-rc1.mjs --snapshot ./snapshot.json --schema ./schema.json --smoke-results ./smoke-results.json --flags ./flags.json`.

## Restore em teste
Pendente de staging. Passos: criar D1 temporário, importar dump, comparar contagens, executar auditoria, smoke e verify, registrar evidência.

## Rollback
Parar rollout em divergência de identidade, múltiplos planos publicados, vazamento de dados, Projeto LM aparecendo no Premium, autenticação quebrada, migration incompleta, Workspace sistêmico quebrado ou dados misturados entre alunos.
