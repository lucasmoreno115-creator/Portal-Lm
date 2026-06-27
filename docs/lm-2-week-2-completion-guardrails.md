# LM 2.0 — Week 2 Completion Guardrails

## Princípio central

A Semana 2 ensina o aluno a usar o Plano B sem sentir que fracassou.

Transformação oficial da semana:

> Eu consigo continuar mesmo quando o dia sai do controle.

## Regra oficial de conclusão

A Semana 2 é concluída somente quando todos os requisitos forem verdadeiros:

1. Aula da Semana 2 assistida.
2. Reflexão da Semana 2 preenchida.
3. Resposta mínima preenchida.
4. `continuity_days_count >= 5` na Semana 2.

Os 5 dias não precisam ser consecutivos:

- `on_track` conta 1 ponto.
- `adapted` conta 1 ponto.
- `off_track` conta 0 ponto.

A regra não apaga check-ins, não reinicia progresso e não pune o aluno.

## Endpoint semanal

`GET /api/project-lm-2/week-status` retorna o status oficial da semana atual. Quando `current_week = 2`, o contrato usa os critérios da Semana 2:

```json
{
  "ok": true,
  "data": {
    "current_week": 2,
    "week_completed": true,
    "video_completed": true,
    "reflection_completed": true,
    "minimum_response_completed": true,
    "continuity_days_count": 5,
    "required_days_count": 5,
    "remaining_days": 0,
    "next_week_available": true
  }
}
```

## Home e transição

Enquanto a Semana 2 não estiver concluída, a Home mantém o fluxo atual:

- `week_2_video`
- `week_2_reflection`
- `week_2_minimum_response`
- `daily_checkin`

Quando todos os critérios forem cumpridos, a Home retorna:

- `next_action: "week_2_complete"`
- `next_action_label: "Continuar para Semana 3"`

A UI exibe uma celebração antes de mostrar o placeholder da Semana 3.

## Rotas adicionadas

- `week-2-complete`: celebra a conclusão da Semana 2.
- `week-3-placeholder`: tela “em breve” da Semana 3, sem conteúdo real.

## Ativação técnica da Semana 3

`POST /api/project-lm-2/activate-week-3` é um guardrail técnico:

- Só promove quando `current_week = 2`.
- Só promove quando a Semana 2 está concluída.
- É idempotente quando `current_week >= 3`.
- Não cria aula, vitórias, conteúdo ou dashboard da Semana 3.
