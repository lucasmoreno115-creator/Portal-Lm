# Jornada Projeto LM V5 — UI Skeleton

## Objetivo

A UI Skeleton cria a primeira superfície visual navegável da Jornada Projeto LM V5 para teste interno. Ela não representa design final, não adiciona polimento visual, não usa animações e não substitui nenhuma experiência Premium.

## Arquivos criados

- `public/project-lm-v5.html`: página HTML isolada da Jornada V5.
- `public/assets/js/project-lm-v5-app.js`: bootstrap, router hash e renderização mínima.
- `public/assets/css/project-lm-v5.css`: CSS mínimo do skeleton, isolado dos estilos existentes.
- `tests/project-lm-v5-app.test.mjs`: testes estáticos de integração, roteamento e isolamento.

## Relação com state layer e screen contracts

O app usa `ProjectLmV5State` para carregar e atualizar a jornada por meio de `loadJourney()` e das actions já aprovadas. A renderização das telas usa `ProjectLmV5ScreenContracts`, especialmente os contratos de tela, rotas, formulários e `buildScreenState()`.

## Renderização exclusiva por rota

A função `renderCurrentRoute()` decide qual bloco visual fica ativo:

- `#project-lm/journey`: renderiza apenas overview e cards relevantes da jornada.
- Rotas de etapa: renderizam apenas a tela correspondente.

O objetivo é evitar que overview e screen apareçam simultaneamente e reduzir ruído durante validação interna.

## Rotas hash

As rotas mínimas implementadas são:

- `#project-lm/journey`
- `#project-lm/stage-1-actions`
- `#project-lm/plan-b`
- `#project-lm/victories`
- `#project-lm/recovery`
- `#project-lm/maintenance`

Hash vazio ou desconhecido retorna para `#project-lm/journey`.

## Navegação baseada em contracts

A navegação prioriza os contratos oficiais:

- O CTA principal usa `view_model.primary_cta.action` com `ProjectLmV5ScreenContracts.getFlowForAction()`.
- A tela da próxima ação usa `progress.next_required_action` com `getScreenForNextRequiredAction()`.
- Cards da jornada não inferem navegação apenas por stage; cards bloqueados não navegam.

## Renderização mínima

A UI renderiza título, subtítulo, status, progresso, percentual, mensagem principal, próxima ação, CTA principal, cards relevantes e a tela atual baseada em `buildScreenState()`. Estados `loading`, `error`, `locked`, `active`, `completed` e `maintenance` são exibidos como mensagens simples.

## Simplificação da jornada

Na rota `#project-lm/journey`, a UI evita parecer um checklist completo. O skeleton prioriza etapa ativa, etapas concluídas e manutenção quando aplicável. Etapas futuras bloqueadas não são destacadas como navegáveis.

## Safe text rendering

O helper `safeText(node, value)` centraliza escrita textual com `textContent`, tratando `null`, `undefined` e conversão para string. Isso mantém a renderização básica preparada para evolução futura sem interpolar dados de API via HTML.

## Formulários placeholder

Cada `form_contract` gera campos básicos respeitando `name`, `label`, `type`, `required` e `placeholder`. O submit chama a action correspondente do state layer:

- `createStage1Actions`
- `savePlanB`
- `createVictory`
- `saveRecovery`
- `createMaintenanceGoal`

A tela de ações mínimas também lista ações existentes e permite chamar `completeStage1Action(action.id)`.

## Destroy e unsubscribe

O app armazena o retorno de `store.subscribe(render)` e expõe `window.ProjectLmV5App.destroy()`. O cleanup chama `unsubscribe()`, remove o listener de `hashchange` e limpa referências internas. Este ciclo de vida é simples e serve apenas como preparação para a UI definitiva.

## Preparação para UI definitiva

Esta PR mantém o skeleton sem componentes avançados, sem animações e sem design final. A separação de rota, o helper `safeText()` e o cleanup preparam a base para uma implementação visual posterior sem alterar contratos ou progressão.

## Escopo proibido

Esta UI não implementa dashboard Premium, Home Premium, fluxos Premium, endpoints Premium, backend, migrations, onboarding, marketing, missões semanais, streak, conquistas ou conteúdo semanal.

## Ausência de design final

O CSS é propositalmente mínimo e serve apenas para deixar o skeleton navegável e legível durante validação interna.

## Garantia de isolamento do Premium

