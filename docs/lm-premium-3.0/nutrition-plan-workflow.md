# LM Premium 3.0 — Build 5 — Nutrition Plan Workflow

## 1. Objetivo
Formalizar o plano alimentar como fluxo profissional de criação, revisão, publicação, uso pelo aluno, atualização e histórico. O sistema organiza dados; Lucas mantém a decisão nutricional.

## 2. Ciclo de vida
O ciclo oficial é `DRAFT → PUBLISHED → ARCHIVED`. Rascunhos não aparecem ao aluno; a publicação torna uma versão visível; versões anteriores são preservadas.

## 3. Estados
- `DRAFT`: editável, invisível ao aluno, `is_active = 0`.
- `PUBLISHED`: versão oficial atual, visível ao aluno, `is_active = 1`.
- `ARCHIVED`: versão histórica, invisível como plano atual, `is_active = 0`.

## 4. Schema canônico
O schema interno contém `title`, `goal`, `strategy`, `generalGuidance`, `meals`, `substitutions`, `adherenceRules`, `notes` e `whatsappMessage`. Cada refeição contém `id`, `name`, `time`, `guidance`, `items` e `substitutions`; cada item contém `food`, `quantity`, `unit` e `note`.

## 5. Rascunho
A criação de rascunho usa `student_id` como identidade principal, preserva o plano publicado atual e usa `INSERT OR IGNORE` mais índice único parcial de draft aberto após 0032 para idempotência sob concorrência.

## 6. Publicação
Publicar valida apenas estrutura e executa um CAS condicional por `id`, `student_id` e `status = DRAFT` em conjunto lógico com os efeitos derivados. A operação só retorna sucesso depois de confirmar plano `PUBLISHED`, `is_active = 1`, versão atribuída, plano anterior arquivado quando existir, `PLAN_CHANGE` existente e pendências relacionadas resolvidas. A publicação não calcula dieta, macros ou calorias.

## 7. Histórico
O histórico lista versões por aluno com status, versão, publicação, responsável, objetivo e origem. Conteúdo integral de todas as versões não precisa ser carregado na primeira resposta.

## 8. Versionamento
`version_number` é incremental por `student_id` no momento da publicação. O frontend nunca calcula a versão.

## 9. Compatibilidade legada
Campos existentes de `nutrition_plans` são reaproveitados. `student_email` permanece temporariamente para compatibilidade; `student_id` é o vínculo principal do workflow novo.

## 10. Migration
`0031_add_nutrition_plan_lifecycle.sql` adiciona somente colunas e índices não exclusivos. Nenhum backfill e nenhum índice único ocorre antes da auditoria. Depois de auditoria sem conflitos, `0032_finalize_nutrition_plan_lifecycle.sql` faz o backfill controlado e cria os índices únicos de `PUBLISHED`, `DRAFT` aberto e versão por aluno.

## 11. Auditoria
Ordem obrigatória: aplicar 0031, executar `scripts/audit-nutrition-plan-lifecycle.mjs`, resolver todos os conflitos e somente então aplicar 0032. Conflitos de múltiplos ativos, múltiplos `PUBLISHED`, múltiplos `DRAFT`, draft sem `student_id`, ativo sem `student_id`, divergência e-mail/identidade, Projeto LM e incompatibilidade `status/is_active` bloqueiam rollout com exit code 1.

## 12. Integração com Feedback Semanal
Rascunhos podem receber `source_feedback_id`. Decisão `UPDATE_PLAN` não altera dieta automaticamente; apenas mantém o vínculo para Lucas criar e publicar uma nova versão.

## 13. Integração com Pendências
Pendência `CREATE_NUTRITION_PLAN` permanece aberta durante edição do rascunho e é resolvida de forma idempotente ao publicar.

## 14. Integração com Prontuário
O Prontuário pode exibir plano atual, rascunho administrativo, última publicação, origem, CTA de abertura e histórico resumido. Aluno não vê rascunhos nem histórico administrativo.

## 15. Contratos
Aluno: `GET /api/portal/premium/nutrition-plan/current`. Admin: endpoints sob `/api/admin/premium/students/:student_id/nutrition-plan` e `/api/admin/premium/nutrition-plans/:id/*`.

## 16. Segurança
Aluno não envia `student_id`; admin usa `student_id` do contexto. O presenter público remove IDs internos, status técnico, pendências, histórico e observações privadas. UI usa `textContent`/DOM APIs.

## 17. Idempotência
Criação de rascunho retorna rascunho aberto existente. Retry de publicação já `PUBLISHED` executa `ensurePublicationEffects`: recria `PLAN_CHANGE` determinístico se faltar, resolve pendência ainda aberta, não cria nova versão, não arquiva outro plano e só retorna sucesso após confirmar todos os efeitos.

## 18. Atomicidade
A publicação agrupa CAS, `PLAN_CHANGE` e resolução de pendências em batch quando disponível e sempre relê/valida os efeitos após o batch. Se D1 ou a rede falhar após mudança parcial, o retry obrigatório chama `ensurePublicationEffects` e repara efeitos idempotentes antes de retornar sucesso.

## 19. Feature flag
`PREMIUM_NUTRITION_PLAN_WORKFLOW_ENABLED` protege a adoção visual da nova UI. Editor legado e leitura legada permanecem disponíveis para rollback.

## 20. Rollback
Desligar a nova UI, manter editor legado, manter colunas novas sem uso e preservar planos, rascunhos, históricos, pendências e evoluções.

## 21. Limitações
A UI é inicial e operacional. Não há prescrição automática, cálculo energético, interpretação clínica, envio automático de WhatsApp ou Workspace completo.

## 22. Próximos passos
No próximo Build, evoluir navegação e experiência dos Workspaces sem automatizar conduta clínica e sem substituir o MFit.

## 23. Evolução Build 6 — Workspace Profissional

O Workspace Premium mostra apenas resumo do plano atual, rascunhos e pendências de atualização. O conteúdo completo das refeições permanece no workflow de Plano Alimentar, e a publicação continua sendo o único fluxo que resolve pendências de atualização.
