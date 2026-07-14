# LM Premium 3.0 — Build 2B — Repository adapters e dual-write mínimo

## 1. Objetivo
Conectar gradualmente a identidade interna `student_id` aos fluxos centrais do Premium sem alterar contratos públicos. O e-mail continua sendo compatibilidade temporária e token continua sendo autenticação.

## 2. Adapters implementados
- `d1-anamnesis-repository.js`: leitura por ID, leitura latest por `student_id`, fallback por e-mail, criação com `student_id` nullable e marcação de análise.
- `d1-nutrition-plan-repository.js`: plano ativo por `student_id`, fallback legado apenas quando autorizado, gravação determinística do plano atual e atualização do ativo.
- `d1-weekly-feedback-repository.js`: check-ins como feedback semanal, listagem por `student_id`, fallback por e-mail, criação, análise e decisão profissional quando há colunas reais.
- `d1-premium-event-repository.js`: append/listagem de eventos Premium em `activity_timeline`, rejeitando eventos que não pertençam ao catálogo Premium ou prefixo `PREMIUM_`.

## 3. Casos de uso conectados
Foram conectados apenas casos necessários ao core permitido: `get-nutrition-plan`, `save-nutrition-plan`, `list-weekly-feedbacks`, `submit-weekly-feedback`, `analyze-weekly-feedback` e `analyze-anamnesis`. Os casos recebem dependências por injeção e não importam D1 diretamente.

## 4. Pontos de integração no Worker
`workers/api.js` monta a aplicação Premium por request e usa adapters nos pontos migrados: envio de anamnese, leitura/gravação de plano alimentar, envio/listagem/análise de check-ins e atualização de status de anamnese. O endpoint segue responsável por autenticação, transporte, validação básica e resposta legada.

## 5. Dual-read
Leituras internas tentam resolver identidade Premium via `student-identity-service.js`. Quando há `student_id` unívoco, o repository consulta por `student_id`. O fallback por e-mail só ocorre quando a política interna retorna `allowFallback=true`, normalmente em `STUDENT_NOT_FOUND` dentro de contexto Premium autenticado/permitido.

## 6. Dual-write
Gravações centrais persistem `student_id` quando a identidade Premium é resolvida com segurança e preservam `student_email`. Escritas são bloqueadas para `AMBIGUOUS_STUDENT_IDENTITY`, `NON_PREMIUM_STUDENT`, `EMAIL_REQUIRED` e erro técnico, sem consultar fallback por e-mail.

## 7. Fallback legado
Fallback por e-mail é permitido somente quando o aluno Premium ainda não foi backfilled ou não existe identidade Premium conhecida e o caso de uso autorizou explicitamente compatibilidade legada. O fallback não cria identidade automaticamente nem deriva ID do e-mail.

## 8. Conflitos
Ambiguidade e identidade não Premium bloqueiam leitura e escrita Premium. Nesses casos, o repository por e-mail não é consultado e o payload público recebe apenas erro genérico seguro.

## 9. Observabilidade
Foram adicionados logs técnicos sanitizados para: `PREMIUM_IDENTITY_DUAL_WRITE_SUCCESS`, `PREMIUM_IDENTITY_EMAIL_FALLBACK_USED`, `PREMIUM_IDENTITY_DUAL_WRITE_SKIPPED` e `PREMIUM_IDENTITY_ASSOCIATION_CONFLICT`. Logs não incluem tokens, respostas clínicas completas, anamnese completa nem plano alimentar.

## 10. Segurança
`student_id` não autentica ninguém. A autenticação segue por e-mail/token ou admin existente. Endpoints Premium do aluno bloqueiam contas Projeto LM antes de acessar repositories Premium. Adapters Premium não consultam tabelas `lm2_*` ou `project_lm_*`.

## 11. Contratos preservados
Respostas públicas permanecem sem `student_id`, `identity_method` ou flags de fallback. Status HTTP e payloads dos endpoints migrados foram cobertos por testes que exercitam o Worker real.

## 12. Limitações
Não foi criada migration. Decisões profissionais de feedback usam somente colunas reais existentes (`coach_reply`, `coach_status`, `reviewed_at`, `reviewed_by`). `activity_timeline` continua infraestrutura de compatibilidade e não vira Prontuário LM.

## 13. Rollback
Rollback é revert de imports/chamadas em `workers/api.js`. Adapters podem permanecer sem uso. Colunas `student_id` seguem nullable, e o e-mail legado permanece suficiente para operação quando a política autorizar fallback.

## 14. Próximos passos
Auditar dados ambíguos pós-backfill, avaliar FK formal somente depois de estabilização, ampliar contratos de endpoint reais e deixar Prontuário/Workspaces para Builds posteriores.
