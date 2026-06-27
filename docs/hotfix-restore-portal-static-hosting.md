# Hotfix — Restore Portal Static Hosting

## Causa do incidente

O PR `V5-13C — Production Route Verification` alterou a rota do Cloudflare Worker para capturar `portal.lucasmorenopersonal.com.br/*`. Com isso, requisições para páginas estáticas do Portal LM passaram a chegar no Worker, que tentou servir o portal por meio do binding `ASSETS`.

Como a infraestrutura atual de produção não depende do Worker para hospedar o portal inteiro, essa captura global fez com que páginas como `/`, `/portal.html` e `/admin-login.html` deixassem de ser atendidas pela infraestrutura estática anterior e retornassem HTTP 404.

## Mudança revertida

Este hotfix reverte o Worker para cobrir apenas a superfície de API:

- rota do Worker: `portal.lucasmorenopersonal.com.br/api/*`;
- remoção temporária do binding `[assets]` / `ASSETS`;
- remoção da interceptação de paths fora de `/api/` no Worker.

## Por que o Worker deve cobrir apenas `/api/*`

No desenho atual, o Portal LM estático deve continuar sendo servido pela infraestrutura anterior de hosting estático. O Worker é responsável somente pelas APIs do portal.

Manter o Worker restrito a `/api/*` evita que assets e páginas HTML sejam interceptados por lógica de API, reduz o risco de 404 em produção e preserva a separação entre hosting estático e backend serverless.

## Validação pós-deploy

Após o deploy, validar manualmente:

- `https://portal.lucasmorenopersonal.com.br/` deve abrir a página inicial estática;
- `https://portal.lucasmorenopersonal.com.br/portal.html` deve abrir normalmente;
- `https://portal.lucasmorenopersonal.com.br/admin-login.html` deve abrir normalmente;
- `https://portal.lucasmorenopersonal.com.br/api/health` deve responder normalmente com status saudável.

## Fora do escopo

A correção específica de `/project-lm-v5.html` não faz parte deste hotfix e deve ser tratada em um PR separado, sem acoplar a restauração emergencial do hosting estático à evolução da V5.
