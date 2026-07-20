# Backfill administrativo de identidades Premium legadas

## Escopo e auditoria

O backfill lê `student_access` (`id`, `name`, `email`, `status`, `plan`,
`plan_type`, `student_id`, `created_at`) e cria identidades apenas em
`premium_students`. As tabelas `premium_anamnesis`, `student_checkins`,
`nutrition_plans`, `activity_timeline`, `weekly_plans`, `progression_logs`,
`followup_logs` e `retention_actions` são lidas somente para auditoria de
associação. Nenhuma delas é atualizada nesta versão.

Uma migração exclusivamente estrutural adiciona
`premium_students.legacy_backfill_batch_id` e a tabela
`premium_legacy_identity_backfill_audit`. Ela não executa backfill de dados.

## Elegibilidade

O candidato precisa ter e-mail normalizável (`trim` e `lowercase`),
`status=ACTIVE` e classificação explícita Premium em `plan` ou `plan_type`.
Os valores `projeto_lm`, `project_lm` e `lm2` são sempre excluídos. Valores
desconhecidos, produto conflitante, múltiplos acessos para o mesmo e-mail,
múltiplas identidades Premium e `student_id` canônico divergente são bloqueios
manuais: o processo não escreve nesses casos.

## Operação controlada

O módulo `scripts/premium-student-identity-backfill.mjs` é chamado por um
runner administrativo D1 autenticado, que deve construir o repositório
`createD1PremiumStudentRepository`. O modo padrão é `dry-run`; o runner deve
emitir somente o objeto `classifications` e os totais, nunca `conflicts`.

```bash
# validação sem escrita (padrão)
node scripts/premium-student-identity-backfill.mjs --dry-run

# o runner administrativo deve exigir ambos os argumentos
node scripts/premium-student-identity-backfill.mjs --apply --batch-id legacy-20260720-01
```

`--apply` sem `--batch-id` termina com código 2 antes de qualquer escrita. O
runner não deve usar `--remote` nem ambiente de produção sem aprovação humana
explícita.

Cada criação usa `generatePremiumStudentId()`; IDs não derivam do e-mail. A
linha criada recebe `source='LEGACY_BACKFILL'`, o lote e timestamps. O
`student_access.student_id` só muda se estiver nulo ou ainda contiver o próprio
e-mail; um ID canônico jamais é sobrescrito. Reexecuções localizam a identidade
por `normalized_email`, não duplicam a linha e não alteram IDs canônicos.

## Rollback

O audit registra o `student_access_id`, o valor anterior e o novo ID por lote.
O rollback restaura o acesso somente quando ele ainda aponta para o ID criado
pelo mesmo lote. Depois tenta apagar somente linhas do lote que nunca foram
alteradas (`updated_at=created_at`). Linhas modificadas posteriormente não são
apagadas. O rollback não toca planos, anamneses ou feedbacks.
