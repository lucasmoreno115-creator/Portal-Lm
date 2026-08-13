# F3.3.6 — auditoria dos required gates

## Baseline técnico

O relatório do head de F3.3.6 registrou exatamente três erros:

| Check | Esperado | Atual | Responsável | Diagnóstico |
| --- | ---: | ---: | --- | --- |
| `publicCssBytes` | no máximo 251.600 | 254.750 | as duas cópias públicas de `admin-premium-workspace.css` | 3.166 bytes pertencem aos estilos responsivos da nova fila; o parent já estava 704 bytes acima do teto histórico |
| `publicJavaScriptBytes` | no máximo 453.500 | 461.635 | as duas cópias públicas de `admin-premium-workspace.js` | 8.532 bytes pertencem à leitura, segurança de URL e estados da nova fila; o parent já estava 7.394 bytes acima do teto histórico |
| `requiredCommands` | `PASSED` | `FAILED` | `tests/lm-premium-minimal-workspace.test.mjs` | expectativa obsoleta ainda exigia o card removido “Check-ins em aberto” |

Os valores do parent foram medidos no commit `a0a926d`: 252.304 bytes de CSS e
460.894 bytes de JavaScript públicos. O aumento de F3.3.6 é multiplicado porque o
contrato de distribuição exige cópias byte-identical em `public/` e
`public/assets/`. O budget foi fechado nos valores observados do head, sem folga:
254.750 bytes de CSS e 461.635 bytes de JavaScript. Isso preserva a detecção de
qualquer aumento futuro e não muda thresholds da Home, requests ou performance.

## Agente QA LM

No artefato de CI, o único item `FAILED` foi `automated-test-suite` (`npm test`). O
primeiro erro funcional era `minimal Workspace exposes only validated operational
surface`: a suite ainda exigia `data-dashboard-card="checkins-open"` e o texto
“Check-ins em aberto”. Os dois `NOT_EXECUTED` eram opcionais. A correção atualiza
somente essa expectativa para o contrato aprovado de `pending-items-open`; nenhuma
asserção de segurança ou de carregamento foi removida.

## Portal performance baseline e S0.7

Ambos os workflows executam `npm test` antes de medir a Home. Portanto, o primeiro
erro era a mesma expectativa obsoleta do Workspace, não uma medição de performance
ou coverage. F3.3.6 não altera a Home pública, o contrato
`HOME_COLD_REQUEST_CONTRACT`, thresholds de performance, detecção de requests com
falha ou thresholds de coverage.
