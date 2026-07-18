# Admin Session Hardening

## O que mudou

O fluxo administrativo deixou de depender de `ADMIN_TOKEN` persistido no navegador e também deixou de usar `Map` em memória como autoridade de produção. O token informado pelo operador é usado apenas uma vez, no backend, para criar uma sessão administrativa temporária assinada.

Novos endpoints:

- `POST /api/admin/session/login`
- `POST /api/admin/session/logout`

As chamadas administrativas passam a aceitar a sessão via header `x-admin-session`.

## Novo login admin

1. O frontend envia o token digitado para `POST /api/admin/session/login` no corpo JSON (`{ "token": "..." }`).
2. O Worker valida esse valor contra `env.ADMIN_TOKEN`.
3. Em caso de sucesso, o backend cria um payload com versão, `issuedAt`, `expiresAt` e `sessionId` aleatório.
4. O payload é assinado com HMAC SHA-256 usando `ADMIN_SESSION_SECRET` quando configurado, ou `ADMIN_TOKEN` como fallback operacional.
5. A API retorna apenas:
   - `session_id` (payload + assinatura, em Base64URL);
   - `expires_at`;
   - `ttl_seconds`.
6. O `ADMIN_TOKEN` nunca é retornado ao frontend, não é persistido e não compõe o payload decodificável da sessão.
7. Em caso de falha, a API responde `401` com erro genérico (`Unauthorized`).

## Expiração e validação

A sessão administrativa expira após 8 horas. Cada Worker consegue validar a mesma sessão de forma stateless porque a assinatura é verificável com o segredo do ambiente. Payload alterado, assinatura inválida, token aleatório ou segredo ausente retornam `ADMIN_SESSION_INVALID`. Sessão assinada expirada retorna `ADMIN_SESSION_EXPIRED`.

## Logout

O logout chama `POST /api/admin/session/logout` com a sessão atual e o frontend remove os dados locais de sessão e qualquer chave legada `lm_admin_token`.

Como sessões stateless não ficam armazenadas no Worker, o logout não revoga imediatamente uma cópia já emitida do token de sessão. Revogação imediata exige uma revocation store separada, por exemplo KV/D1/Durable Object, keyed por `sessionId`/nonce até `expiresAt`.

## Armazenamento da sessão

O frontend pode armazenar somente o token de sessão assinado (`lm_admin_session_id`) e sua expiração (`lm_admin_session_expires_at`) no `localStorage`. O `ADMIN_TOKEN` não deve aparecer em HTML, JavaScript, query string, localStorage, logs ou respostas.

## Compatibilidade temporária com `x-admin-token`

O header direto `x-admin-token` continua aceito de forma legada/deprecated para reduzir risco de quebra em testes e fluxos administrativos antigos. Novos fluxos devem usar `x-admin-session`. A remoção do caminho legado deve ser feita em um PR futuro após observabilidade confirmar que o frontend e automações já migraram.

## Riscos restantes

- Sessões stateless não oferecem revogação imediata sem uma revocation store separada.
- Ainda existe compatibilidade temporária com `x-admin-token` direto.
- O frontend ainda contém telas antigas com campos historicamente chamados de token; elas agora recebem a sessão, mas a limpeza visual completa deve ocorrer em outro PR.

## Checklist de validação em produção

- Configurar `ADMIN_TOKEN` somente via secrets/env do ambiente.
- Preferencialmente configurar `ADMIN_SESSION_SECRET` separado do `ADMIN_TOKEN`.
- Fazer login em `/admin-login.html` e confirmar redirecionamento para o Command Center ou Workspace solicitado.
- Confirmar que `localStorage.lm_admin_token` não é criado após login.
- Confirmar que `localStorage.lm_admin_session_id` existe após login e não decodifica o `ADMIN_TOKEN`.
- Executar chamadas GET e POST admin e confirmar envio de `x-admin-session`.
- Fazer logout e confirmar remoção da sessão local.
- Confirmar que chamada admin sem sessão retorna `401`.
- Confirmar que sessão adulterada retorna `ADMIN_SESSION_INVALID` e sessão expirada retorna `ADMIN_SESSION_EXPIRED`.
- Confirmar que chamadas públicas, Premium e Projeto LM continuam funcionando.
