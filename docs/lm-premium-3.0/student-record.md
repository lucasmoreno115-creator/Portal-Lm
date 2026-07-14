# Prontuário LM — Build 3

## 1. Objetivo

O Prontuário LM cria uma superfície administrativa central para Lucas consultar o acompanhamento longitudinal de cada aluno Premium por `student_id`, sem substituir as telas legadas.

## 2. Definição

O Prontuário LM é o registro longitudinal do acompanhamento profissional. Ele prioriza decisões, pendências e contexto útil para conduta futura; não é log técnico, dashboard decorativo, timeline de cliques nem mecanismo automático de julgamento clínico.

## 3. Dados exibidos

A tela inicial exibe cabeçalho do aluno, resumo atual, pendências abertas, anamnese mais recente, plano alimentar ativo, últimos feedbacks semanais e evolução profissional recente.

## 4. Fontes de dados

As fontes consolidadas são `premium_students`, `student_access`, `premium_anamnesis`, `nutrition_plans`, `student_checkins`, `premium_followup_entries` e `premium_pending_items`. `activity_timeline` permanece infraestrutura de compatibilidade e não é a timeline principal do Prontuário.

## 5. Evolução do acompanhamento

A tabela `premium_followup_entries` armazena registros profissionais relevantes. Tipos permitidos: `PROFESSIONAL_NOTE`, `PROFESSIONAL_DECISION`, `PLAN_CHANGE`, `ANAMNESIS_REVIEW`, `FEEDBACK_REVIEW`, `CONSULTATION_STATUS_CHANGE`, `PENDING_ITEM_CREATED` e `PENDING_ITEM_RESOLVED`.

## 6. Condutas

Condutas são registradas como evolução, especialmente ao responder feedbacks. Condutas iniciais: `KEEP_STRATEGY`, `UPDATE_PLAN`, `CONTACT_STUDENT` e `REQUEST_MORE_INFORMATION`. A nota profissional é opcional e a escolha nunca é automatizada.

## 7. Pendências

A tabela `premium_pending_items` armazena ações reais. Status: `OPEN`, `RESOLVED`, `DISMISSED`. Prioridade: `NORMAL`, `HIGH`. Tipos: `ANALYZE_ANAMNESIS`, `CREATE_NUTRITION_PLAN`, `ANALYZE_WEEKLY_FEEDBACK`, `CONTACT_STUDENT`, `REQUEST_INFORMATION` e `CUSTOM`.

## 8. Regras automáticas

As pendências automáticas são objetivas e idempotentes: anamnese respondida e não analisada gera `ANALYZE_ANAMNESIS`; feedback respondido e não analisado gera `ANALYZE_WEEKLY_FEEDBACK`; consultoria `ACTIVE` sem plano ativo gera `CREATE_NUTRITION_PLAN`. A idempotência é garantida no banco por índice único parcial que normaliza `NULL` com `COALESCE(related_entity_type, '')` e `COALESCE(related_entity_id, '')`, e o repository usa `INSERT OR IGNORE` seguido de leitura da pendência aberta existente/criada.

## 9. Endpoints

Endpoints administrativos internos: `GET /api/admin/premium/students/:student_id/record`, `POST /api/admin/premium/students/:student_id/followup-entries`, `POST /api/admin/premium/students/:student_id/pending-items`, `PATCH /api/admin/premium/pending-items/:id/resolve`, `PATCH /api/admin/premium/students/:student_id/status` e `POST /api/admin/premium/feedbacks/:id/decision`.

## 10. Segurança

Todos os endpoints ficam dentro do gate `/api/admin/` e exigem admin autorizado. O prontuário não usa e-mail como identificador principal, não retorna tokens, não autentica aluno por `student_id` e consulta apenas registros vinculados ao `student_id` Premium. Na UI administrativa, dados vindos do banco, do aluno ou do profissional são renderizados com `textContent`, `createElement` e `replaceChildren`; `innerHTML` não deve interpolar conteúdo dinâmico. JSON de anamnese deve ser atribuído a `pre.textContent`.

## 11. Performance

A primeira resposta limita feedbacks a 12 itens e evolução a 50 registros. Repositórios usam SQL parametrizado e índices por `student_id`, status, data e entidade relacionada. Alterações de status da consultoria e decisões profissionais usam `DB.batch` para tratar atualização e registro de evolução como uma unidade operacional, evitando sucesso parcial e duplicação em retry.

## 12. Limitações

A interface é a primeira superfície funcional. A edição de plano continua no editor legado. Não há comparação automática de versões, diagnóstico, score novo ou recomendação clínica automática.

## 13. Rollback

Para rollback visual, desabilite `PREMIUM_STUDENT_RECORD_ENABLED`/navegação. Os endpoints podem ser desativados removendo o bloco administrativo novo. As tabelas novas podem permanecer sem uso para preservar histórico, sem apagar evoluções ou pendências e sem alterar Projeto LM.

## 14. Próximos passos

No Build 4, evoluir a experiência profissional com mais fluxo de trabalho apenas se aprovado, mantendo a separação entre decisão profissional e automação operacional.

## 15. Evolução Build 4 — Feedback Semanal

O Feedback Semanal passa a criar pendência `ANALYZE_WEEKLY_FEEDBACK` no envio e a decisão profissional registrada por Lucas gera uma evolução `PROFESSIONAL_DECISION` relacionada a `student_checkins`. A decisão resolve a pendência de análise e pode criar pendência adicional conforme a conduta, mantendo o Prontuário LM como fonte longitudinal sem duplicar timelines.

## 16. Evolução Build 5 — Plano Alimentar

A seção de Plano Alimentar do Prontuário passa a considerar plano atual publicado, rascunho administrativo, origem por Feedback Semanal, pendência relacionada, versão e histórico resumido. Publicações geram evolução `PLAN_CHANGE` com metadados, sem copiar o conteúdo integral da dieta.
