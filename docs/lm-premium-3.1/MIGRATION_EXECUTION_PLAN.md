# LM Premium 3.1 — Plano de Execução Pós-Auditoria

Critérios usados: (1) Workspace não carregar dados, (2) risco operacional, (3) dependências, (4) frequência de uso, (5) rollback simples.

## Ordem recomendada das próximas PRs

1. **PR 1 — Paridade de identidade e lista de alunos (P0)**
   - Escopo legado: `/api/admin/students`, `student_access`, Student 360 por e-mail.
   - Equivalente Workspace: `/api/admin/premium/workspace/students`, search e contexto.
   - Endpoints reutilizados: manter legado; adaptar leitura Workspace para identidade comum.
   - Dados preservados: nenhum dado copiado; somente resolver vínculo `email`/`student_id`.
   - Testes: alunos em `student_access` aparecem no Workspace; Projeto LM continua excluído.
   - Rollback: flag/cutover para `/admin-legacy.html`.
   - Desligar legado: somente após 100% da lista antiga visível no Workspace.

2. **PR 2 — Student 360/Prontuário por identidade comum (P0/P1)**
   - Escopo legado: `/api/admin/student-360`.
   - Workspace: `/workspace/students/:student_id` e `/students/:student_id/record`.
   - Reutilizar: queries de anamnese, checkins, plans, timeline.
   - Testes: paridade campo a campo sem PII real.
   - Rollback: links para Student 360 legado preservados.

3. **PR 3 — Plano alimentar atual + draft/publication (P0/P1)**
   - Escopo legado: `/api/admin/nutrition-plan` por e-mail.
   - Workspace: `/premium/students/:student_id/nutrition-plan*`.
   - Reutilizar: `premium_nutrition_plans` e identity fallback controlado.
   - Testes: plano legado por e-mail carrega no Workspace pelo aluno equivalente; draft não sobrescreve publicado.
   - Rollback: página legado por e-mail permanece.

4. **PR 4 — Auth e contratos das subpáginas Premium (P0/P1)**
   - Escopo: `admin-premium-weekly-feedbacks.js`, `admin-premium-nutrition-plan.js`, headers e rotas.
   - Equivalente: mesmo auth do Workspace principal.
   - Testes: 401/403 explícito; headers `x-admin-session`/`x-admin-token`.
   - Rollback: cutover para legado.

5. **PR 5 — Feedback semanal e check-ins (P1)**
   - Escopo legado: `/api/admin/checkins`, reply.
   - Workspace: feedbacks pending/missing/decision e inbox.
   - Reutilizar: `student_checkins`, pending/followup append.
   - Testes: feedback antigo aparece; decisão atualiza status/pendência.
   - Desligar legado: após paridade de resposta e histórico.

6. **PR 6 — Pendências, follow-up e comunicação (P1)**
   - Escopo legado: `followup_logs`, `retention_actions`.
   - Workspace: `premium_pending_items`, `premium_followup_entries`.
   - Reutilizar: leitura federada sem duplicar; registrar nova entrada só em ação nova.
   - Testes: pendência legado visível; resolver não perde histórico.

7. **PR 7 — Anamnese, evolução e timeline (P1/P2)**
   - Escopo: anamnese por e-mail, `activity_timeline`, progressão/checkins.
   - Workspace: record/context evolution.
   - Testes: status e histórico aparecem com rótulos equivalentes.

8. **PR 8 — Plano semanal/treino e módulos remanescentes (P1/P2)**
   - Escopo legado: `/api/admin/weekly-plan`, campos treino/cardio/nutrição.
   - Workspace: seção treino/plano semanal.
   - Testes: plano semanal atual e histórico preservados.

## Critérios globais de rollback

- `/admin.html` deve continuar podendo redirecionar para `/admin-legacy.html`.
- Nenhuma PR deve remover endpoint legado antes de teste de paridade e aceite profissional.
- Nenhum dado deve ser copiado para uma tabela nova sem justificativa formal posterior.

## Critério para desligar o legado

- Matriz sem BLOQUEADO/P0.
- Todos os campos do Student 360 legado representados no Workspace.
- Ações administrativas críticas executadas com mesmo efeito de banco.
- Auth, flags e deploy validados em staging antes de produção.
