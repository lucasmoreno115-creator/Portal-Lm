# LM Premium 3.0 — Build 2A — Migração de identidade do aluno

## 1. Problema atual
O Premium ainda usa e-mail como identificador operacional em `student_access`, anamneses, planos, check-ins, timeline e módulos históricos. Como e-mail é contato mutável, mudanças futuras podem quebrar histórico e dificultar auditoria.

## 2. Objetivo
Introduzir `student_id` como identidade estável, imutável, exclusiva do aluno Premium e independente de e-mail, token ou plano, preservando e-mail/token como contratos legados.

## 3. Modelo de identidade
A tabela oficial é `premium_students`. O campo `student_id` é `TEXT PRIMARY KEY`, gerado pela aplicação com `crypto.randomUUID()` ou gerador compatível injetado em teste. O ID nunca é derivado do e-mail e não deve ser reatribuído.

## 4. Relação entre student_id, e-mail, token e produto
- `student_id`: identidade permanente do domínio Premium.
- `email`: atributo de contato e compatibilidade; normalizado com `trim()` e `lowercase` em `normalized_email`.
- `access_token`: credencial legada de acesso, não lida nem registrada pelo backfill.
- `plan` e `plan_type`: fronteira de produto; Premium só é elegível quando há classificação Premium explícita em uma dessas colunas e nenhuma classificação Projeto LM conflitante.

## 5. Tabelas afetadas
- Nova tabela: `premium_students`.
- Coluna nullable `student_id`: `student_access`, `premium_anamnesis`, `nutrition_plans`, `student_checkins`, `activity_timeline`, `weekly_plans`, `progression_logs`, `followup_logs`, `retention_actions`.
- As tabelas `weekly_plans`, `progression_logs`, `followup_logs` e `retention_actions` recebem `student_id` apenas para integridade histórica e compatibilidade de migração; isso não as promove ao núcleo futuro do Premium 3.0.

## 6. Estratégia de migration
As migrations são aditivas dentro do framework operacional, que executa cada arquivo versionado uma única vez:
1. `0025_create_premium_students.sql` cria a tabela oficial e índices.
2. `0026_add_student_id_to_premium_tables.sql` adiciona colunas nullable e índices por `student_id`.

A migration `0026` usa `ALTER TABLE ... ADD COLUMN`; portanto, o arquivo SQL isolado não deve ser descrito como reexecutável manualmente. A idempotência exigida para o Build 2A fica garantida no bootstrap defensivo (`ensureColumn`), no backfill e no fluxo operacional de execução única das migrations. Foreign keys formais foram adiadas porque dados legados podem conter órfãos ou divergências de e-mail. A prioridade deste Build é migração segura, reversível e sem bloqueio por inconsistência histórica.

## 7. Estratégia de backfill
O script `scripts/premium-student-identity-backfill.mjs` exporta `runPremiumStudentIdentityBackfill` para execução com repository D1 autenticado. O modo padrão é `dry-run`; persistência real só ocorre quando `mode: 'apply'` ou `--apply` for solicitado explicitamente por um runner operacional.

A fonte principal é `student_access`, sem `coalesce` e sem default silencioso para Premium. A elegibilidade avalia `plan` e `plan_type` explicitamente:
- Premium explícito em `plan` ou `plan_type` é elegível quando a outra coluna está ausente ou também Premium.
- Projeto LM em qualquer coluna impede criação automática.
- `plan` e `plan_type` conflitantes geram conflito.
- ambos ausentes geram conflito.
- valor desconhecido gera conflito.
- quando o mesmo e-mail aparece em acessos de produtos diferentes, a regra conservadora bloqueia todo o e-mail no backfill (`MIXED_PRODUCT_ACCESS_FOR_EMAIL`): nenhum acesso recebe `student_id` até revisão manual.

