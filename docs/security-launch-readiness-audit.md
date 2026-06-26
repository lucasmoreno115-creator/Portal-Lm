# Security & Launch Readiness Audit

## O que foi auditado

- Configuração Cloudflare Worker em `wrangler.toml`.
- Autorização administrativa em `workers/services/auth-service.js` e uso do guard em `workers/api.js`.
- Rotas administrativas sob `/api/admin/*`, incluindo health check, logs operacionais, Command Center, Student 360, cadastro/liberação de alunos, anamneses, check-ins, planos, alertas e follow-ups.
- Frontends administrativos que enviam `x-admin-token` via `admin-auth.js` e páginas `admin-*.html`.
- Rotas e assets oficiais da Jornada Projeto LM V5.
- Rotas Premium existentes para garantir que a auditoria não alterou a experiência validada.
- Migrations críticas do Projeto LM V5 e schema base criado por `ensureSchema`.
- Testes existentes de V4, Premium, observabilidade e Projeto LM V5.

## Problemas encontrados

1. `wrangler.toml` continha tokens administrativos hardcoded em `[vars]`.
2. A autenticação administrativa aceitava dois nomes de variável (`ADMIN_TOKEN` e `PORTAL_ADMIN_TOKEN`), aumentando superfície operacional e risco de configuração divergente.
3. Não havia teste mínimo dedicado cobrindo ausência de token, token inválido, token válido, ausência de `ADMIN_TOKEN` em produção e isolamento V5/Premium no contexto de launch readiness.

## Mudanças feitas

- Removidos tokens administrativos hardcoded de `wrangler.toml`.
- O guard administrativo passou a aceitar somente `env.ADMIN_TOKEN`, sem fallback inseguro e sem token alternativo legado.
- Mantida a política fail closed: se `ADMIN_TOKEN` estiver ausente ou vazio, nenhuma chamada administrativa é autorizada.
- Adicionados testes mínimos de segurança e prontidão de lançamento em `tests/security-launch-readiness.test.mjs`.
- Criado este documento de auditoria com configuração, checklist e rotas oficiais.

## Como configurar `ADMIN_TOKEN` no Cloudflare

Configure o token como secret do Worker, fora do repositório:

```bash
wrangler secret put ADMIN_TOKEN
```

Depois cole um valor forte, único e não reutilizado. Recomendações:

- Não commitar o valor em `wrangler.toml`, arquivos `.js`, `.html`, testes ou documentação.
- Rotacionar o token antes do lançamento, já que havia um valor exposto no histórico/configuração local.
- Usar o mesmo secret no ambiente de produção que atende `portal.lucasmorenopersonal.com.br/api/*`.
- Validar com uma chamada administrativa real após deploy:

```bash
curl -i https://portal.lucasmorenopersonal.com.br/api/admin/health-check \
  -H "x-admin-token: $ADMIN_TOKEN"
```

Chamadas sem `x-admin-token` ou com token inválido devem retornar `401` com erro genérico.

## Rotas administrativas protegidas

Todas as rotas sob `/api/admin/*` entram no bloco administrativo central de `workers/api.js` e passam por `isAdminAuthorized(request, env)` antes de executar lógica de negócio.

Resposta esperada quando não autorizado:

- HTTP `401`
- payload genérico: `{ "ok": false, "error": "Unauthorized" }`
- log operacional interno `admin_unauthorized`
- sem exposição de detalhes sobre token esperado, secrets ou configuração

## Rotas oficiais do Premium e Projeto LM

### Premium oficial

- Login do aluno: `portal-login.html`
- Home Premium: `portal.html`
- Check-in Premium: `portal-checkin.html`
- Plano alimentar Premium: `portal-plano-alimentar.html`
- Biblioteca Premium: `portal-biblioteca.html`
- Progressão Premium: `portal-progressao.html`
- Anamnese Premium pública: `anamnese-premium.html`
- APIs Premium principais: `/api/portal/*` e `/api/anamnese-premium`

### Projeto LM V5 oficial

- Página oficial isolada: `public/project-lm-v5.html`
- Assets oficiais isolados:
  - `public/assets/js/project-lm-v5-state.js`
  - `public/assets/js/project-lm-v5-screen-contracts.js`
  - `public/assets/js/project-lm-v5-app.js`
  - `public/assets/css/project-lm-v5.css`
- Hash routes oficiais:
  - `#project-lm/journey`
  - `#project-lm/stage-1-actions`
  - `#project-lm/plan-b`
  - `#project-lm/victories`
  - `#project-lm/recovery`
  - `#project-lm/maintenance`
- APIs V5 oficiais:
  - `GET /api/project-lm/journey`
  - `POST /api/project-lm/stage-1/actions`
  - `POST /api/project-lm/stage-1/actions/:id/complete`
  - `POST /api/project-lm/plan-b`
  - `POST /api/project-lm/victories`
  - `POST /api/project-lm/recovery`
  - `POST /api/project-lm/maintenance-goals`

### Projeto LM legado / anterior

As telas `projeto-lm-*.html`, `project-lm-profile.html`, `project-lm-profile.js` e `project-lm-planning.js` permanecem no repositório por compatibilidade e não foram removidas nesta auditoria. Elas não são a rota oficial da Jornada Projeto LM V5.

## Checklist pré-lançamento

- [ ] Rodar `npm test` no branch final.
- [ ] Configurar `ADMIN_TOKEN` via `wrangler secret put ADMIN_TOKEN`.
- [ ] Rotacionar qualquer token administrativo já exposto antes do go-live.
- [ ] Confirmar que `wrangler.toml` não contém secrets.
- [ ] Fazer deploy em ambiente controlado.
- [ ] Validar `/api/health` sem autenticação.
- [ ] Validar `/api/admin/health-check` sem token: deve retornar `401`.
- [ ] Validar `/api/admin/health-check` com token inválido: deve retornar `401`.
- [ ] Validar `/api/admin/health-check` com `ADMIN_TOKEN` válido: deve retornar `200`.
- [ ] Validar login e navegação Premium sem carregar assets `project-lm-v5-*`.
- [ ] Validar `public/project-lm-v5.html#project-lm/journey` com usuário `projeto_lm`.
- [ ] Confirmar que usuário Premium recebe bloqueio `403` nos endpoints V5 `/api/project-lm/*`.

## Riscos restantes

- O segredo removido precisa ser considerado comprometido e rotacionado porque já esteve versionado/configurado localmente.
- O armazenamento do token admin no navegador continua em `localStorage`; isso preserva compatibilidade atual, mas uma sessão administrativa mais robusta deve ser avaliada em PR futuro.
- As telas Projeto LM legadas continuam presentes por compatibilidade; a comunicação operacional deve reforçar que V5 usa `public/project-lm-v5.html`.
