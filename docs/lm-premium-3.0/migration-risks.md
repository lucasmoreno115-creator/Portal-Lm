# Riscos de migração e recomendação Build 1

## O que pode quebrar no Build 1
- Login de alunos se `student_access` ou o redirecionamento por `plan` mudar sem compatibilidade.
- Projeto LM se rotas `/api/portal/project-lm/*` forem alteradas por engano ao mexer em Premium.
- Admin 360 se payloads de `student-360`, check-ins, planos ou timeline mudarem.
- Plano alimentar se o modelo `nutrition_plans` for modificado antes de estabilizar contrato.
- Check-ins/progressão se eventos de `activity_timeline` deixarem de ser gravados.
- Observabilidade se `operational_logs`/`endpoint_usage` perderem classificação por área.
- Regras MFit se a migração tentar modelar treino Premium dentro do Portal.

## Itens preserváveis
- Autenticação e acesso atuais como camada de compatibilidade inicial.
- Tabelas Premium ativas: `student_access`, `nutrition_plans`, `weekly_plans`, `student_checkins`, `progression_logs`, `activity_timeline`, `premium_anamnesis`.
- Páginas Premium existentes como referência funcional/contratual.
- Serviços de saúde, logs, endpoint usage e agregações existentes.
- Link MFit como integração externa simples.

## Candidatos à reconstrução
- Roteamento do Worker para módulos por domínio.
- Contratos formais de API Premium.
- Admin 360 em módulos/componentes menores.
- Camada de autorização com policies explícitas aluno/admin/produto.
- Namespaces Projeto LM fora de `/api/portal/*` mantendo aliases temporários.
- Documentação operacional centralizada.

## Atual vs LM Premium 3.0
### Já alinhado
- Premium não substitui profissional: sistema organiza check-ins, planos, follow-up e timeline.
- Plano alimentar existe como registro admin → aluno.
- Anamnese e acompanhamento existem.
- MFit permanece externo via link, sem tentativa de substituição.

### Diferente ou insuficiente
- Separação Premium/Projeto LM ainda não é física nem contratual.
- Backend mistura produtos.
- Segurança/autorização não está documentada como matriz de permissões.
- Payloads não têm schema formal.
- Operação admin é funcional, mas muito acoplada a HTML inline.

### Reaproveitável
- Banco Premium ativo.
- Fluxos aluno/admin existentes.
- Timeline, logs e command center como base.
- Testes de regressão existentes como inspiração para novos contratos Premium.

### Precisa evoluir/reconstruir
- Modularização da API.
- Contratos e DTOs.
- Separação de produto.
- Matriz de segurança.
- Testes Premium 3.0 antes de mudanças funcionais.

## Recomendação para Build 1
1. Congelar contratos atuais Premium em testes: login, me, plano alimentar, check-in, progressão, admin student-360, nutrition-plan, weekly-plan, anamneses.
2. Criar mapa declarativo de rotas sem alterar comportamento.
3. Introduzir camada documental/contratual de fronteira Premium x Projeto LM.
4. Não mexer em migrations nem tabelas no primeiro passo funcional.
5. Preservar aliases Projeto LM até existir plano de cutover.
6. Tratar MFit como boundary externa obrigatória.
