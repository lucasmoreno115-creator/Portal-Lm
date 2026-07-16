# Admin Guide — LM Premium 3.0.0

## Workspace

Use o workspace para triagem operacional: resumo, lista de alunos, busca, pendências e revisão de sábado. A finalidade é priorizar ações, não substituir julgamento profissional.

## Student 360

Abra a visão do aluno para consolidar identidade, status, últimas interações, pendências, feedbacks e plano alimentar. Use essa visão antes de registrar decisões.

## Prontuário

Registre entradas objetivas, com título, conteúdo e relação com entidade quando aplicável. Decisões profissionais vinculadas devem ser únicas para evitar duplicidade operacional.

## Pendências

Crie pendências para ações rastreáveis. Resolva pendências somente quando a ação estiver concluída ou formalmente dispensada.

## Plano alimentar

- Consulte plano atual publicado.
- Edite apenas rascunhos.
- Publique após revisão.
- Arquive quando necessário.
- Use duplicação como rascunho para evoluir plano publicado sem alterar histórico.

## Feedback semanal

- Revise feedbacks pendentes.
- Analise aderência, contexto e pedido de suporte.
- Registre decisão profissional.
- Evite expor campos internos ao aluno.

## Decisões

Decisões devem registrar tipo, nota e responsável. A decisão vira parte do histórico operacional do aluno.

## Status

Atualize status de consulta somente quando o estado operacional do aluno mudar: novo, aguardando anamnese, em revisão, ativo, pausado ou encerrado.

## Build 6.6 — Admin Premium oficial

A entrada administrativa oficial do LM Premium passa a ser `/admin`, servida por `public/admin-premium-workspace.html`. As rotas `/admin.html` e `/admin-student.html` são compatibilidade temporária e direcionam o profissional para o Workspace. O Admin legado fica marcado como `Legacy Admin — rollback only` em `/admin-legacy.html`.

### Correção PR #276

O rollback real fica em `/admin-legacy.html` e preserva o Admin Hub legado operacional, com Command Center, Student 360, cadastro de aluno, autenticação e logout. A rota `/admin` é decidida por `PREMIUM_ADMIN_CUTOVER_ENABLED`: ligada abre o Workspace Premium; desligada abre o legado real. A Anamnese do Workspace aponta para a tela funcional existente `/admin-anamneses.html?student_id=...`, e o Student 360 permanece funcional em `/admin-student.html?student_id=...`.
