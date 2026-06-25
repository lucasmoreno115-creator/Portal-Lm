# Project LM V5 — contratos de API

## Objetivo

A API V5 da Jornada Projeto LM define contratos oficiais, estáveis e prontos para consumo futuro pelo frontend. Esta camada entrega o estado completo da jornada após leitura ou mutação, evitando que a interface precise recalcular progresso, status de etapas ou próxima ação obrigatória.

Esta PR não inclui frontend, telas, UX, HTML, CSS ou componentes.

## Padrão de resposta

Todas as respostas V5 seguem o envelope abaixo.

### Sucesso

```json
{
  "ok": true,
  "data": {}
}
```

### Erro

```json
{
  "ok": false,
  "error": "mensagem legível em português",
  "code": "ERROR_CODE"
}
```

## Contrato do GET `/api/project-lm/journey`

O endpoint retorna a jornada hidratada em três blocos: `journey`, `progress` e `stages`.

```json
{
  "ok": true,
  "data": {
    "journey": {
      "id": "...",
      "status": "active",
      "current_stage": 1,
      "created_at": "...",
      "updated_at": "...",
      "stage_2_unlocked_at": null,
      "stage_3_unlocked_at": null,
      "stage_4_unlocked_at": null,
      "maintenance_started_at": null
    },
    "progress": {
      "current_stage": 1,
      "status": "active",
      "percentage": 0,
      "completed_stages": [],
      "locked_stages": [2, 3, 4],
      "next_required_action": "choose_stage_1_actions"
    },
    "stages": {
      "stage_1": {
        "key": "stage_1",
        "title": "Escolha suas 3 ações mínimas",
        "status": "active",
        "required_count": 3,
        "completed_count": 0,
        "items": []
      },
      "stage_2": {
        "key": "stage_2",
        "title": "Construa seu Plano B",
        "status": "locked",
        "required_fields": ["emergency_meal", "minimum_workout", "minimum_movement", "minimum_self_care"],
        "completed_fields": [],
        "data": null
      },
      "stage_3": {
        "key": "stage_3",
        "title": "Registre 7 vitórias",
        "status": "locked",
        "required_count": 7,
        "completed_count": 0,
        "items": []
      },
      "stage_4": {
        "key": "stage_4",
        "title": "Prepare seus protocolos de recuperação",
        "status": "locked",
        "required_fields": ["overeating", "missed_workout", "travel", "difficult_week", "lack_of_motivation"],
        "completed_fields": [],
        "data": null
      },
      "maintenance": {
        "key": "maintenance",
        "title": "Manutenção",
        "status": "locked",
        "items": []
      }
    }
  }
}
```

Os POSTs V5 bem-sucedidos retornam o mesmo contrato completo do GET `/api/project-lm/journey`.

### `locked_stages`

`locked_stages` lista apenas etapas numéricas bloqueadas: `1`, `2`, `3` e `4`.

`maintenance` não entra em `locked_stages`. O estado de manutenção deve ser consultado exclusivamente em `stages.maintenance.status`.

## Status das etapas

Status oficiais: `locked`, `active`, `completed`.

- Stage 1: `active` quando `current_stage = 1`; `completed` quando `current_stage > 1`.
- Stage 2: `locked` quando `current_stage < 2`; `active` quando `current_stage = 2`; `completed` quando `current_stage > 2`.
- Stage 3: `locked` quando `current_stage < 3`; `active` quando `current_stage = 3`; `completed` quando `current_stage > 3`.
- Stage 4: `locked` quando `current_stage < 4`; `active` quando `current_stage = 4` e `status = active`; `completed` quando `status = maintenance`.
- Maintenance: `locked` quando `status != maintenance`; `active` quando `status = maintenance`.

## Progress percentage

Percentual oficial:

- Stage 1 ativa sem ações concluídas: `0`.
- Stage 1 com 1/3 ações concluídas: `10`.
- Stage 1 com 2/3 ações concluídas: `20`.
- Stage 2 desbloqueada: `25`.
- Stage 2 concluída: `50`.
- Stage 3 concluída: `75`.
- Maintenance: `100`.

Quando Stage 3 está em progresso, o percentual é calculado entre `50` e `75` conforme o número de vitórias registradas.

## `next_required_action`

Valores oficiais:

- `choose_stage_1_actions`
- `complete_stage_1_actions`
- `fill_plan_b`
- `record_victories`
- `fill_recovery_protocols`
- `maintenance`

Regras:

- Stage 1 sem ações: `choose_stage_1_actions`.
- Stage 1 com ações criadas: `complete_stage_1_actions`.
- Stage 2: `fill_plan_b`.
- Stage 3: `record_victories`.
- Stage 4: `fill_recovery_protocols`.
- Manutenção: `maintenance`.

## Códigos de erro

- `PROJECT_LM_ONLY`
- `STAGE_1_EXACTLY_3_ACTIONS`
- `STAGE_1_ACTION_TITLE_REQUIRED`
- `STAGE_1_ALREADY_CREATED`
- `STAGE_1_ALREADY_COMPLETED`
- `STAGE_1_ACTION_NOT_FOUND`
- `PLAN_B_STAGE_LOCKED`
- `PLAN_B_REQUIRED_FIELDS`
- `VICTORIES_STAGE_LOCKED`
- `VICTORY_DESCRIPTION_REQUIRED`
- `VICTORIES_LIMIT_REACHED`
- `RECOVERY_STAGE_LOCKED`
- `RECOVERY_REQUIRED_FIELDS`
- `MAINTENANCE_GOALS_LOCKED`
- `MAINTENANCE_GOAL_REQUIRED`
- `PROJECT_LM_V5_INTERNAL_ERROR`
