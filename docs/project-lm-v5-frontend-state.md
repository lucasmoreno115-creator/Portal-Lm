# Projeto LM V5 — Frontend State Layer

## Objetivo

A camada `ProjectLmV5State` é a ponte JavaScript oficial entre as APIs da Jornada Projeto LM V5 e uma futura interface. Ela consome o contrato V5, mantém estado local, expõe actions e selectors, e trata loading/error sem criar tela, componente visual ou manipulação de DOM.

## Relação com os contratos V5

O state layer consome o contrato aprovado da Jornada V5 exatamente como retornado pelo backend:

- `journey`
- `progress`
- `stages`
- `view_model`

A camada não altera endpoints, regras de progressão, tabelas, migrations, códigos de erro, Premium ou fluxos legados. Respostas que não contenham todos os quatro blocos oficiais são tratadas como contrato inválido no frontend com `PROJECT_LM_V5_INVALID_CONTRACT`.

## State shape

```json
{
  "loading": false,
  "saving": false,
  "error": null,
  "last_error_code": null,
  "journey": null,
  "progress": null,
  "stages": null,
  "view_model": null,
  "last_updated_at": null
}
```

- `loading`: usado por `loadJourney()`.
- `saving`: usado por actions POST.
- `error`: mensagem legível para consumo futuro.
- `last_error_code`: código retornado pela API ou código defensivo do state layer.
- `journey`, `progress`, `stages`, `view_model`: contrato oficial V5 normalizado.
- `last_updated_at`: timestamp atualizado após sucesso.

## Actions disponíveis

- `loadJourney()`
- `createStage1Actions(actions)`
- `completeStage1Action(actionId)`
- `savePlanB(payload)`
- `createVictory(payload)`
- `saveRecovery(payload)`
- `createMaintenanceGoal(payload)`

Cada action limpa erro anterior, atualiza `loading` ou `saving`, chama o endpoint V5 correspondente, normaliza a resposta, atualiza o estado em sucesso, registra `error`/`last_error_code` em falha e notifica subscribers.

## Selectors disponíveis

- `selectors.getCurrentStage(state)`
- `selectors.getStatus(state)`
- `selectors.getProgressPercentage(state)`
- `selectors.getNextRequiredAction(state)`
- `selectors.getPrimaryCta(state)`
- `selectors.getStageCards(state)`
- `selectors.getActiveStageCard(state)`
- `selectors.isMaintenance(state)`
- `selectors.hasError(state)`
- `selectors.canSubmit(state)`
- `selectors.isLoading(state)`
- `selectors.isSaving(state)`

Selectors são puros: não chamam API, não alteram estado e não manipulam DOM.

## Padrão de erro

O helper HTTP interpreta erros `{ ok: false, error, code }` retornados pela API e os coloca em `error` e `last_error_code`. O state layer também define erros defensivos próprios:

- `PROJECT_LM_V5_INVALID_CONTRACT`: resposta sem `journey`, `progress`, `stages` ou `view_model`.
- `PROJECT_LM_V5_NETWORK_ERROR`: falha de rede ou `fetch` indisponível.
- `PROJECT_LM_V5_INVALID_JSON`: resposta não pôde ser interpretada como JSON.
- `PROJECT_LM_V5_ACTION_VALIDATION_ERROR`: action chamada sem payload mínimo obrigatório.

A validação de progressão continua exclusivamente no backend; a validação do state layer é apenas defensiva.

## Subscribe

`subscribe(listener)` registra um listener que recebe uma cópia segura do estado. A função retorna `unsubscribe()`. Erros lançados por listeners são protegidos para não quebrar outras notificações.

## Regra de não manipulação de DOM

`public/assets/js/project-lm-v5-state.js` não renderiza, não registra eventos visuais e não manipula DOM. A camada não usa `document.querySelector`, `innerHTML` ou `addEventListener`.

## Sem frontend nesta PR

Esta PR não cria frontend visual, telas, HTML, CSS, componentes, cards visuais, event listeners reais ou renderização. O trabalho se limita ao estado JavaScript isolado para consumo futuro do contrato V5.