A página HTML, o CSS e o JavaScript usam arquivos com prefixo `project-lm-v5`. Nenhum arquivo Premium é importado ou alterado pela UI Skeleton.

## V5-07 UI Foundation

### Objetivo visual da etapa

A V5-07 transforma o skeleton navegável da Jornada Projeto LM V5 em uma primeira experiência visual utilizável. O foco é layout, estrutura visual e usabilidade básica, sem alterar backend, migrations, endpoints, regras de progressão ou os contratos `{ journey, progress, stages, view_model }`.

### Identidade visual aplicada

A interface passa a usar um padrão LM mais definitivo: fundo escuro, contraste alto, cards com bordas suaves, tipografia clara e uso moderado de dourado. O marcador `◆` aparece como elemento discreto de direção visual, sem transformar a jornada em experiência gamificada.

### Estrutura do header

O header oficial exibe:

- `Projeto LM` como título principal.
- `Continue mesmo nos dias difíceis.` como subtítulo fixo da experiência.
- A mensagem principal de `state.view_model.primary_message`.
- O CTA principal vindo de `view_model.primary_cta.label`.

A ação do CTA continua respeitando o contrato aprovado: `view_model.primary_cta.action` é resolvida por `ProjectLmV5ScreenContracts.getFlowForAction()` antes da navegação.

### Progresso visual

O bloco de progresso usa `state.progress.percentage` como fonte principal do percentual. A UI renderiza percentual, barra estilizada, `view_model.progress_label` e a próxima ação em linguagem legível baseada em `progress.next_required_action`, sem recalcular progresso no frontend.

### Cards de etapa

Os cards oficiais de etapa são renderizados a partir de `view_model.stage_cards`. Cada card pode exibir título, subtítulo ou descrição, `status_label`, `progress_text` e `empty_state`, quando disponíveis. Os estados visuais tratados são:

- `active`: visual de ação atual e navegação habilitada quando houver fluxo resolvido pelos contracts.
- `completed`: visível para revisão, sem ação de navegação nesta etapa.
- `locked`: visível, com aparência não clicável.
- `maintenance`: visível quando vier no `view_model` e navegável quando houver tela correspondente.

### Telas de etapa

As telas continuam sendo derivadas por `ProjectLmV5ScreenContracts.buildScreenState()` e usam `screenState.source_stage`, `form_contract`, `state.view_model` e `state.stages` como fontes. A V5-07 melhora a apresentação de:

- `stage_1_actions`: lista ações existentes, permite concluir ação pendente e mantém o formulário de três ações quando o contrato permitir.
- `stage_2_plan_b`: renderiza o formulário estilizado do Plano B a partir do `form_contract`.
- `stage_3_victories`: mostra vitórias registradas e o formulário para nova vitória.
- `stage_4_recovery`: mostra protocolos registrados e o formulário de protocolos.
- `maintenance_goals`: mostra metas de manutenção e o formulário para nova meta.

### Estados visuais

A UI exibe mensagens específicas para carregamento, salvamento, erro com `state.error` e `state.last_error_code`, bloqueio, conclusão e manutenção ativa. As mensagens usam regiões com `aria-live` para feedback básico ao usuário.

### Formulários

Os formulários continuam gerados por `form_contract`, respeitando `name`, `label`, `type`, `required` e `placeholder`. Campos `textarea` são renderizados como áreas de texto, botões ficam desabilitados durante `saving` e a validação frontend se limita ao `required` básico do navegador. A validação de regra de negócio permanece no backend.

### Responsividade

A estrutura usa grid em desktop e passa para coluna única em tablet/mobile. Cards, navegação e botões ocupam largura confortável em telas menores, com alvos de toque maiores e leitura preservada.

### Limites do escopo

A V5-07 não adiciona novas regras de progressão, endpoints, migrations, onboarding, dashboard paralelo, biblioteca, missões semanais, streak, conquistas, animações avançadas ou gamificação. A navegação segue as rotas e flows já aprovados nos contracts.

### Premium preservado

A UI Foundation permanece isolada nos arquivos `project-lm-v5-*`. Nenhum arquivo, endpoint, fluxo, JavaScript ou CSS Premium é importado ou alterado por esta etapa.

## V5-08 Jornada UX Foundation

### Objetivo de UX

