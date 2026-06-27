# LM 2.0 — Week Unlock & Continuity Logic

## Regra oficial da Semana 1

A Semana 1 é concluída somente quando todos os critérios forem verdadeiros:

1. Aula da Semana 1 assistida (`video_completed = true`).
2. Plano B inicial criado (`plan_b_completed = true`).
3. Dias de continuidade maiores ou iguais a 5 (`continuity_days_count >= 5`).

Os 5 dias não precisam ser consecutivos. Check-ins com Plano A (`on_track`) contam 1 ponto. Check-ins com Plano B (`adapted`) contam 1 ponto. Check-ins `off_track` contam 0 ponto.

A regra não apaga check-ins, não reinicia progresso e não pune o aluno. Quando a meta ainda não foi atingida, a experiência apenas reconhece que a continuidade ainda está em construção.

## Endpoint criado

`GET /api/project-lm-2/week-status`

Retorna o status calculado da Semana 1:

```json
{
  "ok": true,
  "data": {
    "current_week": 1,
    "week_completed": true,
    "video_completed": true,
    "plan_b_completed": true,
    "continuity_days_count": 5,
    "required_days_count": 5,
    "remaining_days": 0,
    "next_week_available": true
  }
}
```

## Home

`GET /api/project-lm-2/home` agora inclui:

- `week_status`
- `week_completed`
- `next_week_available`
- `next_action_label`

Quando a Semana 1 é concluída, a Home retorna:

- `next_action: "week_1_complete"`
- `next_action_label: "Continuar para Semana 2"`

## Rotas de UI

- `week-complete`: celebra a conclusão da Semana 1 antes de avançar.
- `week-2-placeholder`: placeholder da Semana 2 em breve, sem implementação real da Semana 2.

## Fora de escopo preservado

Este PR não implementa Semana 2 real, aula da Semana 2, Plano B da Semana 2, Premium, Admin, dashboard, gamificação ou estatísticas complexas.
