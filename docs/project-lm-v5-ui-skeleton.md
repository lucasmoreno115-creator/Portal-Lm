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
- `#project-lm/maintenance-goals`

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
