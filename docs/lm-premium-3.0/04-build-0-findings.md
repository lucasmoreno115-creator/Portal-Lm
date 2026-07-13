# LM Premium 3.0 — 04 Build 0 Findings

## Objetivo
Este documento resume as descobertas do Build 0 e revisa sua consequência à luz do escopo futuro aprovado do LM Premium 3.0. Ele separa o que existe hoje no Portal do que deve orientar o novo núcleo Premium.

## Escopo futuro aprovado usado nesta revisão
O núcleo do LM Premium 3.0 inclui anamnese, plano alimentar, feedback semanal, gestão de pendências, Prontuário LM, Evolução do Acompanhamento, Workspace do profissional e Workspace do aluno.

Não fazem parte do novo núcleo: plano semanal, progressão de carga como core e follow-up como módulo independente. A Plataforma LM fica restrita a login, autenticação, controle de acesso e direcionamento ao produto correto.

## Descoberta 1 — Worker monolítico
**Descrição:** O Worker principal concentra rotas públicas, aluno Premium, admin, Projeto LM, bootstrap de schema e helpers.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** A migração deve ser incremental e protegida por contratos. A separação conceitual entre Plataforma LM, Premium, Projeto LM e MFit deve preceder qualquer separação física.

## Descoberta 2 — Plataforma LM está ampla demais no estado atual
**Descrição:** O estado atual usa a entrada do Portal para login, redirecionamento e acesso a fluxos que vão além da responsabilidade futura da Plataforma LM.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** A Plataforma LM deve ser documentada e tratada apenas como login, autenticação, controle de acesso e direcionamento ao produto correto.

## Descoberta 3 — Premium e Projeto LM compartilham autenticação/entrada
**Descrição:** O login do aluno usa `student_access` e redireciona conforme plano/produto.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** Qualquer alteração em login ou acesso pode quebrar Premium e Projeto LM; Build 1 deve congelar o contrato atual antes de evoluir.

## Descoberta 4 — Existem namespaces cruzados
**Descrição:** Algumas rotas Projeto LM vivem sob `/api/portal/project-lm/*`, misturando namespace de Portal/Premium com produto automatizado.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** A fronteira deve ser protegida; renomeações só devem ocorrer com aliases e plano de compatibilidade.

## Descoberta 5 — O Premium atual já tem insumos do core futuro
**Descrição:** Existem telas e tabelas para anamnese, plano alimentar, check-ins, histórico/timeline, alertas e Student 360.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** Esses insumos podem ser reaproveitados conceitualmente, mas devem ser reclassificados: check-ins viram feedback semanal, Student 360 vira Prontuário LM, timeline/históricos viram Evolução do Acompanhamento e alertas acionáveis viram pendências/condutas.

## Descoberta 6 — Nem tudo que existe hoje é core futuro
**Descrição:** Plano semanal, progressão e follow-up existem no Portal atual, mas não pertencem ao novo núcleo aprovado da forma como estão.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** Plano semanal deve ser tratado como fora do novo núcleo; progressão de carga é conveniência candidata à descontinuação; follow-up não deve permanecer como módulo independente e deve ser reinterpretado como pendências, condutas e Evolução do Acompanhamento.

## Descoberta 7 — O sistema organiza, mas não decide a consultoria
**Descrição:** A arquitetura atual registra e exibe dados; a prescrição, análise, conduta e acompanhamento continuam humanos.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** O produto deve reforçar o papel de apoio operacional ao Workspace do profissional e Workspace do aluno, sem automatizar decisões clínicas ou nutricionais.

## Descoberta 8 — MFit é uma boundary externa
**Descrição:** O Portal Premium aponta para MFit por link externo; não há evidência de integração interna Premium de treino.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** Treino Premium não deve ser reconstruído no Portal; MFit permanece fonte oficial.

## Descoberta 9 — Banco Premium ativo é reaproveitável, mas acoplado
**Descrição:** Tabelas Premium convivem com tabelas Projeto LM no mesmo D1 e há bootstrap de schema no Worker.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** Build 1 deve evitar migrations até congelar contratos de leitura/escrita e mapear quais tabelas atuais alimentam anamnese, plano alimentar, feedback semanal, pendências, Prontuário LM e Evolução do Acompanhamento.

