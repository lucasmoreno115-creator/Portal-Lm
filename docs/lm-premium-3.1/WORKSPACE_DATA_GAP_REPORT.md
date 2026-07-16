# LM Premium 3.1 — Relatório de Causas do Gap de Dados do Workspace

## Resposta objetiva

O Admin legado carrega dados porque usa e-mail e `student_access` como âncora funcional, com consultas diretas/fallbacks em tabelas históricas. O Workspace Premium usa `student_id` e `premium_students` como fonte primária. Quando alunos antigos, check-ins, anamneses, planos ou follow-ups não estão vinculados por `student_id`/`premium_students`, o Workspace retorna listas vazias, 404 ou contexto incompleto, embora o legado ainda encontre dados por e-mail.

## Causas

| Classificação | Causa | Evidência | Impacto | Módulos | Risco | Correção futura recomendada | Exige | Prioridade |
|---|---|---|---|---|---|---|---|---|
| CONFIRMADA | Lista legado usa `student_access`; Workspace usa `premium_students`. | `/api/admin/students` seleciona `student_access`; `/workspace/students` usa use case premium. | Workspace pode ficar vazio para alunos antigos. | Dashboard, lista, contexto | alto operacional | adapter/read model que reutilize identidade legado ou vínculo seguro sem duplicar dados | código/config/dados de vínculo | P0 |
| CONFIRMADA | Legado busca Student 360 por `email`; Workspace exige `student_id`. | `/api/admin/student-360` valida email; endpoints novos têm `:student_id`. | Contextos não carregam sem mapping. | Student 360, record, plano, pending | alto | resolver identidade comum email↔student_id e fallback read-only auditado | código | P0 |
| CONFIRMADA | Plano legado aceita fallback por e-mail; plano novo valida `findByStudentId`. | use cases `getNutritionPlan`/`saveNutritionPlan` usam identity fallback; workflow novo usa `findByStudentId`. | plano aparece no legado e some no Workspace. | Nutrition | alto | unificar leitura por identidade preservando tabela | código | P0 |
| CONFIRMADA | Subpáginas Premium não usam mesmo header admin do Workspace principal. | Workspace principal usa `LMAdminAuth`; weekly-feedback usa `credentials: include`; nutrition não injeta admin headers. | 401/403 ou falha silenciosa local/deploy. | Feedback, nutrition | médio/alto | padronizar auth em PR futura | código | P0 |
| PROVÁVEL | Rotas frontend de weekly feedback não batem integralmente com handler auditado. | JS chama `/api/admin/premium/weekly-feedbacks/pending|missing|:id`; handler auditado mostra decisão em `/premium/feedbacks/:id/decision`. | tela pode não listar ou salvar decisão. | Feedback | médio | alinhar contratos ou adapter sem quebrar legado | código | P1 |
| POSSÍVEL | Feature flag do Workspace desliga blocos. | `featureFlag.enabled` controla aviso e saturday review; flag `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED`. | Workspace aparenta vazio/desabilitado. | Dashboard | médio | checklist de env/deploy | configuração | P1 |
| POSSÍVEL | Duplicidade de assets raiz/assets. | Existem `public/admin-premium-workspace.js` e `public/assets/js/admin-premium-workspace.js`. | Deploy pode servir versão diferente. | Workspace/feedback/nutrition | médio | remover duplicidade somente após freeze/rollback | deploy/código | P2 |
| DESCARTADA | Necessidade de criar novas tabelas para Sprint 0. | Tabelas relevantes já aparecem no código; Sprint é auditoria. | Não aplicável. | todos | baixo | não criar migration agora | n/a | P3 |

## Hipóteses não confirmadas por não consultar dados reais

- Quantidade de alunos presentes em `student_access` e ausentes em `premium_students`.
- Percentual de `student_checkins`, `premium_anamnesis` e `premium_nutrition_plans` sem `student_id` válido.
- Se produção/staging está com Worker, Pages e assets sincronizados.
- Se flags de produção estão habilitadas.
