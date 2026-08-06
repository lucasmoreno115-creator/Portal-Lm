# S0.5 — análise objetiva de performance do Portal

## Estado da baseline

A base de código da S0.5 é a `main` pós-S0.4 `a4c7e6e49a2f0c6df3a6ffb884934da156fe240a`. Uma execução de `pull_request` mede o merge ref da PR e **não é baseline oficial da main**. A baseline só pode ser chamada oficial depois de um `workflow_dispatch` verde em `refs/heads/main`; nesse caso, `canonicalMainSha` é preenchido. Os resultados reais de cada execução ficam nos quatro artefatos do workflow, não são copiados da S0.4 nem fixados neste documento.

## Proveniência

O relatório diferencia:

- `baseSha`: base da PR; em dispatch na main, o próprio checkout; localmente, `null`;
- `headSha`: head da PR ou ref selecionado; localmente, o checkout;
- `checkoutSha`: resultado exato de `git rev-parse HEAD` e código efetivamente medido;
- `workflowSha`: SHA informado pelo Actions, que em PR pode ser o merge ref;
- `canonicalMainSha`: preenchido somente em `workflow_dispatch` comprovado em `refs/heads/main`;
- `ref` e `eventName`: contexto explícito da execução.

O workflow compara `checkoutSha` com `git rev-parse HEAD`. Não há fallback para o antigo `source.sha`, SHA abreviado ou `NOT_EXECUTED`.

## Resultado real e rankings

O workflow dedicado executa smoke, cinquenta runs reais (cinco páginas × COLD/WARM × cinco runs) e análise. Ele exige status `MEASURED`, Home sem request falho, P0 vazio e cinco páginas nos rankings; caso contrário falha. Os valores reais, incluindo rankings por transferência, LCP, CLS e requests, e o ranking global agregado de recursos separado por cenário, são publicados em `portal-performance-analysis.json` e `portal-performance-analysis.md`. Isso evita apresentar números da S0.4 como se fossem uma nova medição.

## Evidência e limitações

- `STRONG_LAB`: recurso, request, erro ou cache observado diretamente e repetido.
- `MODERATE_LAB`: FCP, LCP ou CLS sintético repetível no Chrome controlado.
- `WEAK_PRODUCTION`: hipótese extrapolada do laboratório.
- `INSUFFICIENT`: dado ausente, incompleto ou contraditório.

P0 preserva integridade; P1 investiga experiência visual; P2 investiga custo de recursos; P3 depende de staging. Não existe score ou budget novo.

COLD desabilita/limpa cache; WARM observa reutilização no fluxo repetido. Ausência de long tasks não prova ausência em produção. Cache não é prioridade automática. Bytes locais não comprovam custo real porque LAB_STUBBED não mede autenticação, API, Worker/D1, CDN ou rede de produção. Um staging autenticado com identidade fictícia continua necessário.

## CLS e privacidade

Eventos de LayoutShift registram tempo, valor, `hadRecentInput`, retângulos e seletores limitados. O produtor e o analisador sanitizam os seletores. O relatório contabiliza eventos com e sem sources, sources aceitas e descartadas. `null` ou lista vazia permanece indisponibilidade explícita e não autoriza inferir causa. Texto, HTML, input, e-mail, token, nome e identificadores de aluno não são publicados.

## Decisão

A S0.5 melhora observação e prioriza investigações. **Nenhuma otimização de UI, CSS, JavaScript, API, imagem ou cache foi autorizada ou implementada.**