A V5-08 melhora a experiência de uso da Jornada Projeto LM V5 sem alterar contratos, endpoints, migrations, regras de progressão ou integração Premium. O foco passa a ser orientação, acessibilidade básica e redução de ambiguidade durante a navegação interna.

### Orientação da jornada

A visão geral passa a abrir com um bloco de orientação `Seu caminho agora`, explicando que a interface destaca apenas o passo atual, etapas já concluídas e manutenção quando disponível. Essa cópia evita transformar a jornada em checklist completo e mantém o foco na continuidade.

### Acessibilidade e navegação

A página inclui um skip link para o conteúdo principal, `main` com `id="plmv5-main-content"`, feedback via `aria-live` e foco programático no conteúdo quando a rota hash muda. Telas internas passam a exibir um link explícito de retorno para a visão geral.

### Labels humanos de status

Estados técnicos continuam vindo dos contracts, mas a UI traduz `active`, `completed`, `locked`, `maintenance`, `loading` e `error` para labels legíveis. Cards bloqueados e concluídos recebem hints específicos para reduzir cliques sem efeito e explicar por que a etapa está visível.

### Formulários mais claros

Os formulários continuam renderizados exclusivamente a partir de `form_contract`, mas a mensagem de apoio agora reforça que campos obrigatórios mantêm o plano simples e acionável. A validação segue limitada ao `required` nativo do navegador; regras de negócio permanecem no backend.

### Escopo preservado

A V5-08 não cria gamificação, missões, streak, conquistas, biblioteca, dashboard Premium, novos endpoints, novas migrations ou regras novas de progressão. A mudança permanece isolada em `project-lm-v5-*`.

## V5-09 Copy & Emotional UX

### Princípios de comunicação

A V5-09 transforma a Jornada Projeto LM V5 em uma experiência textual mais alinhada à metodologia LM. A proposta central é reforçar que o usuário não precisa de mais motivação, mas de direção para continuar com execução mínima, consistência e retorno rápido ao plano.

A comunicação evita pressionar o usuário a fazer mais. A interface passa a orientar o próximo passo, proteger a sensação de continuidade e reduzir a percepção de recomeço quando algo sai do planejado.

### Tom oficial

O tom oficial é humano, calmo, direto, sem exageros, sem hype e sem frases motivacionais vazias. A sensação desejada é: “Eu consigo continuar.”

As mensagens devem reforçar:

- continuidade;
- execução mínima;
- consistência;
- retorno rápido ao plano;
- preservação do que já foi construído.

### Mensagens de carregamento, salvamento e erro

A interface passa a usar mensagens oficiais da metodologia LM:

- Loading: “Preparando sua jornada. Organizando o próximo passo para você continuar.”
- Saving: “Registrando seu progresso.”
- Error: “Algo não saiu como esperado. Tente novamente em alguns instantes. Sua jornada continua segura.”

### Visão geral e progresso

A visão geral passa a se chamar “Seu próximo passo” e reforça que o foco não é fazer tudo, mas executar o próximo passo e continuar avançando.

O percentual de progresso continua vindo do contrato existente, sem novo cálculo no frontend, mas ganha apoio textual conforme a faixa:

- 0–24%: “Você está construindo sua base.”
- 25–49%: “Você já começou a criar consistência.”
- 50–74%: “Seu sistema está ficando mais forte.”
- 75–99%: “Você está perto de concluir sua jornada.”
- 100%: “Hora de proteger o que foi construído.”

Quando `view_model.primary_message` estiver vazio, a UI usa o fallback: “Pequenas ações repetidas vencem grandes planos abandonados.”

### Mensagens por etapa

A Etapa 1 apresenta “Defina suas ações mínimas.” e orienta o usuário a escolher ações simples o bastante para os dias difíceis. O empty state oficial é: “Você ainda não definiu suas ações mínimas.”

A Etapa 2 explica que o Plano B existe para os dias em que o Plano A não for possível e reforça que continuar parcialmente é melhor do que recomeçar.

A Etapa 3 reforça que resultados grandes são construídos por pequenas vitórias acumuladas. O empty state orienta o usuário a registrar qualquer avanço que mostre continuidade.

A Etapa 4 explica que errar o plano não encerra a jornada e que o importante é saber como voltar rapidamente.

### Mensagens de manutenção

Quando o status da tela for `maintenance`, a UI exibe um destaque visual com:

