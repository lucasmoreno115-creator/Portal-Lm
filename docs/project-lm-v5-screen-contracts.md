# Project LM V5 — Screen Contracts

## Objetivo

A camada de Screen Contracts define os contratos oficiais para as telas futuras da Jornada Projeto LM V5. Ela descreve estrutura de telas, rotas internas, estados por tela, ações, formulários futuros e mapeamentos de fluxo sem implementar frontend visual.

## Relação com a state layer

`public/assets/js/project-lm-v5-screen-contracts.js` consome o formato de estado exposto por `ProjectLmV5State`:

```js
{
  journey,
  progress,
  stages,
  view_model,
  loading,
  saving,
  error,
  last_error_code
}
```

A camada não chama APIs, não altera regras de progressão e não modifica o contrato `{ journey, progress, stages, view_model }`. Ela apenas organiza esse estado em contratos de tela por meio de `buildScreenState` e `buildAllScreenStates`.

## Screens oficiais

- `journey_overview`
- `stage_1_actions`
- `stage_2_plan_b`
- `stage_3_victories`
- `stage_4_recovery`
- `maintenance_goals`

Cada screen define `key`, `title`, `subtitle`, `route`, `stage_key`, `required_status`, estados textuais, ações principais/secundárias e `form_contract` quando aplicável. `journey_overview.required_status = null`, porque a visão geral é sempre acessível e não depende do status da jornada.

## Rotas internas

| Screen | Rota |
| --- | --- |
| `journey_overview` | `#project-lm/journey` |
| `stage_1_actions` | `#project-lm/stage-1-actions` |
| `stage_2_plan_b` | `#project-lm/plan-b` |
| `stage_3_victories` | `#project-lm/victories` |
| `stage_4_recovery` | `#project-lm/recovery` |
| `maintenance_goals` | `#project-lm/maintenance-goals` |

## Stage → Screen

| Stage | Screen |
| --- | --- |
| `stage_1` | `stage_1_actions` |
| `stage_2` | `stage_2_plan_b` |
| `stage_3` | `stage_3_victories` |
| `stage_4` | `stage_4_recovery` |
| `maintenance` | `maintenance_goals` |

## Next Required Action → Screen

`progress.next_required_action` representa a próxima obrigação de progressão da jornada. Esse valor é diferente de `view_model.primary_cta.action`: o primeiro descreve a necessidade de progresso, enquanto o segundo descreve a intenção de navegação do CTA visual futuro.

| Next required action | Screen |
| --- | --- |
| `choose_stage_1_actions` | `stage_1_actions` |
| `complete_stage_1_actions` | `stage_1_actions` |
| `fill_plan_b` | `stage_2_plan_b` |
| `record_victories` | `stage_3_victories` |
| `fill_recovery_protocols` | `stage_4_recovery` |
| `maintenance` | `maintenance_goals` |

`getScreenForNextRequiredAction(nextRequiredAction)` retorna o contrato da screen correspondente ou `null` quando a action de progressão é desconhecida.

## CTA Action → Flow

`view_model.primary_cta.action` representa a ação de navegação sugerida pelo view model para uma interface futura. `getFlowForAction(action)` usa somente o mapa CTA Action → Flow e não interpreta `progress.next_required_action`.

| CTA action | Screen |
| --- | --- |
| `open_stage_1_actions` | `stage_1_actions` |
| `open_plan_b` | `stage_2_plan_b` |
| `open_victories` | `stage_3_victories` |
| `open_recovery_protocols` | `stage_4_recovery` |
| `open_maintenance_goals` | `maintenance_goals` |

`getFlowForAction(action)` retorna o contrato da screen correspondente ou `null` quando a CTA action é desconhecida.

## Ordem oficial da tela atual

A resolução da tela atual usada por `buildScreenState(...).is_current` segue esta ordem explícita:

1. `progress.next_required_action` via Next Required Action → Screen.
2. `view_model.primary_cta.action` via CTA Action → Flow.
3. Etapa ativa via Stage → Screen.

## `buildScreenState`

`buildScreenState(screenKey, journeyState)` transforma o state da Jornada V5 em um estado de tela:

```js
{
  key,
  route,
  title,
  subtitle,
  status,
  can_access,
  can_submit,
  is_current,
  message,
  primary_action,
  form_contract,
  source_stage
}
```

Regras principais:

- `loading = true` gera status `loading`.
- `error` presente gera status `error`.
- `journey_overview` é sempre acessível.
- stages `locked`, `active` e `completed` são refletidos no status da tela.
- `maintenance_goals` usa status `maintenance` quando a manutenção está ativa.
- `can_submit` é falso durante `loading` ou `saving`.
- `is_current` considera primeiro `progress.next_required_action`, depois `view_model.primary_cta.action` e, por último, a etapa ativa atual.

## Form contracts

Foram definidos contratos declarativos para formulários futuros, sem formulário real:

- `stage_1_actions`: três ações mínimas obrigatórias.
- `stage_2_plan_b`: `emergency_meal`, `minimum_workout`, `minimum_movement`, `minimum_self_care`.
- `stage_3_victories`: `description`.
- `stage_4_recovery`: `overeating`, `missed_workout`, `travel`, `difficult_week`, `lack_of_motivation`.
- `maintenance_goals`: `goal`.

Cada field possui `name`, `label`, `type`, `required` e `placeholder`.

## Action contracts

Actions oficiais declaradas:

- `createStage1Actions`
- `completeStage1Action`
- `savePlanB`
- `createVictory`
- `saveRecovery`
- `createMaintenanceGoal`

Cada action contract define `key`, `state_action`, `success_message` e `error_fallback`. Nenhuma action é executada por esta camada.

## Ausência explícita de frontend visual

Esta PR não cria telas reais, HTML, CSS, componentes, navegação real, event listeners, modais ou formulários reais. O arquivo de contratos não manipula DOM, não renderiza conteúdo e não chama APIs diretamente.
