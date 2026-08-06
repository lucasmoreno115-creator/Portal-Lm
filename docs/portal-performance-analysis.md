# S0.5 — análise objetiva de performance do Portal

## Baseline oficial

A S0.5 parte da `main` pós-merge `a4c7e6e49a2f0c6df3a6ffb884934da156fe240a`. O artefato aprovado anterior foi executado no merge ref `04741d6d7a1848e11afecee2f132fa92283ff1a5`; ele é evidência da PR, não o SHA canônico da `main`. O relatório agora distingue `repositorySha`, `workflowSha`, `measuredSha`, `ref` e `eventName`, inclusive para `pull_request`, `workflow_dispatch` e execução local.

A observação aprovada tinha cinco páginas e cinco runs por cenário COLD/WARM. A Home estava `INCOMPLETE` devido ao 404 de `GET /api/portal/notifications/unread-count`. O contrato real retorna `{ ok: true, data: { count: número } }`; o LAB_STUBBED usa `count: 0`, sem identidade pessoal. Uma nova execução pode produzir valores diferentes.

## Validade e limitações

O analisador exige cinco páginas, dez cenários e cinquenta runs, métricas brutas, agregações, recursos, requests falhos e estados coerentes. Métrica opcional `null` não invalida a baseline. LAB_STUBBED mede um Chrome e servidor controlados: não mede autenticação, API, Worker/D1, rede ou cache de produção. Tamanho transferido local não prova custo em produção.

`COLD` desabilita/limpa cache e `WARM` observa reutilização no fluxo repetido. A diferença é evidência laboratorial, não um budget. Como os runs observados não indicaram long tasks, não há gargalo confirmado nessa categoria. Cache também não é prioridade automática: a diferença COLD/WARM já demonstra reutilização, enquanto impacto real depende de staging.

## Evidência e prioridade

* `STRONG_LAB`: recurso, request, erro ou cache observado diretamente e repetido.
* `MODERATE_LAB`: FCP, LCP ou CLS sintético repetível no Chrome controlado.
* `WEAK_PRODUCTION`: hipótese extrapolada do laboratório.
* `INSUFFICIENT`: dado ausente, incompleto ou contraditório.

P0 preserva integridade da medição; P1 investiga experiência visual repetível; P2 investiga custo observado de recursos; P3 reúne hipóteses que exigem staging. Não existe score 0–100 nem limiar convertido em budget.

O CLS COLD da Home foi repetível na baseline aprovada. A instrumentação registra eventos e retângulos com seletores sanitizados, nunca texto, inputs ou HTML. Quando `sources` não é exposto pelo navegador, registra `null` e não atribui causa. Coverage CSS/JS ficou como próximo experimento: representa apenas o fluxo executado e não autoriza remoção.

## Decisão

É necessário um experimento futuro em staging autenticado, usando identidade fictícia, para latência real, autenticação e Worker/D1. A S0.5 melhora observação e prioriza investigação; **não otimiza UI, CSS, JavaScript, API ou cache e não autoriza otimização**.
