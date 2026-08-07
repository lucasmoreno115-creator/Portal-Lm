# S0.6 — estabilidade de layout da Home Premium

## Escopo e proveniência

A Sprint parte do SHA imutável `9fcbc86fa63ca9c0792b789d774de8cf13d2b366` e se limita à Home Premium, ao card PWA/notificações, ao planejamento semanal e à infraestrutura de comparação. Não houve otimização de bundle, imagens, APIs ou do CSS global do Portal: isso misturaria variáveis e impediria atribuir o resultado à estabilização de layout.

O perfil é `LAB_STUBBED`, com viewport móvel de 390 × 844, cinco páginas, cenários COLD/WARM e cinco execuções por combinação (50 runs). Ele valida o laboratório local e **não comprova a experiência de produção**.

## Diagnóstico observado antes da correção

A baseline S0.5 registrou CLS COLD p75 `0.33671254681779383` e três eventos na Home; as outras quatro páginas ficaram em zero. A inspeção dos eventos e do fluxo assíncrono encontrou:

| Evento | Instante aproximado | Elemento associado | Antes → depois | Ação assíncrona | Geometria / inserção acima | Relação |
|---|---:|---|---|---|---|---|
| 1 | após o carregamento inicial e resolução da capacidade de Push | `aside#pwaPushCard` | texto provisório `waiting` → estado real (`unsupported`, `install`, `blocked`, `waiting` ou `error`) | detecção de APIs/permissão e `serviceWorker.ready` | a cópia e o botão mudavam de altura; o card fica acima do planejamento | PWA/Push |
| 2 | após `serviceWorker.ready` e consulta da inscrição | `aside#pwaPushCard` | card visível → `enabled`/`hidden` | `getSubscription()` e recuperação no servidor | `display:none` removia toda a altura e elevava tudo abaixo | PWA/Push |
| 3 | após a resposta de `/portal/weekly-plan` | `section#weekly-plan-section` | textos editoriais iniciais → conteúdo retornado | `api('/portal/weekly-plan')` | linhas adicionais aumentavam a seção e deslocavam conselho e ações; não havia nó inserido acima, mas conteúdo interno crescia | planejamento semanal |

Uma `source` de Layout Instability identifica nós cujo retângulo mudou; ela não atribui causalidade exclusiva nem permite somar o valor integral do evento uma vez para cada source. Por isso o relatório conta cada evento uma única vez e separa eventos com/sem sources, sem duplicar CLS entre `aside` e `section`.

## Solução

Os componentes agora começam explicitamente em `loading`/`aria-busy`, terminam em estados observáveis e reservam um **mínimo**, restrito por `.portal-home-v7`, compatível com as variações conhecidas em desktop e 390 × 844. `min-block-size`, em vez de `height`, permite crescimento com textos longos e não corta ações. Quando a inscrição já confirmada está persistida, o card recebe `hidden` durante o parsing e não cria slot nem participa da árvore de acessibilidade; nos demais estados, a reserva compatibiliza as cópias assíncronas.

Foram preservados no card: carregando, disponível (`waiting`), concedido (`enabled`/oculto), negado (`blocked`), navegador sem suporte (`unsupported`), instalação necessária e erro. No planejamento: carregando, conteúdo disponível, vazio/aluno sem planejamento (fallback editorial) e erro (fallback editorial). Conteúdo, ações, autenticação e contratos permanecem iguais.

## Before/after e decisão

O workflow mede o `before` em worktree detached do SHA inicial, preserva os relatórios em `artifacts/performance/s0.6/before/`, mede o mesmo perfil no HEAD em `after/` e gera `comparison.json` e `comparison.md`. Dados brutos não são arredondados; percentuais com denominador zero são `null`; COLD/WARM e páginas têm ordenação determinística.

Nesta execução local, o Chrome não estava disponível e a instalação pelo repositório do sistema foi bloqueada (HTTP 403). Assim, não há medição real after comparável local e o resultado permanece **INCONCLUSIVE**; não se declara o alvo de CLS atingido nem se autoriza a próxima otimização. O workflow dedicado é a fonte obrigatória para preencher resultados e deltas reais, exigir 50/50 `MEASURED`, Home 10/10, notificações HTTP 200, ausência de HTTP 4xx/5xx e requests externos, CLS COLD p75 ≤ 0,10 e regressões dentro dos limites.

O run real #10 mediu 50 runs em cada lado, mas terminou `FAILED`: CLS COLD p75 da Home permaneceu em `0.33671254681779383` (delta absoluto e percentual zero). A geometria mostrou `#pwaPushCard` e `#weekly-plan-section` descendo juntos cerca de 339,7 px sem mudar de altura; o elemento causal acima deles era o card condicional `#pwaInstallCard`, revelado de forma tardia por `beforeinstallprompt`. A correção posiciona esse convite opcional depois das ações principais, preservando conteúdo, foco e comportamento, mas impedindo que sua elegibilidade empurre conteúdo já pintado.

O coletor agora drena `PerformanceObserver.takeRecords()`, desconecta os observers e captura métricas, eventos e snapshots no mesmo `Runtime.evaluate`. A soma dos eventos sem interação é comparada ao CLS com tolerância limitada a `Number.EPSILON`; divergência gera `CLS_EVENT_MISMATCH` e a run deixa de ser `MEASURED`. Snapshots geométricos contêm apenas seletor sanitizado, retângulo, propriedades visuais, estado e tempo monotônico — nunca texto ou identidade.

## Riscos residuais

- Conteúdo editorial excepcionalmente maior que a reserva pode crescer (sem corte) e ainda produzir deslocamento; a comparação de cinco runs detecta o efeito no contrato LAB_STUBBED.
- Fontes, traduções e dados reais de produção podem ter geometria diferente do stub.
- O estado `enabled` é persistido somente após confirmação real da inscrição. Em visitas seguintes, um script inline marca o card como `hidden` durante o parsing, antes de conteúdo posterior e da primeira pintura; assim o card permanece fora do layout e da árvore de acessibilidade, sem o antigo vazio móvel de 230 px. A primeira ativação nasce de interação do usuário e a recuperação de instalações legadas sem a marca persistida continua como risco transitório, sem atrasar a janela de CLS.
- CSS, JavaScript, imagens e APIs não foram otimizados porque S0.6 isola CLS; essas frentes só podem ser avaliadas em Sprint posterior após evidência conclusiva e aprovação.
