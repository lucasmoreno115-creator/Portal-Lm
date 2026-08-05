# Baseline de performance do Portal do Aluno — S0.4

A S0.4 mede diagnóstico sintético local do Portal do Aluno em Chrome headless via Chrome DevTools Protocol (CDP). Ela não cria score, não aprova/reprova performance, não otimiza páginas e não altera budgets da S0.3.

## Ambientes

- `LAB_LOCAL`: medição offline com arquivos de `public/` e APIs locais reais quando não há stubs.
- `LAB_STUBBED`: medição offline com contratos mínimos confirmados no repositório para APIs usadas pelas páginas. Dados são fictícios, não representam produção e não usam conta real.
- `STAGING_AUTHENTICATED`: futuro ambiente autenticado controlado; não é usado nesta sprint.
- Produção: nunca é acessada pela infraestrutura S0.4 ou pelo workflow.

## Perfil sintético

O perfil versionado usa schema `1.0.0`, 5 runs, viewport mobile 390×844, `deviceScaleFactor` 2, rede com 150 ms de latência, 200000 B/s de download, 93750 B/s de upload e CPU 4× mais lenta. As páginas autorizadas são `/portal-login.html`, `/portal-premium-home.html`, `/portal-checkin.html`, `/portal-plano-alimentar.html` e `/portal-progressao.html`.

## COLD versus WARM

- `COLD`: cache desabilitado, storage limpo e Service Worker bypassado antes da navegação.
- `WARM`: cache permitido em target/sessão CDP isolado. Os resultados não são misturados com COLD.

Cada execução abre um target CDP próprio, registra listeners apenas durante a medição e fecha a sessão/target no `finally`, evitando acúmulo de handlers entre COLD, WARM e runs sucessivos.

## Status e códigos de saída

Cada run contém `completionStatus`, `errors`, `warnings`, `mainDocumentStatus`, `mainDocumentLoaded` e `externalRequestAttempted`.

- `MEASURED`: todas as cinco páginas, COLD/WARM e cinco runs por cenário foram medidas, documento principal 2xx, load event observado, sem request externo e contrato estrutural completo.
- `INCOMPLETE`: a navegação terminou com evidência parcial, como asset secundário falho ou API local 4xx/5xx. A CLI retorna 0 para preservar o relatório diagnóstico sem criar budget bloqueante.
- `FAILED`: infraestrutura, Chrome, servidor ou CDP falhou; documento principal não carregou; houve request externo proibido; página/cenário/run faltou; ou o relatório estrutural ficou inválido. A CLI retorna 1.

## Métricas e bytes

As métricas brutas não são arredondadas. `null` representa ausência real e nunca é convertido para zero. Mediana e p75 ignoram `null` deterministicamente.

Bytes são separados por semântica CDP:

- `transferBytes`: `Network.loadingFinished.encodedDataLength`, isto é bytes transferidos/encoded observados no fim do request.
- `encodedBodyBytes`: soma de `Network.dataReceived.encodedDataLength` quando o navegador disponibiliza essa métrica.
- `decodedBodyBytes`: soma de `Network.dataReceived.dataLength` quando observável.

`Network.getResponseBody` não é usado para medir tamanho porque mudaria custo, memória e comportamento da medição. LCP e CLS podem ficar `null` quando o navegador não produz entradas elegíveis antes da coleta, especialmente em páginas simples, redirects ou falhas parciais.

## Segurança e privacidade

O servidor escuta apenas em `127.0.0.1`, porta dinâmica, serve exclusivamente `public/`, bloqueia path traversal e registra somente URL sanitizada, status e bytes. O CDP bloqueia requests externos por padrão. O relatório não grava bodies, cookies, headers, Authorization, tokens, localStorage ou dados pessoais; o aluno usado é fictício.

## Execução local

```bash
npm ci
npm run performance:portal:test
npm run performance:portal:smoke
npm run performance:portal
```

Para indicar Chrome explicitamente:

```bash
CHROME_BIN=/usr/bin/google-chrome npm run performance:portal
```

`performance:portal:test` é determinístico e não exige Chrome. `performance:portal:smoke` é o smoke real obrigatório no workflow dedicado; se Chrome estiver ausente, falha explicitamente em vez de pular silenciosamente.

## Workflow dedicado

O workflow `portal-performance-baseline.yml` usa Node 22 e Chrome estável, executa `npm ci`, testes unitários determinísticos, smoke real e medição completa, e faz upload de `artifacts/performance/` com `if: always()`.

## Próximos passos para S0.5

A S0.5 poderá usar medianas, p75, requests falhos, cache observável e bytes por tipo para priorizar otimizações. A S0.4 ainda não possui budgets bloqueantes porque seu objetivo é estabilizar a medição e produzir evidência confiável antes de definir limites.