- Título: “Jornada concluída.”
- Subtítulo: “Agora o objetivo é proteger o que você construiu.”
- Mensagem: “Você não precisa voltar ao início. Você já possui um sistema para continuar mesmo quando a rotina apertar.”

Essa tela é tratada como a principal superfície emocional da V5-09, pois comunica que a jornada não exige recomeço após a conclusão.

### Mensagens de bloqueio e conclusão

Estados bloqueados deixam de gerar urgência e passam a dizer: “Você ainda não precisa se preocupar com esta etapa. Concentre-se apenas no passo atual.”

Estados concluídos passam a dizer: “Esta etapa já faz parte da sua base. Quando precisar, ela continuará disponível para consulta.”

### Feedbacks de sucesso

Após salvar formulários, a UI mostra temporariamente: “Salvo com sucesso. Mais um passo construído.”

Após concluir uma ação mínima, a UI mostra: “Ação concluída. Continuar conta mais do que perfeição.”

Após registrar uma vitória, a UI mostra: “Vitória registrada. Reconhecer o progresso ajuda a sustentar o processo.”

### Formulários e empty states

A mensagem auxiliar dos formulários passa a ser: “Mantenha simples. A melhor estratégia é aquela que você consegue executar.”

Empty states devem evitar culpa, urgência e pressão. Eles devem indicar que ainda não há registro e orientar o usuário a voltar quando houver algo que mostre continuidade.

### Palavras proibidas

A copy oficial da Jornada V5 não deve usar: desafio, missão, streak, sequência, pontuação, ranking, recompensa, conquista, nível, desbloqueio gamificado ou performance.

### Escopo preservado

A V5-09 não altera backend, APIs, progressão, state layer, contracts, migrations ou Premium. As mudanças permanecem restritas à UX textual, feedbacks visuais leves e documentação.

## V5-10 Final UX Polish

### Pergunta norteadora

A V5-10 usa como critério principal: “Isso ajuda o aluno a continuar sem precisar pensar demais?”. Elementos que competiam com a próxima ação foram reduzidos para que a visão geral pareça direção e continuidade, não dashboard, checklist, curso ou área administrativa.

### Redução de carga cognitiva

A hierarquia visual passa a priorizar:

1. Próxima ação.
2. CTA principal vindo de `view_model.primary_cta`.
3. Progresso e apoio textual.
4. Demais elementos de contexto.

A visão geral deixa de duplicar blocos de mensagem e usa menos caixas simultâneas. Empty states e hints visuais ficam menores para informar sem competir com a ação principal.

### Ocultação de etapas futuras

A lista de cards deixa de exibir toda a jornada por padrão. A UI mostra a etapa atual, etapas já concluídas e apenas a próxima etapa bloqueada. Etapas futuras permanecem ocultas até serem relevantes, reduzindo a sensação de jornada longa.

Quando a manutenção está ativa ou disponível como status de manutenção, a UI pode exibir todos os cards relevantes para preservar a continuidade pós-conclusão.

### Simplificação da navegação

A sidebar foi reduzida à navegação essencial:

- Visão geral.
- Próxima ação, quando existir uma tela resolvida pelos contracts.

Os cards de etapa deixam a sidebar e passam a aparecer no conteúdo da visão geral, como apoio contextual e não como menu exploratório.

### Foco na próxima ação

O header passa a destacar “Seu próximo passo” como título principal, deixando “Projeto LM” em menor hierarquia. O CTA principal ganha mais presença visual e continua usando exclusivamente `view_model.primary_cta.label` e `view_model.primary_cta.action`, resolvidos por `ProjectLmV5ScreenContracts.getFlowForAction()`.

### Progresso compacto

O percentual, a barra e o progress support são mantidos, mas o bloco ocupa menos espaço e não compete com o CTA principal. O progresso permanece informativo, sem recalcular regras no frontend.

### Refinamentos mobile

A V5-10 reduz padding inicial, simplifica o layout em coluna única, mantém o CTA em largura total e prioriza header, próxima ação e CTA acima do restante do conteúdo em larguras pequenas como 320px, 375px, 390px e 414px.

### Maintenance refinado

A manutenção mantém a copy oficial:

- “Jornada concluída.”
- “Agora o objetivo é proteger o que você construiu.”
- “Você não precisa voltar ao início. Você já possui um sistema para continuar mesmo quando a rotina apertar.”

