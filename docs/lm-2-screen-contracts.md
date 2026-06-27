# LM 2.0 — Screen Contracts

## Foundation Screen: Welcome

Required copy:

- Title: `Projeto LM 2.0`
- Subtitle: `Programa guiado de 30 dias para emagrecer sem recomeçar toda semana.`
- Primary CTA: `COMEÇAR`

## Prepared Internal Routes

The router prepares the following internal route keys for future screen contracts:

- `welcome`
- `onboarding`
- `home`
- `direction`
- `week-1`

## Current Behavior

The welcome screen is the only visible screen in this PR. Clicking `COMEÇAR` moves the hash to `#onboarding` and updates the root route marker, but it does not start the full journey yet.

## Week Unlock & Continuity Logic

### Home concluída

Quando `next_action = "week_1_complete"`, a Home exibe:

- `Parabéns.`
- `Você concluiu sua primeira semana.`
- CTA `CONTINUAR PARA SEMANA 2`, navegando para `week-complete`.

### `week-complete`

Tela de celebração intermediária da Semana 1. O CTA `IR PARA SEMANA 2` navega para `week-2-placeholder`.

### `week-2-placeholder`

Tela placeholder da Semana 2, com texto de etapa em breve e CTA `VOLTAR PARA HOME`.
