# LM 2.0 — API Contracts

## Autenticação

Os endpoints LM 2.0 usam o padrão atual do aluno:

- `x-student-email`
- `x-student-token`

Não há novo sistema de autenticação neste incremento.

## POST `/api/project-lm-2/onboarding`

### Body

```json
{
  "name": "Lucas",
  "goal": "emagrecer",
  "sex": "male",
  "weight_kg": 87
}
```

### Validações

- `name`: obrigatório e não vazio.
- `goal`: obrigatório e não vazio.
- `sex`: obrigatório; valores aceitos: `male`, `female`.
- `weight_kg`: obrigatório, numérico, maior que 30 e menor que 250.
- `student_id`: derivado do aluno autenticado.

### Regras internas

Plano alimentar:

- Mulher até 69,9 kg: `M1`.
- Mulher de 70 a 89,9 kg: `M2`.
- Mulher com 90 kg ou mais: `M3`.
- Homem até 79,9 kg: `H1`.
- Homem de 80 a 99,9 kg: `H2`.
- Homem com 100 kg ou mais: `H3`.

Treino:

- `male`: `gym_male`.
- `female`: `gym_female`.

Os IDs internos podem ser persistidos, mas não devem ser exibidos em respostas visuais finais.

### Response 200

```json
{
  "ok": true,
  "data": {
    "name": "Lucas",
    "onboarding_completed": true,
    "current_week": 1,
    "continuity_days_count": 0,
    "required_days_count": 5,
    "next_action": "week_1_video",
    "nutrition_ready": true,
    "training_ready": true,
    "nutrition_label": "Seu plano alimentar está pronto.",
    "training_label": "Seu treino está pronto."
  }
}
```

## GET `/api/project-lm-2/home`

### Antes do onboarding

```json
{
  "ok": true,
  "data": {
    "onboarding_completed": false,
    "state": "onboarding_required",
    "next_action": "start_onboarding"
  }
}
```

### Após onboarding

Retorna a home mínima da Semana 1 com `next_action: "week_1_video"`, contadores de continuidade zerados, `required_days_count: 5`, `nutrition_ready: true` e `training_ready: true`.
