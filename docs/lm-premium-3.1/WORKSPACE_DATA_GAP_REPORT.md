# LM Premium 3.1 — Relatório de Causas do Gap de Dados do Workspace

## Nível de validação

- análise estática da main/branch;
- testes automatizados locais;
- nenhum request autenticado ao staging/produção;
- nenhuma comparação de contagens reais;
- nenhuma confirmação de flags e deploy remoto.

## Resposta objetiva

No código, o Admin legado consegue carregar dados por caminhos mais antigos ancorados em e-mail e `student_access`, enquanto o Workspace Premium usa `student_id`, `premium_students` e tabelas Premium como fonte primária. Essa divergência estrutural está confirmada no código. Porém, a existência de alunos afetados no ambiente atual, o volume de registros órfãos e a afirmação de que produção/staging está vazio por essa razão **não foram confirmados** porque não houve contagens reais nem requests autenticados remotos.

## Causas refinadas

| Classificação | Causa | Evidência | Impacto comprovado vs não comprovado | Módulos | Risco | Correção futura recomendada | Exige | Prioridade |
|---|---|---|---|---|---|---|---|---|
| CONFIRMADA NO CÓDIGO | Divergência estrutural de fonte de alunos: legado usa `student_access`; Workspace usa `premium_students`. | `/api/admin/students` seleciona `student_access`; `/workspace/students` usa use case/repository Premium. | Comprovado: fontes diferentes. Não comprovado: existência de alunos afetados no ambiente atual e Workspace vazio em produção/staging. | Dashboard, lista, contexto | alto se houver registros sem vínculo | adapter/read model com identidade comum sem duplicar dados | código/config e eventual vínculo de dados | P0 |
| CONFIRMADA NO CÓDIGO | Divergência de identidade: legado busca Student 360 por `email`; Workspace exige `student_id`. | `/api/admin/student-360` valida email; endpoints novos têm `:student_id`. | Comprovado: contratos usam identificadores diferentes. Não comprovado: quantidade de registros sem `student_id`. | Student 360, record, plano, pending | alto se houver dados históricos sem vínculo | resolver identidade comum e fallback read-only auditado | código | P0 |
| CONFIRMADA NO CÓDIGO | Plano alimentar tem caminhos distintos: legado por e-mail/fallback; Workspace por `student_id`/`findByStudentId`. | use cases legados `getNutritionPlan`/`saveNutritionPlan` usam identity fallback; workflow novo valida aluno Premium por `student_id`. | Comprovado: diferença de caminho. Não comprovado: falha real remota sem requests. | Nutrition | alto | unificar leitura por identidade preservando `premium_nutrition_plans` | código | P0 |
| CONFIRMADA NO CÓDIGO | Subpáginas Premium não usam o mesmo helper de auth do Workspace principal. | Workspace principal usa `LMAdminAuth`; weekly feedback usa `credentials: include`; nutrition não injeta headers admin no helper local. | Comprovado: diferença de frontend. Não comprovado: bloqueio 401/403 em produção/staging. | Feedback, nutrition | médio/alto | padronizar auth em PR futura | código | P0 |
| CONFIRMADA NO CÓDIGO | `public/admin-anamneses.html` não existe. | Verificação local `test -f public/admin-anamneses.html` retornou ausente; `_redirects` referencia a rota. | Comprovado: risco de 404/link quebrado. Não há tela funcional de Anamnese a afirmar. | Anamnese | alto operacional se linkado | criar/reativar tela somente em Sprint posterior, sem corrigir agora | código futuro | P0 |
| PROVÁVEL NO AMBIENTE | Rotas frontend de weekly feedback podem não bater com handler/deploy. | JS chama `/api/admin/premium/weekly-feedbacks/pending|missing|:id|:id/decision`; handler auditado mostra `/api/admin/premium/feedbacks/:id/decision`. | Provável incompatibilidade se esse asset/Worker estiverem publicados juntos; requer request remoto para confirmar. | Feedback | médio | alinhar contratos ou adapter sem quebrar legado | código/deploy | P1 |
| PROVÁVEL NO AMBIENTE | Flags/deploy/assets podem explicar diferenças observadas. | `GET /admin` depende de `PREMIUM_ADMIN_CUTOVER_ENABLED`; Workspace summary depende de `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED`; há assets raiz/assets duplicados. | Não confirmado sem flags remotas, cache e versão publicada. | Entrada, Dashboard, Workspace | médio | checklist de env/deploy/cache | configuração/deploy | P1 |
| NÃO CONFIRMADA SEM DADOS REMOTOS | Existem alunos em `student_access` ausentes de `premium_students`. | Hipótese derivada da divergência estrutural. | Não comprovado sem contagens remotas sanitizadas. | Lista, Student 360 | alto se verdadeiro | auditoria read-only de contagens e relacionamentos | banco read-only futuro | P0 |
| NÃO CONFIRMADA SEM DADOS REMOTOS | Existem check-ins/anamneses/planos sem `student_id` válido. | Hipótese derivada de contratos por e-mail vs `student_id`. | Não comprovado sem contagens remotas sanitizadas. | Feedback, Anamnese, Nutrition | alto se verdadeiro | auditoria read-only de órfãos por tabela | banco read-only futuro | P1 |
| DESCARTADA | Necessidade de criar tabelas/migrations/correções neste Sprint 0. | Escopo do Sprint é somente auditoria documental; tabelas existentes cobrem os caminhos identificados. | Não aplicável. | todos | baixo | não implementar nesta PR | n/a | P3 |

## Inbox, follow-up e retenção

- Inbox Premium carrega `premium_pending_items`; isso não permite afirmar que a Inbox necessariamente fica vazia, apenas que a fonte é distinta do follow-up legado.
- Follow-up legado usa `followup_logs`.
- Follow-up Premium usa `premium_followup_entries`.
- Retenção usa `retention_actions`.
- Não há paridade consolidada entre esses quatro fluxos; o plano futuro deve federar ou adaptar leitura sem duplicar dados desnecessariamente.

## Hipóteses não confirmadas por não consultar dados reais

- Quantidade de alunos presentes em `student_access` e ausentes em `premium_students`.
- Percentual de `student_checkins`, `premium_anamnesis` e `premium_nutrition_plans` sem `student_id` válido.
- Se produção/staging está com Worker, Pages e assets sincronizados.
- Se flags de produção/staging estão habilitadas.
- Se requests autenticados remotos retornam 401/403/404 para as subpáginas Premium ou para `/admin-anamneses.html`.