O bloco visual recebe um tratamento próprio de continuidade para comunicar sustentação do que foi construído, não fim do programa.

### Escopo preservado

A V5-10 não altera APIs, backend, migrations, state layer, contracts, regras de progressão, Premium ou copy oficial V5-09. Também não cria gamificação, biblioteca, missões, streak, conquistas ou dashboards.

## V5-11 Real User Flow Validation

### Objetivo

A validação V5-11 executa a Jornada Projeto LM V5 como um usuário real: onboarding já concluído, visão geral, Etapa 1, Etapa 2, Etapa 3, Etapa 4 e Maintenance. O escopo permanece restrito à validação e correção de inconsistências entre API, state layer, screen contracts, UI, rotas hash e progressão, sem criar funcionalidades, alterar design, mudar copy oficial ou modificar contratos públicos.

### Cenários testados

- Etapa 1 vazia, parcial e completa, incluindo formulário de três ações, conclusão individual e desbloqueio da Etapa 2.
- Etapa 2 com Plano B vazio, parcial e completo, incluindo salvamento, recarregamento lógico por `loadJourney()` e persistência do payload retornado pela API.
- Etapa 3 com 0, 1, 6, 7 e 8+ vitórias, confirmando que a Etapa 4 só fica acessível a partir de 7 vitórias.
- Etapa 4 com protocolos incompletos e completos, confirmando liberação da manutenção apenas após os protocolos de excesso alimentar, falta de treino, viagem, semana difícil e falta de motivação.
- Maintenance com status `maintenance`, progresso final, cards e CTA coerentes com `next_required_action: maintenance`.
- Refresh lógico em overview, Etapa 1, Etapa 2, Etapa 3, Etapa 4 e Maintenance, preservando hash válido e reconstruindo tela a partir do state restaurado.
- Rotas hash oficiais: `#project-lm/journey`, `#project-lm/stage-1-actions`, `#project-lm/plan-b`, `#project-lm/victories`, `#project-lm/recovery` e `#project-lm/maintenance`.
- Falhas de API 400, 404, 409 e 500, garantindo `state.error`, `last_error_code`, mensagem de erro de UX e continuidade do app.
- Duplo submit nas ações críticas: criar ações, concluir ação, criar vitória, salvar Plano B e salvar protocolo.

### Edge cases cobertos

- Hash desconhecido volta para `#project-lm/journey`.
- `buildScreenState()` mantém estrutura válida para todas as screen keys oficiais.
- Telas bloqueadas não aceitam submit.
- Loading e saving desabilitam submit.
- Resposta sem `code` da API passa a preservar status HTTP como `HTTP_<status>`.
- Salvamento concorrente no state layer é recusado antes de emitir segundo POST.

### Falhas corrigidas

- A rota pública de Maintenance estava divergente do fluxo validado: a UI e os contratos apontavam para `#project-lm/maintenance-goals`, enquanto a jornada validada usa `#project-lm/maintenance`.
- Falhas HTTP sem `payload.code` perdiam o código operacional em `last_error_code`, dificultando validação de 400, 404, 409 e 500.
- Submits múltiplos muito rápidos podiam disparar chamadas duplicadas antes da próxima renderização desabilitar os controles.

### Limitações conhecidas

- A validação é automatizada em nível de contrato, state layer e integração estática/VM da UI. Ela não substitui um teste E2E com navegador real autenticado contra backend de staging.
- A persistência é validada pelo contrato retornado por `loadJourney()` após salvamento; a regra definitiva de armazenamento continua pertencendo ao backend.
- A UI não recalcula progresso no frontend; percentuais, status e `next_required_action` continuam vindo da API e do screen contract.

## V5-12 Beta Readiness & Production Hardening

A camada V5-12 prepara a Jornada Projeto LM V5 para operação com usuários reais sem alterar UX, copy, progressão, contratos visíveis ou componentes.

### Telemetria

A telemetria usa o namespace isolado `project_lm_v5`. Os eventos carregam `student_id`, `journey_status`, `current_stage` e `timestamp` sempre que esses dados estão disponíveis no estado local.

Eventos de carregamento e visualização:

- `journey_loaded`
- `stage_1_viewed`
- `stage_2_viewed`
- `stage_3_viewed`
- `stage_4_viewed`
- `maintenance_viewed`

Eventos de conclusão:

- `stage_1_completed`
- `stage_2_completed`
- `stage_3_completed`
- `stage_4_completed`
- `journey_completed`