A associação usa allowlist fixa de tabelas/colunas, queries parametrizadas e `DB.batch` quando disponível no adapter D1. Para `student_access`, o backfill nunca associa por simples igualdade de e-mail: ele só atualiza o `id` exato do acesso Premium elegível e unívoco que originou a identidade. Registros Projeto LM, com classificação ausente, desconhecida ou conflitante nunca são atualizados. O backfill cria identidades em `premium_students` e atualiza `student_id` apenas quando a coluna está nula. Quando um registro já possui `student_id`, valor igual conta como associação existente; valor diferente gera `IDENTITY_ASSOCIATION_MISMATCH` e nunca é sobrescrito. A segunda execução não duplica identidade nem sobrescreve `student_id` válido.

## 8. Conflitos possíveis
O relatório estruturado inclui `type`, `table`, `record`, `email`, `reason` e `recommended_action`. O Build detecta e não corrige silenciosamente: `EMPTY_EMAIL`, `MULTIPLE_ACCESS_RECORDS`, `MISSING_PRODUCT_CLASSIFICATION`, `CONFLICTING_PRODUCT_CLASSIFICATION`, `UNKNOWN_PRODUCT_CLASSIFICATION`, `NON_PREMIUM_ACCESS`, `MIXED_PRODUCT_ACCESS_FOR_EMAIL`, `IDENTITY_COLLISION`, `IDENTITY_ASSOCIATION_MISMATCH` e `PREMIUM_DATA_WITHOUT_ACCESS`. Tokens não são emitidos no relatório.

## 9. Relatório de execução
O resultado do backfill contém `mode`, `candidates`, `created`, `associated`, `skipped`, `existing_associations`, `planned_created`, `planned_associated` e `conflicts`. Em `dry-run`, `created` e `associated` permanecem zero porque nada é persistido; os campos `planned_*` mostram o impacto previsto. Em `apply`, `created` e `associated` representam alterações realmente persistidas pelo repository D1.

## 10. Dual-read
`workers/premium/services/student-identity-service.js` resolve por `student_id` quando informado e usa e-mail normalizado como fallback temporário. O serviço retorna resultado explícito (`ok`, `method`, `student`, `error`) e rejeita ausências, ambiguidade e alunos classificados como Projeto LM.

## 11. Dual-write
Não há dual-write amplo neste Build. Endpoints públicos e payloads legados não foram alterados. O Build 2B deve avaliar pontos mínimos de gravação de `student_id` após o backfill, mantendo gravação de e-mail legado.

## 12. Segurança
`student_id` não é credencial e não concede acesso. Autenticação por e-mail/token continua separada. O backfill não lê nem imprime tokens. A fronteira de produto é preservada por classificação explícita de `plan`/`plan_type`, sem incorporar contas exclusivamente Projeto LM.

## 13. Rollback
Rollback de código pode ser feito por revert do commit. Migrations aplicadas são aditivas: colunas e tabela podem permanecer sem uso. Não é recomendado remover `student_id` já gerado, pois isso destruiria identidade histórica. Endpoints legados continuam funcionando porque e-mail/token e payloads existentes permanecem inalterados.

## 14. Limitações
Estados clínicos complexos não são inferidos: o estado inicial conservador é `NEW`, e `access_status` mapeia o status técnico de acesso para `ACTIVE` ou `INACTIVE`. O script CLI não abre conexão D1 sozinho; a persistência real ocorre quando usado com o adapter D1 em um runner operacional autenticado.

## 15. Próximos passos para Build 2B
Conectar dual-write mínimo nos pontos seguros, ampliar uso interno de `student_id` em consultas Premium, decidir FK formal após auditoria de conflitos e manter Projeto LM isolado.

## 16. Evolução Build 2B — repository adapters e dual-write mínimo
O Build 2B conecta adapters D1 reais para anamnese, plano alimentar, feedback semanal/check-ins e eventos Premium. As gravações centrais passam a tentar resolver identidade com `student-identity-service.js`; quando a identidade é unívoca, `student_id` é persistido junto com o e-mail legado. Quando a identidade está ausente, ambígua ou não Premium, o fluxo legado por e-mail é preservado sem associar `student_id`, com observabilidade técnica sanitizada. Nenhum payload público passa a expor `student_id`, e nenhuma migration adicional foi criada.
