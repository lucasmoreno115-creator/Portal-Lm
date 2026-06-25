# Projeto LM V5 — View Models da Jornada

## Objetivo

Os View Models da Jornada V5 criam a camada oficial de apresentação do contrato técnico da jornada. Eles entregam textos, CTAs, labels e mensagens prontos para consumo futuro pelo frontend, sem criar telas, HTML, CSS, componentes ou qualquer UX nesta PR.

## Contrato técnico vs. contrato de apresentação

O contrato técnico continua estável e permanece responsável pela regra central da jornada:

- `journey`: identidade, status, etapa atual e timestamps da jornada.
- `progress`: percentual, etapas concluídas, etapas bloqueadas e `next_required_action`.
- `stages`: dados técnicos de cada etapa, itens e campos preenchidos.

O contrato de apresentação é o novo bloco `view_model`. Ele não substitui nem altera `journey`, `progress` ou `stages`; apenas traduz o estado técnico existente em mensagens oficiais para interface futura.

## Estrutura de `view_model`

```json
{
  "page_title": "Projeto LM",
  "page_subtitle": "Continue mesmo nos dias difíceis.",
  "status_label": "Jornada em andamento",
  "progress_label": "Você está no começo da jornada.",
  "primary_message": "Escolha 3 ações simples que você consegue fazer mesmo em dias difíceis.",
  "secondary_message": "Essas ações não precisam ser grandes. Elas precisam ser possíveis.",
  "primary_cta": {
    "label": "Escolher minhas 3 ações",
    "action": "open_stage_1_actions"
  },
  "secondary_cta": null,
  "stage_cards": [],
  "empty_state": null
}
```

## `status_label`

- `active`: `Jornada em andamento`
- `maintenance`: `Manutenção ativa`

## `progress_label`

- `0`: `Você está no começo da jornada.`
- `10–24`: `Você já iniciou sua base de continuidade.`
- `25–49`: `Você desbloqueou seu Plano B.`
- `50–74`: `Você está acumulando vitórias reais.`
- `75–99`: `Você está preparando seus protocolos de recuperação.`
- `100`: `Você concluiu a jornada e entrou em manutenção.`

## `primary_message`

A mensagem principal é derivada de `progress.next_required_action` e orienta a próxima ação oficial da jornada.

## `secondary_message`

A mensagem secundária também é derivada de `progress.next_required_action` e reforça o princípio comportamental por trás do próximo passo.

## `primary_cta`

O CTA principal é derivado de `progress.next_required_action` e sempre contém:

- `label`: texto oficial do botão/link futuro.
- `action`: identificador semântico para o frontend abrir o fluxo correto.

## `stage_cards`

`stage_cards` é gerado a partir de `stages` e contém um card lógico para:

- `stage_1`
- `stage_2`
- `stage_3`
- `stage_4`
- `maintenance`

Cada card contém `key`, `title`, `subtitle`, `status`, `status_label`, `progress_text`, `cta` e `empty_state`.

### Regra oficial de CTA por status

- Cards `locked` retornam `cta: null`.
- Cards `active` retornam o CTA correspondente da etapa.
- Cards `completed` retornam `cta: null`.

Essa regra evita que o frontend precise decidir se deve esconder botões operacionais de etapas bloqueadas ou concluídas.

### Pluralização de metas de manutenção

O `progress_text` do card `maintenance` usa pluralização oficial:

- `0 metas de manutenção`
- `1 meta de manutenção`
- `2 metas de manutenção`

## Empty states

Os estados vazios aparecem dentro dos respectivos cards quando aplicável:

- `stage_1` sem ações: `Você ainda não escolheu suas 3 ações mínimas.`
- `stage_3` sem vitórias: `Você ainda não registrou vitórias.`
- `maintenance` sem metas: `Você ainda não definiu metas de manutenção.`

## Sem frontend nesta PR

Esta PR não implementa frontend, telas, UX, HTML, CSS ou componentes. O trabalho se limita à camada oficial de payload de apresentação da Jornada Projeto LM V5.
