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
