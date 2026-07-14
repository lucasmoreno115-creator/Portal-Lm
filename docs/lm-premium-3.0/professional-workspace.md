# LM Premium 3.0 — Build 6 — Professional Workspace

## 1. Objetivo
O Workspace Premium é a superfície operacional principal do profissional para responder rapidamente quem precisa de atenção, o que precisa ser feito, por que existe a pendência, qual é o próximo passo e onde abrir o contexto completo do aluno.

## 2. Papel do Workspace
A tela `/admin-premium-workspace.html` consolida alunos Premium, pendências oficiais, feedback semanal, anamnese, plano alimentar, Prontuário LM e evolução. Ela não substitui Student 360, Prontuário LM ou editores legados.

## 3. Inbox
A Inbox lê `premium_pending_items` e apresenta ações abertas por prioridade, data e aluno. Os tipos iniciais são `ANALYZE_ANAMNESIS`, `ANALYZE_WEEKLY_FEEDBACK`, `CREATE_NUTRITION_PLAN`, `CONTACT_STUDENT`, `REQUEST_INFORMATION`, `MANUAL` e `CUSTOM` como compatibilidade manual.

## 4. Lista de alunos
A lista usa somente `premium_students` como domínio de alunos Premium e agrega contato resumido, status de consultoria, acesso, última atividade, pendências abertas, feedback, anamnese, plano e próxima ação operacional.

## 5. Busca
A busca é case-insensitive por nome, e-mail e telefone, com espaços normalizados, limite padrão 20 e SQL parametrizado. Ela retorna apenas o read model resumido.

## 6. Filtros
Há filtros por status oficial de consultoria, pendências abertas, feedback aguardando análise, anamnese aguardando análise, sem plano publicado e plano pendente de atualização.

## 7. Read model
`ProfessionalWorkspaceStudentSummary` é um objeto de leitura não persistido, derivado das fontes oficiais. Ele não cria tabela de cache e não vira fonte de verdade.

## 8. Contexto do aluno
O detalhe sob demanda mostra resumo, pendências abertas, feedbacks recentes, planos resumidos, anamnese resumida e até 10 registros de `premium_followup_entries`.

## 9. Ações rápidas
Os CTAs usam rotas reais: Prontuário LM, Feedback Semanal, Plano Alimentar, Anamnese e Student 360. Resolver pendência reutiliza o endpoint existente `PATCH /api/admin/premium/pending-items/:id/resolve`.

## 10. Indicadores
São exibidas apenas contagens operacionais: pendências abertas, feedbacks aguardando análise, alunos sem resposta, planos aguardando atualização e anamneses aguardando análise.

## 11. Modo sábado
Quando a data em `America/Sao_Paulo` é sábado, a tela destaca revisão semanal com os mesmos fatos operacionais. Não há estado persistido novo.

## 12. Endpoints
- `GET /api/admin/premium/workspace/summary`
- `GET /api/admin/premium/workspace/students`
- `GET /api/admin/premium/workspace/students/search`
- `GET /api/admin/premium/workspace/students/:student_id`
- `GET /api/admin/premium/workspace/pending-items`
- `GET /api/admin/premium/workspace/saturday-review`

## 13. Performance
O repository usa consultas agregadas, paginação por offset/cursor simples, limite padrão 25 e máximo 50. A migration `0033_add_professional_workspace_indexes.sql` adiciona somente índices de leitura.

## 14. Segurança
Todos os endpoints ficam sob `/api/admin/` e exigem sessão admin. Projeto LM não é consultado. O frontend usa DOM APIs e `textContent`, parâmetros com `encodeURIComponent` e URLs fixas.

## 15. Feature flag
`PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED` controla a adoção visual. Com a flag desligada, a tela informa rollback visual e mantém páginas legadas disponíveis; endpoints seguem testáveis.

## 16. Rollback
Desligar a flag remove a adoção visual sem alterar dados. Student 360, Prontuário LM, Feedback Semanal, editor de Plano Alimentar, pendências e evoluções permanecem preservados.

## 17. Limitações
Não há automação clínica, score, IA, interpretação de exames, envio automático de mensagem, ajuste automático de plano, agenda completa, financeiro ou gráficos analíticos.

## 18. Próximos passos
Aprimorar ergonomia de operação e navegação depois de validação de uso real, sem avançar para automação clínica ou Build 7.