## Descoberta 10 — Admin atual antecipa o Workspace do profissional, mas precisa reclassificação
**Descrição:** `admin-student.html`, admin de planos, check-ins, anamneses, alertas e command center formam um conjunto operacional, mas ainda com nomes e módulos do estado atual.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** O Workspace do profissional deve preservar o que é crítico, reclassificar Student 360 como Prontuário LM, check-ins como feedback semanal e follow-up/alertas como pendências/condutas.

## Descoberta 11 — Há código legado e duplicações
**Descrição:** Rotas de leads/metrics/alerts, `project_lm_profile` versus `project_lm_profiles`, páginas Projeto LM legadas e duplicação de helpers/queries aparecem no inventário.

**Impacto:** P2.

**Consequência para o LM Premium 3.0:** Nada deve ser removido no início; primeiro é necessário classificar dependências reais, compatibilidades e fronteiras de produto.

## Descoberta 12 — Observabilidade existe e deve ser preservada
**Descrição:** Existem operational logs, endpoint usage, health check, command center e alertas.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** A migração deve preservar observabilidade, mas alertas acionáveis do Premium devem ser interpretados como insumo de gestão de pendências, não como follow-up independente.

## Novas descobertas operacionais após revisão
- A diferença entre estado atual e escopo futuro precisa aparecer em todos os documentos para evitar que telas existentes sejam promovidas automaticamente a core.
- O core futuro é menor e mais conceitual que a estrutura atual: Workspace do aluno/profissional, Prontuário LM, feedback semanal, pendências e Evolução do Acompanhamento.
- Plano semanal era mencionado como preservável em documentos anteriores, mas deve ser reclassificado como fora do novo núcleo.
- Progressão/progressão de carga deve ser tratada como conveniência fora do core e candidata à descontinuação.
- Follow-up deve deixar de ser entendido como módulo independente e passar a ser representado por pendências, condutas e Evolução do Acompanhamento.

## Conflitos encontrados
- O sistema atual usa infraestrutura compartilhada, mas o domínio aprovado exige fronteiras explícitas.
- A Plataforma LM aparece ampla no estado atual, mas seu escopo futuro é restrito a login, auth, acesso e direcionamento.
- O Projeto LM tem rotas históricas em namespace do Portal.
- O Premium precisa de link/ponte para treino, mas não deve modelar treino oficial internamente.
- O admin mistura telas core futuras, módulos fora do core e rotas legadas de funil/diagnóstico.

## Perguntas em aberto para antes de Build 1 funcional
1. O login continuará fisicamente em `portal-login.html` ou será reposicionado como superfície explícita da Plataforma LM?
2. Quais dados atuais de `weekly_plans`, se algum, devem virar conduta, pendência ou Evolução do Acompanhamento?
3. A progressão atual deve ser descontinuada integralmente ou parte dos dados deve migrar para Evolução do Acompanhamento?
4. Quais rotas de follow-up/retention devem alimentar pendências e condutas no desenho futuro?
5. Quais rotas admin legado (`leads`, `metrics`, `alerts`) ainda são necessárias para operação real?
6. Quais campos de plano alimentar e feedback semanal são contrato oficial e quais são detalhe de implementação atual?
7. Como formalizar matriz de permissões aluno/profissional sem alterar autenticação neste momento?

## Recomendação para início do Build 1
1. Congelar contratos atuais antes de mudar comportamento.
2. Criar uma matriz de equivalência entre estado atual e escopo futuro aprovado.
3. Tratar Plataforma LM como camada de login, autenticação, acesso e direcionamento.
4. Mapear check-ins para feedback semanal sem alterar payloads inicialmente.
5. Mapear Student 360 para Prontuário LM sem trocar tela/rota inicialmente.
6. Mapear timeline/históricos para Evolução do Acompanhamento.
7. Mapear alertas/follow-up/retention para pendências e condutas, sem manter follow-up como módulo futuro.
8. Não promover plano semanal ao core Premium 3.0.
9. Não promover progressão de carga ao core Premium 3.0.
10. Manter MFit como boundary externa obrigatória.
