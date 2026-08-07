# S0.7 — coverage e custo dos recursos da Home Premium

Esta Sprint mede exclusivamente `/portal-premium-home.html` em `LAB_STUBBED`. É diagnóstica: **coverage não é prova de código removível** e `optimizationAuthorized` permanece `false`. Nenhuma recomendação deste relatório autoriza remoção, divisão, minificação, lazy loading ou mudança de cache; hipóteses dependem de experimento posterior.

## Método

O laboratório usa somente Node built-ins e Chrome DevTools Protocol. O servidor local entrega os arquivos existentes e contratos mínimos confirmados para acesso Premium, planejamento anulável e notificações. A pessoa do laboratório é inteiramente fictícia; não há D1, produção, credenciais, bodies ou headers nos artefatos. `WEEKLY_PLAN_ERROR` é um stub explícito com HTTP 200 e envelope de erro controlado, de modo que testa o estado funcional sem criar uma falha HTTP inesperada.

As APIs mínimas de Push são instaladas antes dos scripts da página: o estado padrão recebe `serviceWorker.ready` e `registration.pushManager.getSubscription()` controlados e conclui em `waiting`; no estado unsupported, `PushManager` é removido com `delete` e a ausência é verificada como precondição. Para `WEEKLY_PLAN_ERROR`, o fetch local ainda observa HTTP 200, mas a instrumentação rejeita exclusivamente a Promise do cliente após a resposta, exercitando o `catch` real sem transformar vazio em erro nem criar HTTP 4xx/5xx.

Cada estado é aceito somente após inspeção do DOM: URL e documento, visibilidade, `data-state`, `aria-busy`, dimensões e transições são comparados com o contrato. O estado observado nunca é copiado do solicitado. A interação completa exige alvo existente, visível e habilitado, abertura, fechamento e restauração de foco comprovados. Uma falha produz `NOT_OBSERVED` e impede `MEASURED`.

`Fetch.requestPaused` intercepta toda URL antes do envio e admite somente a origem exata `http://127.0.0.1:<porta-da-execução>`. Outra origem recebe `BlockedByClient`, é registrada de forma sanitizada e promove a execução e o relatório a `FAILED`; Network é evidência secundária.

A matriz cobre `HOME_DEFAULT`, instalação disponível, Push habilitado/bloqueado/indisponível, planejamento vazio/com erro e interação completa. A interação autorizada abre e fecha apenas controles locais do cartão PWA; não concede permissão, envia dados ou navega. COLD limpa cache/storage e ignora Service Worker; WARM preserva o cache do par. Mobile é 390×844 e desktop é controlado em 1440×900, sempre registrados separadamente.

Coverage começa antes da navegação. Ranges CDP são offsets em **unidades de código UTF-16**, não bytes. Ranges inválidos falham; ranges são limitados ao source length, ordenados e unidos quando sobrepostos ou adjacentes. Assim, funções aninhadas e regras CSS sobrepostas não contam uma unidade duas vezes. Ausência ou denominador zero resulta em `null`, nunca em zero inventado. O source completo nunca é persistido.

JavaScript precise coverage usa segmentos disjuntos e o range hierárquico mais específico, preservando filhos com `count: 0` dentro de pais executados. Ranges cruzados são inválidos. CSS mantém sua semântica própria de união de regras `used`; o algoritmo hierárquico de JavaScript não é aplicado ao CSS.

Transferência, corpo codificado/decodificado e source code units são unidades distintas e não são somadas. `TaskDuration`, `ScriptDuration`, layout, recálculo de estilo, heap, long tasks, FCP/LCP/CLS e totais de rede são globais da página. Em particular, `ScriptDuration` não é atribuído a arquivo algum. Scripts internos/eval/Chrome são classificados à parte e excluídos dos rankings do Portal.

Metadados de `Debugger.scriptParsed` distinguem `PORTAL_EXTERNAL`, `PORTAL_INLINE`, `LAB_INSTRUMENTATION`, `INTERNAL_CHROME` e `UNKNOWN`. A instrumentação recebe `sourceURL` fixo e nunca entra nos rankings. Frequências usam conjuntos de IDs `estado|cenário|viewport|run`, e não a quantidade de entradas CDP.

Cleanup só é confirmado após o sucesso real do comando correspondente. Falhas de CSS, DOM, Profiler, Debugger, Fetch, Network, target, Chrome ou servidor são preservadas e impedem `MEASURED`. O contrato global exige exatamente 96 combinações distintas e os oito estados como `OBSERVED`.

## Evidência e limitações

`STRONG_LAB` exige repetição em todas as runs aplicáveis, coverage válido e conclusão consistente nos cenários; `MODERATE_LAB` cobre evidência repetida mas condicional; `WEAK_LAB`, observação única/incompleta/instável; `UNKNOWN`, estado não executado, erro de infraestrutura ou comprimento desconhecido. Nenhuma classificação chama código não observado de morto. O LAB não substitui staging autenticado, diversidade real de dispositivos, dados reais ou CPU profiling por recurso.

O backlog P0–P3 é somente diagnóstico. A S0.8 poderá usar os rankings para formular experimentos, mas não é iniciada nem autorizada aqui.

## Execução local

Use Node 22 e Chrome estável. Se a descoberta automática não encontrar Chrome, defina `CHROME_BIN` com o caminho do executável.

```sh
npm ci
npm run coverage:portal-home:test
npm run coverage:portal-home
npm run coverage:portal-home:analyze
```

Os quatro relatórios ficam em `artifacts/performance/s0.7/`, diretório ignorado pelo Git. Percentuais baixos, recursos grandes e métricas globais altas não fazem a medição falhar; infraestrutura, estado obrigatório ausente, coverage inválido, request externo, HTTP inesperado, dado sensível ou cleanup incompleto fazem.
