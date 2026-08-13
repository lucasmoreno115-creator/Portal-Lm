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

## Portal performance baseline S0.6

O resultado do workflow separa a falha de performance da falha operacional:
`Measure S0.6 after` e `Compare S0.6` concluíram, enquanto a validação parou em
`BEFORE_MEASUREMENT_FAILED`. Logo, não há comparação before/after válida nem
evidência de regressão causada pela F3.3.6.

O primeiro defeito operacional no step `Measure immutable S0.6 before` estava no
harness: o worktree fixado em `9fcbc86` executava o coletor histórico S0.5 daquele
commit, enquanto o after executava o coletor S0.6 atual. Assim, as duas metades
usavam implementações diferentes de fixture, instrumentação e lifecycle
Chrome/CDP. Isso deixava o before sujeito ao comportamento obsoleto do coletor — e
não media somente a diferença entre os assets imutáveis.

O worktree continua fixado em `9fcbc86` e conserva seu diretório `public/`, mas
agora recebe os `scripts/` e o profile de performance do checkout atual. Before e
after passam, portanto, pelo mesmo harness S0.6 e pela mesma versão de Chrome; só
os assets comparados diferem. O teste do workflow proíbe copiar `public/` do head
para o before.

Nenhum threshold de performance, regression budget,
`HOME_COLD_REQUEST_CONTRACT`, métrica ou critério de comparação foi alterado.

## Portal Home resource coverage S0.7

O S0.7 executa `npm test` antes da coleta e compartilhava a expectativa obsoleta
do Workspace descrita acima. F3.3.6 não altera a Home pública nem thresholds de
coverage.