Eventos de funil:

- `entered_stage_1`
- `entered_stage_2`
- `entered_stage_3`
- `entered_stage_4`
- `entered_maintenance`

### Observabilidade e métricas

A métrica `journey_load_time` mede `request_start`, `request_end` e `duration_ms` para identificar lentidão no carregamento inicial da jornada.

Falhas de API emitem `api_error` com `endpoint`, `status_code`, `error_code` e `timestamp`. Exceções não tratadas do cliente emitem `unexpected_client_error` a partir de `error` e `unhandledrejection`.

Chamadas travadas são abortadas defensivamente após 12 segundos e registradas como `PROJECT_LM_V5_REQUEST_TIMEOUT`, mantendo a UI em estado recuperável em vez de deixar carregamentos ou salvamentos pendurados.

### Diagnósticos internos

O helper interno `getJourneyDiagnostics()` expõe apenas dados de suporte e debug, sem renderização para o usuário:

- `route`
- `current_stage`
- `journey_status`
- `next_required_action`
- `loading`
- `saving`
- `last_error_code`

### Validação defensiva de contrato

A camada de estado valida defensivamente `current_stage` e `status`. Valores inesperados geram `contract_warning` e `console.warn`, mas não impedem que dados renderizáveis sejam aplicados ao estado. A estratégia evita tela quebrada por divergências parciais do backend.

### Fallback strategy de rota

Hashes vazios, parciais, inválidos ou malformados retornam para `#project-lm/journey`. A normalização é invisível para o usuário e mantém o roteador dentro das rotas oficiais da Jornada V5.

Carregamentos concorrentes de jornada são bloqueados com `PROJECT_LM_V5_LOAD_IN_PROGRESS`, assim como salvamentos concorrentes já são bloqueados com `PROJECT_LM_V5_SAVE_IN_PROGRESS`. Isso reduz duplicidade de requests durante boot, refresh lógico ou cliques rápidos sem alterar contratos visíveis.

### Limitações

- Esta PR não cria dashboard, tela admin, relatório, gráfico ou métrica visível.
- A coleta depende de um sink externo opcional em `ProjectLmV5Telemetry`, função `onTelemetry`/`telemetry` injetada ou evento browser `project_lm_v5:telemetry`.
- A validação defensiva registra warnings para suporte, mas não bloqueia respostas parcialmente renderizáveis.

## V5-13A — Emotional Copy Layer

A V5-13A ajusta somente a camada de copy visível da Jornada Projeto LM V5 para reforçar a promessa central: “Você não precisa de mais motivação. Precisa de direção.” O objetivo é deixar a experiência menos parecida com dashboard/checklist e mais próxima de uma jornada guiada para começar e continuar mesmo nos dias difíceis.

### Promessa e hero

- Título principal: “Projeto LM”.
- Subtítulo de promessa: “Você não precisa de mais motivação. Precisa de direção.”
- Mensagem central: “Você não precisa começar de novo. Precisa continuar. Nos próximos 30 dias vamos construir uma direção que funcione até nos dias difíceis.”
- CTA visual principal: “CONTINUAR MINHA JORNADA”.

### Direção e continuidade

A visão geral passa a reforçar “Sua Direção” e “Seu Próximo Passo”, com a orientação: “Siga um passo de cada vez. Não é necessário fazer tudo.” A UI mantém os mesmos contratos e ações de navegação, alterando apenas os textos renderizados.

### Etapas e estados vazios

- `stage_1`: “MISSÃO DA SEMANA — Pare de Recomeçar”, com foco em provar continuidade, não perfeição.
- `stage_2`: “Plano B — Dias Difíceis”, com estado vazio sobre preparar a resposta antes dos dias difíceis chegarem.
- `stage_3`: “Vitórias da Jornada”, com estado vazio sobre registrar a primeira pequena vitória.
- `stage_4`: “Voltar para a Direção”, reforçando que sair do plano faz parte e voltar faz diferença.
- `maintenance`: “Sua Evolução”, conectada a pequenos avanços acumulados.

### Conclusão da jornada

A mensagem de conclusão passa a ser: “Você provou que consegue continuar. Agora o desafio não é começar. É manter a direção construída.”

Nenhum endpoint, schema, rota, regra Premium/Admin ou contrato V5 estrutural foi alterado nesta camada.
