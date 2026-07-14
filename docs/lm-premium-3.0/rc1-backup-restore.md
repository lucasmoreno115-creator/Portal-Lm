# RC1 — Backup, restore e rollback

## Tabelas críticas
`premium_students`, `student_access`, `premium_anamnesis`, `student_checkins`, `nutrition_plans`, `premium_pending_items`, `premium_followup_entries`, `activity_timeline`.

## Export D1
1. Registrar SHA da release e ambiente.
2. Executar export do banco D1 pelo operador autorizado, sem versionar tokens.
3. Guardar dump com data/hora UTC e hash SHA-256.
4. Extrair contagens das tabelas críticas antes do deploy.

## Validação do backup
- Importar o dump em ambiente de teste.
- Confirmar schema, índices e contagens por tabela.
- Executar `node scripts/audit-lm-premium-rc1.mjs <snapshot.json>` quando houver snapshot JSON exportado para auditoria.

## Restore em teste
1. Criar banco temporário.
2. Importar dump.
3. Executar migrations na ordem documentada.
4. Executar auditoria, smoke e testes RC1.
5. Comparar contagens antes/depois e investigar qualquer diferença não esperada.

## Rollback
- Parar rollout se houver bloqueio de identidade, mistura Projeto LM/Premium, falha de autenticação, migration incompleta ou vazamento de dados.
- Desligar flags Premium visuais quando aplicável.
- Restaurar dump aprovado em ambiente de teste antes de qualquer restore operacional.
- Produção só pode ser restaurada por operador com acesso D1 e aprovação explícita do responsável técnico.
