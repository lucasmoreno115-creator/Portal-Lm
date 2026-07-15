# Release 3.0.0 — Feature flags

> Release 3.0.0: este documento é mantido como histórico da RC1 e referência operacional para a release oficial.


## Flags inventariadas
- `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED`: controla exposição visual/operacional do Workspace Profissional.
- `PREMIUM_NUTRITION_PLAN_WORKFLOW_ENABLED`: controla workflow Premium do Plano Alimentar.

## Validações RC1
- Flag desligada: páginas legadas e Projeto LM devem continuar disponíveis.
- Flag ligada: endpoints necessários devem continuar testáveis e protegidos por sessão.
- Rollback visual: desligar a flag deve ocultar fluxo novo sem apagar dados.
- Projeto LM: nenhuma flag Premium pode alterar rotas, dados ou telas exclusivas do Projeto LM.

## Evidência
`tests/lm-premium-rc1-feature-flags.test.mjs` valida inventário mínimo e script `scripts/verify-lm-premium-rc1.mjs` reporta flags ausentes.
