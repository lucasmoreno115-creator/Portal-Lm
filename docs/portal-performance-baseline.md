# S0.4 — baseline de performance do Portal do Aluno

Esta sprint cria **diagnóstico**, não otimização. Ela não calcula score, não aprova/reprova páginas, não define budget e não altera a baseline/budgets da S0.3. Os dados observados poderão orientar hipóteses e budgets discutidos na S0.5, sem os criar automaticamente.

## Ambientes e limites

- **LAB_LOCAL** serve somente os arquivos estáticos locais, sem API ou identidade simulada.
- **LAB_STUBBED** (o ambiente desta medição) acrescenta respostas mínimas, confirmadas nos contratos usados pelas páginas, para um aluno inteiramente fictício. Não representa dados, autenticação, D1, latência ou comportamento de produção.
- **STAGING_AUTHENTICATED** seria uma medição autorizada em staging com identidade de teste; não é usada por esta infraestrutura offline.
- **Produção** é o tráfego e a infraestrutura reais; esta ferramenta jamais a acessa.

A medição sintética é sensível ao host, versão do Chrome, agendamento do sistema e implementação do headless. Ela não substitui RUM nem representa diversidade de dispositivos. LCP pode ficar indisponível quando não há candidato elegível antes da coleta; CLS pode ficar indisponível quando a API/observer não é suportada. Ausência é `null`, nunca zero.

## Perfil e páginas

O perfil versionado executa cinco repetições em viewport mobile 390 × 844, DPR 2, CPU 4×, latência de 150 ms, download de 200.000 B/s e upload de 93.750 B/s. Mede `/portal-login.html`, `/portal-premium-home.html`, `/portal-checkin.html`, `/portal-plano-alimentar.html` e `/portal-progressao.html`.

**COLD** limpa cache e storage, desabilita cache e ignora Service Worker. **WARM** preserva o perfil do Chrome, habilita cache e faz uma segunda navegação controlada. Os grupos nunca são agregados juntos. Mediana é o centro da amostra ordenada (média dos dois centrais para tamanho par); p75 usa o nearest-rank determinístico. Dados brutos não são arredondados.

## Execução

Requer Node 22 e Chrome/Chromium:

```sh
npm ci
npm run performance:portal:test
npm run performance:portal
```

A descoberta consulta `CHROME_BIN` e caminhos conhecidos de Linux, macOS e Windows. Exemplo: `CHROME_BIN=/usr/bin/google-chrome npm run performance:portal`. A ausência produz erro explícito; no workflow Chrome estável é obrigatório.

O servidor Node escuta em `127.0.0.1` e porta dinâmica, serve apenas `public/`, e responde aos contratos mínimos `/api/portal/premium/access-state`, `/api/portal/weekly-plan`, `/api/portal/checkins`, `/api/portal/progression` e `/api/portal/nutrition-plan`. Nenhum body, header de autenticação, cookie, storage, e-mail ou token é incluído no relatório. URLs têm queries sanitizadas; requests externos são bloqueados e tornam a execução inválida.

Os relatórios JSON e Markdown ficam em `artifacts/performance/` (ignorado pelo Git). Eles separam dados brutos/agregados COLD/WARM, redirects, URL final, falhas, cache, protocolo, status e bytes. `MEASURED` indica conclusão da infraestrutura; `INCOMPLETE`, medições parciais; `FAILED`, impossibilidade de medir — nunca julgamento de performance.
