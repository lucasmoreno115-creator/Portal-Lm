# LM Premium 3.1 — Plano de Execução Pós-Auditoria

Critérios usados: (1) Workspace não carregar dados, (2) risco operacional, (3) dependências, (4) frequência de uso, (5) rollback simples.

## Nível de validação

- análise estática da main/branch;
- testes automatizados locais;
- nenhum request autenticado ao staging/produção;
- nenhuma comparação de contagens reais;
- nenhuma confirmação de flags e deploy remoto.

## Comportamento de entrada Build 6.6

`GET /admin` é tratado pelo Worker: consulta `PREMIUM_ADMIN_CUTOVER_ENABLED`; `true` redireciona para `/admin-premium-workspace.html`; `false` redireciona para `/admin-legacy.html`. `/admin.html` deve permanecer apenas como bootstrap estático de compatibilidade/fallback, não como entrada normal quando o Worker está ativo.

## Ordem recomendada das próximas PRs

1. **PR 1 — Paridade de identidade e lista de alunos + auditoria remota read-only (P0)**
   - Escopo legado: `/api/admin/students`, `student_access`, Student 360 por e-mail.
   - Equivalente Workspace: `/api/admin/premium/workspace/students`, search e contexto.
   - Endpoints reutilizados: manter legado; adaptar leitura Workspace para identidade comum.
   - Dados preservados: nenhum dado copiado; somente resolver vínculo `email`/`student_id`.
   - Testes: contagens sanitizadas read-only distinguem divergência estrutural de alunos efetivamente afetados; alunos em `student_access` aparecem no Workspace; Projeto LM continua excluído.
   - Rollback: flag/cutover para `/admin-legacy.html`.
   - Desligar legado: somente após 100% da lista antiga visível no Workspace.

2. **PR 2 — Student 360/Prontuário por identidade comum (P0/P1)**
   - Escopo legado: `/api/admin/student-360`.
   - Workspace: `/workspace/students/:student_id` e `/students/:student_id/record`.
   - Reutilizar: queries de anamnese, checkins, plans, timeline.
   - Testes: paridade campo a campo sem PII real.
   - Rollback: links para Student 360 legado preservados.

3. **PR 3 — Anamnese: corrigir destino bloqueado `/admin-anamneses.html` (P0)**
   - Escopo legado: links/redirects que apontam para `/admin-anamneses.html`.
   - Workspace: ações de Anamnese no contexto/prontuário.
   - Reutilizar: endpoints/use cases de anamnese existentes; não criar fluxo clínico novo sem paridade.
   - Dados preservados: somente leitura em `premium_anamnesis`; nenhuma migração.
   - Testes: rota não retorna 404; link real aponta para tela existente; Projeto LM permanece fora do escopo.
   - Rollback: manter links para Student 360/legado até a tela existir.

4. **PR 4 — Plano alimentar atual + draft/publication (P0/P1)**
   - Escopo legado: `/api/admin/nutrition-plan` por e-mail.
   - Workspace: `/premium/students/:student_id/nutrition-plan*`.
   - Reutilizar: `premium_nutrition_plans` e identity fallback controlado.
   - Testes: plano legado por e-mail carrega no Workspace pelo aluno equivalente; draft não sobrescreve publicado.
   - Rollback: página legado por e-mail permanece.

5. **PR 5 — Auth e contratos das subpáginas Premium (P0/P1)**
   - Escopo: `admin-premium-weekly-feedbacks.js`, `admin-premium-nutrition-plan.js`, headers e rotas.
   - Equivalente: mesmo auth do Workspace principal.
   - Testes: 401/403 explícito; headers `x-admin-session`/`x-admin-token`.
   - Rollback: cutover para legado.

6. **PR 6 — Feedback semanal e check-ins (P1)**
   - Escopo legado: `/api/admin/checkins`, reply.
   - Workspace: feedbacks pending/missing/decision e inbox.
   - Reutilizar: `student_checkins`, pending/followup append.
   - Testes: feedback antigo aparece; decisão atualiza status/pendência.
   - Desligar legado: após paridade de resposta e histórico.

7. **PR 7 — Inbox, follow-up legado, follow-up Premium e retenção (P1)**
   - Escopo legado: `followup_logs` e `retention_actions`.
   - Workspace: `premium_pending_items` para Inbox e `premium_followup_entries` para follow-up Premium.
   - Reutilizar: leitura federada sem duplicar; não afirmar Inbox vazia apenas por diferença de tabelas.
   - Testes: Inbox Premium continua lendo `premium_pending_items`; follow-up legado fica visível quando aplicável; resolver não perde histórico; retenção é representada ou explicitamente mantida no legado.

8. **PR 8 — Evolução e timeline (P1/P2)**
   - Escopo: `activity_timeline`, progressão/checkins.
   - Workspace: record/context evolution.
   - Testes: status e histórico aparecem com rótulos equivalentes.

9. **PR 9 — Plano semanal/treino e módulos remanescentes (P1/P2)**
   - Escopo legado: `/api/admin/weekly-plan`, campos treino/cardio/nutrição.
   - Workspace: seção treino/plano semanal.
   - Testes: plano semanal atual e histórico preservados.

## Critérios globais de rollback

- `GET /admin` deve continuar sob controle do Worker e de `PREMIUM_ADMIN_CUTOVER_ENABLED`.
- `/admin.html` deve continuar existindo apenas como bootstrap estático de compatibilidade/fallback.
- Nenhuma PR deve remover endpoint legado antes de teste de paridade e aceite profissional.
- Nenhum dado deve ser copiado para uma tabela nova sem justificativa formal posterior.

## Critério para desligar o legado

- Matriz sem BLOQUEADO/P0.
- Todos os campos do Student 360 legado representados no Workspace.
- Ações administrativas críticas executadas com mesmo efeito de banco.
- Auth, flags e deploy validados em staging antes de produção.
