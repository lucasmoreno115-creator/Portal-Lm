# LM Premium 3.0 — 03 Domain Boundaries

## Objetivo
Este documento define as fronteiras oficiais de domínio com base no Build 0 e nas regras do LM Premium 3.0. Quando o sistema atual conflita com a fronteira desejada, o conflito é documentado e não resolvido neste Build.

---

## PLATAFORMA LM

### Responsável por
- Hospedar as superfícies digitais da marca LM.
- Direcionar aluno para o produto correto conforme acesso/plano existente.
- Manter entradas públicas e compatibilidade de navegação.
- Servir como camada técnica compartilhada quando ainda não houver separação física.
- Preservar autenticação de entrada enquanto existir contrato atual por email/token.

### Nunca responsável por
- Decidir prescrição nutricional.
- Tomar decisões clínicas.
- Substituir Lucas/profissional.
- Misturar regras de negócio de Premium e Projeto LM sem contrato explícito.
- Substituir MFit.

---

## CONSULTORIA PREMIUM

### Responsável por
- Apoiar a consultoria personalizada.
- Organizar anamnese, plano alimentar, plano semanal, check-ins, progressão, follow-up e timeline.
- Dar ao aluno acesso ao que Lucas registrou para ele.
- Dar ao admin/Lucas visão consolidada para análise e acompanhamento.
- Registrar histórico operacional do acompanhamento.
- Respeitar que as decisões principais são humanas.

### Nunca responsável por
- Automatizar prescrição clínica/nutricional sem decisão do profissional.
- Executar o processo no lugar do aluno.
- Substituir atendimento, análise ou acompanhamento humano.
- Ser fonte oficial de treino.
- Incorporar o modelo de treino do Projeto LM como treino Premium.
- Usar MFit como se fosse módulo interno do Portal.

---

## PROJETO LM

### Responsável por
- Produto automatizado para iniciar ou recomeçar emagrecimento.
- Jornada, onboarding, missões, ações diárias, biblioteca, semanas e check-ins próprios.
- Uso de rotas e tabelas `project_lm_*`, `lm2_*` e runtime público Projeto LM.
- Fluxos de aluno Projeto LM separados da Consultoria Premium.

### Nunca responsável por
- Representar consultoria personalizada.
- Criar plano alimentar Premium individualizado.
- Ler ou alterar dados Premium fora de contrato explícito.
- Usar telas admin Premium como parte da jornada automatizada.
- Definir treino oficial da Consultoria Premium.

---

## MFIT

### Responsável por
- Ser a fonte oficial dos treinos da Consultoria Premium.
- Hospedar/organizar a experiência de treino quando o aluno precisa acessar treinos.
- Manter o domínio externo de treino fora do Portal LM.

### Nunca responsável por
- Armazenar anamnese Premium dentro do Portal LM.
- Gerenciar plano alimentar do Portal LM.
- Gerenciar check-ins, progressão, follow-up ou timeline do Portal.
- Substituir o painel admin do Premium.
- Ser tratado como tabela ou módulo interno do Portal LM.

---

## Fluxos compartilhados permitidos
- Login por `portal-login.html` enquanto o contrato atual por `student_access.plan` existir.
- Uso compartilhado do Worker/D1 apenas como realidade técnica atual e com cuidado de regressão.
- Observabilidade compartilhada por área quando não expõe dados sensíveis nem mistura decisões de produto.
- Admin técnico pode visualizar saúde/logs de múltiplas áreas se isso for explicitamente operacional.

## Fluxos proibidos
- Premium consumir jornada do Projeto LM como substituto de consultoria.
- Projeto LM gravar ou alterar plano alimentar Premium.
- Premium assumir dados de treino `training_*` como treino oficial do aluno Premium.
- MFit ser substituído por telas de treino do Portal Premium.
- Alterar rotas Projeto LM durante migração Premium sem plano de compatibilidade.
- Misturar payloads Premium e Projeto LM sem contrato versionado.

## Dependências permitidas
- `student_access` como camada de compatibilidade inicial de login/produto.
- Link externo para MFit no portal do aluno.
- Serviços de observabilidade, logs e saúde desde que preservem separação por área.
- Reuso de infraestrutura estática/Worker até que Build futuro separe módulos com segurança.

## Dependências proibidas
- Dependência funcional do Premium em engines do Projeto LM.
- Dependência do Premium em tabelas `lm2_*` ou `project_lm_*`.
- Dependência do Projeto LM em telas `admin-*` ou `portal-plano-alimentar*`.
- Dependência do Premium em tabelas `training_*` para substituir MFit.
- Uso de rotas `/api/portal/project-lm/*` como padrão futuro sem decisão explícita.

## Conflitos entre estado atual e fronteira desejada
| Conflito | Estado atual | Fronteira desejada | Decisão neste Build |
|---|---|---|---|
| Login compartilhado | `portal-login.html` redireciona conforme `student_access.plan` | Entrada pode continuar compartilhada, mas contrato deve ser explícito | Documentar apenas |
| Worker compartilhado | Premium, Admin e Projeto LM no mesmo `workers/api.js` | Módulos por domínio no futuro | Documentar risco |
| Namespace misto | Rotas Projeto LM sob `/api/portal/project-lm/*` | Projeto LM fora do namespace Premium | Não renomear agora |
| Treinos | Projeto LM tem tabelas `training_*`; Premium aponta para MFit | Premium não deve usar `training_*` como treino oficial | Documentar boundary MFit |
| Admin legado | Rotas leads/metrics/alerts coexistem com admin Premium | Definir o que é core Premium antes de remover | Não remover |
