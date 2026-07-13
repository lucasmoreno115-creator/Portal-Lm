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
- `plan`: fronteira de produto; somente `premium` é elegível para identidade Premium automática.

## 5. Tabelas afetadas
- Nova tabela: `premium_students`.
- Coluna nullable `student_id`: `student_access`, `premium_anamnesis`, `nutrition_plans`, `student_checkins`, `activity_timeline`, `weekly_plans`, `progression_logs`, `followup_logs`, `retention_actions`.
- As tabelas `weekly_plans`, `progression_logs`, `followup_logs` e `retention_actions` recebem `student_id` apenas para integridade histórica e compatibilidade de migração; isso não as promove ao núcleo futuro do Premium 3.0.

## 6. Estratégia de migration
As migrations são aditivas:
1. `0025_create_premium_students.sql` cria a tabela oficial e índices.
2. `0026_add_student_id_to_premium_tables.sql` adiciona colunas nullable e índices por `student_id`.

Foreign keys formais foram adiadas porque dados legados podem conter órfãos ou divergências de e-mail. A prioridade deste Build é migração segura, reversível e sem bloqueio por inconsistência histórica.

## 7. Estratégia de backfill
O script `scripts/premium-student-identity-backfill.mjs` exporta `runPremiumStudentIdentityBackfill` para runner D1 autenticado. A fonte principal é `student_access`, restrita a `plan = 'premium'`. Para cada e-mail elegível, o script normaliza, procura identidade existente e cria uma identidade somente quando há correspondência unívoca. Registros Premium sem `student_id` e com e-mail compatível são associados sem sobrescrever associação existente.

## 8. Conflitos possíveis
O relatório estruturado inclui `type`, `table`, `record`, `email`, `reason` e `recommended_action`. O Build detecta e não corrige silenciosamente: e-mail vazio, múltiplos acessos para o mesmo e-mail normalizado, acesso não Premium, colisão de identidade e dado Premium sem acesso correspondente. Tokens não são emitidos no relatório.

## 9. Dual-read
`workers/premium/services/student-identity-service.js` resolve por `student_id` quando informado e usa e-mail normalizado como fallback temporário. O serviço retorna resultado explícito (`ok`, `method`, `student`, `error`) e rejeita ausências, ambiguidade e alunos classificados como Projeto LM.

## 10. Dual-write
Não há dual-write amplo neste Build. Endpoints públicos e payloads legados não foram alterados. O Build 2B deve avaliar pontos mínimos de gravação de `student_id` após o backfill, mantendo gravação de e-mail legado.

## 11. Segurança
`student_id` não é credencial e não concede acesso. Autenticação por e-mail/token continua separada. O backfill não lê nem imprime tokens. A fronteira de produto é preservada por `plan = 'premium'`, sem incorporar contas exclusivamente Projeto LM.

## 12. Rollback
Rollback de código pode ser feito por revert do commit. Migrations aplicadas são aditivas: colunas e tabela podem permanecer sem uso. Não é recomendado remover `student_id` já gerado, pois isso destruiria identidade histórica. Endpoints legados continuam funcionando porque e-mail/token e payloads existentes permanecem inalterados.

## 13. Limitações
O backfill manual deste Build não executa D1 diretamente por padrão; ele exporta a lógica testável e segura para ser conectada a um runner operacional. Estados clínicos complexos não são inferidos: o estado inicial conservador é `NEW`, e `access_status` mapeia o status técnico de acesso para `ACTIVE` ou `INACTIVE`.

## 14. Próximos passos para Build 2B
Conectar dual-write mínimo nos pontos seguros, ampliar uso interno de `student_id` em consultas Premium, decidir FK formal após auditoria de conflitos e manter Projeto LM isolado.
