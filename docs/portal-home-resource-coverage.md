# S0.7 — coverage e custo dos recursos da Home Premium

Esta Sprint mede exclusivamente `/portal-premium-home.html` em `LAB_STUBBED`. É diagnóstica: **coverage não é prova de código removível** e `optimizationAuthorized` permanece `false`. Nenhuma recomendação deste relatório autoriza remoção, divisão, minificação, lazy loading ou mudança de cache; hipóteses dependem de experimento posterior.

## Método

O laboratório usa somente Node built-ins e Chrome DevTools Protocol. O servidor local entrega os arquivos existentes e contratos mínimos confirmados para acesso Premium, planejamento anulável e notificações. A pessoa do laboratório é inteiramente fictícia; não há D1, produção, credenciais, bodies ou headers nos artefatos. `WEEKLY_PLAN_ERROR` é um stub explícito com HTTP 200 e envelope de erro controlado, de modo que testa o estado funcional sem criar uma falha HTTP inesperada.

A matriz cobre `HOME_DEFAULT`, instalação disponível, Push habilitado/bloqueado/indisponível, planejamento vazio/com erro e interação completa. A interação autorizada abre e fecha apenas controles locais do cartão PWA; não concede permissão, envia dados ou navega. COLD limpa cache/storage e ignora Service Worker; WARM preserva o cache do par. Mobile é 390×844 e desktop é controlado em 1440×900, sempre registrados separadamente.

Coverage começa antes da navegação. Ranges CDP são offsets em **unidades de código UTF-16**, não bytes. Ranges inválidos falham; ranges são limitados ao source length, ordenados e unidos quando sobrepostos ou adjacentes. Assim, funções aninhadas e regras CSS sobrepostas não contam uma unidade duas vezes. Ausência ou denominador zero resulta em `null`, nunca em zero inventado. O source completo nunca é persistido.

Transferência, corpo codificado/decodificado e source code units são unidades distintas e não são somadas. `TaskDuration`, `ScriptDuration`, layout, recálculo de estilo, heap, long tasks, FCP/LCP/CLS e totais de rede são globais da página. Em particular, `ScriptDuration` não é atribuído a arquivo algum. Scripts internos/eval/Chrome são classificados à parte e excluídos dos rankings do Portal.

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
