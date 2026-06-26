# Admin Session Hardening

## O que mudou

O fluxo administrativo deixou de depender de `ADMIN_TOKEN` persistido em `localStorage`. O token informado pelo operador agora é usado apenas uma vez, no backend, para criar uma sessão administrativa temporária.

Novos endpoints:

- `POST /api/admin/session/login`
- `POST /api/admin/session/logout`

As chamadas administrativas passam a aceitar a sessão via header `x-admin-session`.

## Novo login admin

1. O frontend envia o token digitado para `POST /api/admin/session/login` no corpo JSON (`{ "token": "..." }`).
2. O Worker valida esse valor contra `env.ADMIN_TOKEN`.
3. Em caso de sucesso, o backend cria um identificador de sessão aleatório com `crypto.randomUUID()` e retorna apenas:
   - `session_id`
   - `expires_at`
   - `ttl_seconds`
4. O `ADMIN_TOKEN` nunca é retornado ao frontend.
5. Em caso de falha, a API responde `401` com erro genérico (`Unauthorized`).

## Expiração

A sessão administrativa expira após 8 horas. Sessões expiradas são removidas do armazenamento em memória durante validações futuras e deixam de autorizar chamadas admin.

## Logout

O logout chama `POST /api/admin/session/logout` com a sessão atual. Quando a sessão ainda existe no Worker, ela é invalidada no backend. O frontend também remove os dados locais de sessão e qualquer chave legada `lm_admin_token`.

## Armazenamento da sessão

A implementação mínima usa um `Map` em memória no Worker para armazenar sessões e expiração. Essa abordagem evita expor o `ADMIN_TOKEN` no navegador, mas tem limitações em ambientes serverless:

- uma sessão pode ser perdida se o isolate do Worker for reciclado;
- sessões não são compartilhadas entre isolates;
- deploys podem invalidar sessões ativas.

Essas limitações são aceitáveis para este PR porque falham de forma segura: o operador precisa fazer login novamente.

## Compatibilidade temporária com `x-admin-token`

O header direto `x-admin-token` continua aceito de forma legada/deprecated para reduzir risco de quebra em testes e fluxos administrativos antigos. Novos fluxos devem usar `x-admin-session`. A remoção do caminho legado deve ser feita em um PR futuro após observabilidade confirmar que o frontend e automações já migraram.

## Riscos restantes

- Sessões em memória não oferecem revogação global entre isolates.
- Ainda existe compatibilidade temporária com `x-admin-token` direto.
- O frontend ainda contém telas antigas com campos historicamente chamados de token; elas agora recebem a sessão, mas a limpeza visual completa deve ocorrer em outro PR.

## Checklist de validação em produção

- Configurar `ADMIN_TOKEN` somente via secrets/env do ambiente.
- Fazer login em `/admin-login.html` e confirmar redirecionamento para o Command Center.
- Confirmar que `localStorage.lm_admin_token` não é criado após login.
- Confirmar que `localStorage.lm_admin_session_id` existe após login.
- Executar uma chamada admin e confirmar envio de `x-admin-session`.
- Fazer logout e confirmar remoção da sessão local.
- Confirmar que chamada admin sem sessão retorna `401`.
- Confirmar que chamadas públicas, Premium e Projeto LM continuam funcionando.
