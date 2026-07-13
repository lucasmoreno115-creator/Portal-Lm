# LM Premium 3.0 — 04 Build 0 Findings

## Objetivo
Este documento resume as dez descobertas mais importantes do Build 0 e traduz seu impacto operacional para o LM Premium 3.0. Ele não decide implementação; orienta o início seguro do Build 1.

## Descoberta 1 — Worker monolítico
**Descrição:** O Worker principal concentra rotas públicas, aluno Premium, admin, Projeto LM, bootstrap de schema e helpers.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** A migração deve ser incremental, protegida por contratos e testes antes de qualquer extração ou mudança funcional.

## Descoberta 2 — Premium e Projeto LM compartilham autenticação/entrada
**Descrição:** O login do aluno usa `student_access` e redireciona conforme plano/produto.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** Qualquer alteração em login ou acesso pode quebrar Premium e Projeto LM; Build 1 deve congelar o contrato atual antes de evoluir.

## Descoberta 3 — Existem namespaces cruzados
**Descrição:** Algumas rotas Projeto LM vivem sob `/api/portal/project-lm/*`, misturando namespace de Portal/Premium com produto automatizado.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** A fronteira deve ser documentada e protegida; renomeações só devem ocorrer com aliases e plano de compatibilidade.

## Descoberta 4 — O Premium já possui fluxo operacional essencial
**Descrição:** Existem telas e tabelas para acesso, anamnese, plano alimentar, plano semanal, check-ins, progressão, follow-up, timeline e admin 360.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** Muito pode ser preservado como referência funcional; a migração não deve partir de uma reconstrução cega.

## Descoberta 5 — O sistema organiza, mas não decide a consultoria
**Descrição:** A arquitetura atual registra e exibe dados; a prescrição, análise e acompanhamento continuam humanos.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** O produto deve reforçar o papel de apoio operacional, não automatizar decisões clínicas ou nutricionais.

## Descoberta 6 — MFit é uma boundary externa
**Descrição:** O Portal Premium apenas aponta para MFit; não há evidência de integração interna Premium de treino.

**Impacto:** P0.

**Consequência para o LM Premium 3.0:** Treino Premium não deve ser reconstruído no Portal; MFit permanece fonte oficial.

## Descoberta 7 — Banco Premium ativo é reaproveitável, mas acoplado
**Descrição:** Tabelas Premium como `student_access`, `nutrition_plans`, `weekly_plans`, `student_checkins`, `progression_logs`, `activity_timeline` e `premium_anamnesis` estão ativas, mas convivem com tabelas Projeto LM no mesmo D1.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** Build 1 deve evitar migrations e estabilizar contratos de leitura/escrita antes de alterar modelo.

## Descoberta 8 — Admin 360 é crítico e grande
**Descrição:** `admin-student.html` funciona como prontuário/visão consolidada e concentra muitas operações.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** Deve ser preservado como tela crítica, mas tratado como candidato futuro à modularização após testes de regressão.

## Descoberta 9 — Há código legado e duplicações
**Descrição:** Rotas de leads/metrics/alerts, `project_lm_profile` versus `project_lm_profiles`, páginas Projeto LM legadas e duplicação de helpers/queries aparecem no inventário.

**Impacto:** P2.

**Consequência para o LM Premium 3.0:** Nada deve ser removido no início; primeiro é necessário classificar dependências reais e compatibilidades.

## Descoberta 10 — Observabilidade existe e deve ser preservada
**Descrição:** Existem operational logs, endpoint usage, health check, command center e alertas.

**Impacto:** P1.

**Consequência para o LM Premium 3.0:** A migração deve manter ou fortalecer observabilidade para detectar regressões em Premium e Projeto LM.

## Novas descobertas operacionais do Build 0.5
- A consultoria pode ser descrita como ciclo: acesso → anamnese → análise humana → plano → execução → check-in/progressão → análise humana → ajuste/continuidade.
- As telas realmente críticas para Premium são menores que o conjunto total do repositório.
- A principal fronteira de produto não é apenas técnica; é operacional: Premium apoia Lucas, Projeto LM automatiza uma jornada e MFit mantém treinos.
- O maior risco do Build 1 é alterar uma peça compartilhada achando que pertence somente ao Premium.

## Conflitos encontrados
- O sistema atual usa infraestrutura compartilhada, mas o domínio desejado exige fronteiras explícitas.
- O Projeto LM tem rotas históricas em namespace do Portal.
- O Premium precisa de link/ponte para treino, mas não deve modelar treino oficial internamente.
- O admin mistura telas core Premium com rotas legadas de funil/diagnóstico.

## Perguntas em aberto para antes de Build 1 funcional
1. O login continuará único para Premium e Projeto LM ou haverá entradas separadas no futuro?
2. Quais rotas admin legado (`leads`, `metrics`, `alerts`) ainda são necessárias para operação real?
3. `portal-biblioteca.html` pertence ao Premium 3.0 ou deve ser reclassificada?
4. Quais campos de plano alimentar e plano semanal são contrato oficial e quais são detalhe de implementação atual?
5. Como documentar formalmente matriz de permissões aluno/admin sem alterar autenticação neste momento?

## Recomendação para início do Build 1
1. Criar testes de contrato para as telas críticas Premium.
2. Congelar payloads atuais antes de qualquer refatoração.
3. Definir mapa declarativo de rotas somente após proteger comportamento.
4. Separar mentalmente os domínios antes de separar fisicamente o código.
5. Manter MFit como boundary externa obrigatória.
6. Não criar migrations no primeiro Build funcional salvo decisão explícita posterior.
