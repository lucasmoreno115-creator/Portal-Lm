# V5-13C — Production Route Verification

## Problema observado em produção

As URLs oficiais da Jornada Projeto LM V5 estavam retornando 404 em produção quando acessadas em:

- `https://portal.lucasmorenopersonal.com.br/project-lm-v5.html#project-lm/journey`
- `https://portal.lucasmorenopersonal.com.br/project-lm-v5.html#project-lm/stage-1-actions`
- `https://portal.lucasmorenopersonal.com.br/project-lm-v5.html#project-lm/victories`
- `https://portal.lucasmorenopersonal.com.br/project-lm-v5.html#project-lm/recovery`

A rota oficial base da V5 é:

- `https://portal.lucasmorenopersonal.com.br/project-lm-v5.html`

## Causa provável

O arquivo oficial existe em `public/project-lm-v5.html`, mas a configuração anterior do Worker estava limitada a `portal.lucasmorenopersonal.com.br/api/*` e não declarava o binding de assets estáticos para `./public`.

Com isso, o Worker atendia apenas chamadas de API e não havia garantia, no `wrangler.toml`, de que os arquivos de `public/` seriam publicados na raiz do domínio. Como `public/project-lm-v5.html` deve ser servido como `/project-lm-v5.html`, a configuração de assets precisa apontar explicitamente para `./public` e o Worker precisa preservar o asset handler para caminhos fora de `/api/*`.

## Diferença entre path e hash route

Em uma URL como:

`/project-lm-v5.html#project-lm/journey`

- O **path** é `/project-lm-v5.html`.
- A **hash route** é `#project-lm/journey`.

O hash nunca é enviado ao servidor. Portanto, se qualquer URL com hash retorna 404 em produção, a falha real está no path base `/project-lm-v5.html`. Depois que o HTML base retorna 200, o app da V5 resolve o hash no navegador.

## Rota esperada

`public/project-lm-v5.html` deve ser publicado a partir de `./public` e servido em produção como:

`https://portal.lucasmorenopersonal.com.br/project-lm-v5.html`

O HTML oficial deve carregar apenas os assets V5:

- `/assets/css/project-lm-v5.css`
- `/assets/js/project-lm-v5-state.js`
- `/assets/js/project-lm-v5-screen-contracts.js`
- `/assets/js/project-lm-v5-app.js`

## Checklist de deploy

Antes do deploy:

- Confirmar que `public/project-lm-v5.html` existe no branch a ser publicado.
- Confirmar que `wrangler.toml` aponta `[assets].directory` para `./public`.
- Confirmar que o binding `[assets].binding` é `ASSETS`.
- Confirmar que a rota do Worker cobre `portal.lucasmorenopersonal.com.br/*` para permitir entrega de assets e APIs no mesmo domínio.
- Confirmar que `workers/api.js` entrega qualquer path fora de `/api/*` ao asset handler.
- Confirmar que APIs continuam isoladas em `/api/*`.
- Rodar `npm test`.
- Rodar `git diff --check`.

## Validação pós-deploy

Após merge/deploy, validar primeiro a página base:

`https://portal.lucasmorenopersonal.com.br/project-lm-v5.html`

Resultado esperado: HTTP 200.

Depois validar as hash routes oficiais:

- `https://portal.lucasmorenopersonal.com.br/project-lm-v5.html#project-lm/journey`
- `https://portal.lucasmorenopersonal.com.br/project-lm-v5.html#project-lm/stage-1-actions`
- `https://portal.lucasmorenopersonal.com.br/project-lm-v5.html#project-lm/victories`
- `https://portal.lucasmorenopersonal.com.br/project-lm-v5.html#project-lm/recovery`

Resultado esperado: todas abrem a mesma página base e deixam o app V5 resolver o hash no navegador.

## Isolamento do Premium

A página Premium não deve carregar os assets V5. O entrypoint V5 permanece dedicado ao Projeto LM e não substitui rotas Premium, Admin, autenticação, banco, APIs ou legado.
