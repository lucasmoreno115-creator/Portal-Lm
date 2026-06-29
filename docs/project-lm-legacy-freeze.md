# Projeto LM — Legacy Freeze

## Status oficial atual

A versão oficial atual do **Projeto LM** é a experiência LM 2.0, publicada exclusivamente pela URL pública:

- URL pública oficial: `/projeto-lm`
- Entrypoint interno: `public/project-lm-2.html`
- CSS oficial: `public/assets/css/project-lm-2.css`
- JavaScript oficial:
  - `public/assets/js/project-lm-2-app.js`
  - `public/assets/js/project-lm-2-state.js`
  - `public/assets/js/project-lm-2-router.js`
- API oficial: `/api/project-lm-2/*`
- Banco oficial: tabelas `lm2_*`

`public/project-lm-2.html` é apenas detalhe de implementação interna. Links públicos, menus, redirects de login e documentação de produto devem usar `/projeto-lm`.

## Regras de freeze

1. Novas implementações do Projeto LM **não podem** usar arquivos, APIs, rotas ou tabelas legadas.
2. Toda navegação pública do Projeto LM deve apontar para `/projeto-lm` ou `/projeto-lm#...`.
3. Não criar novos links públicos para `project-lm-2.html`, `project-lm-v5.html`, `projeto-lm-*.html` ou `project-lm-profile.html`.
4. V5 e as superfícies antigas permanecem no repositório apenas como histórico, compatibilidade operacional ou referência controlada.
5. Consultoria Premium e Admin permanecem isolados do Projeto LM 2.0 e não devem carregar assets `project-lm-2-*`.

## Arquivos oficiais do Projeto LM

| Tipo | Arquivo |
|---|---|
| Entrypoint interno | `public/project-lm-2.html` |
| CSS | `public/assets/css/project-lm-2.css` |
| Estado | `public/assets/js/project-lm-2-state.js` |
| Router | `public/assets/js/project-lm-2-router.js` |
| App | `public/assets/js/project-lm-2-app.js` |

## V5 anterior — legado/deprecated

As superfícies abaixo são **LEGACY / DEPRECATED** e não representam mais o fluxo oficial do Projeto LM:

- `public/project-lm-v5.html`
- `public/assets/css/project-lm-v5.css`
- `public/assets/js/project-lm-v5-*`
- `docs/project-lm-v5-*`
- `tests/project-lm-v5-*`
- APIs `/api/project-lm/*`
- Tabelas `project_lm_journeys` e correlatas de V5

Testes V5 que permanecerem no repositório devem ser lidos como cobertura histórica/de compatibilidade, não como contrato oficial de navegação pública.

## Legado antigo — histórico/deprecated

As superfícies abaixo são **LEGACY / DEPRECATED**:

- `projeto-lm-*.html`
- `project-lm-profile.html`
- `project-lm-profile.js`
- `project-lm-planning.js`
- `project-lm.css`
- APIs `/api/portal/project-lm/*`
- API `/api/project-lm/profile`
- Tabelas antigas `project_lm_*`

Esses arquivos e contratos não devem receber novas extensões de produto. Qualquer manutenção futura deve deixar claro que se trata de compatibilidade/histórico.

## Proteção esperada por testes estáticos

A suíte deve proteger que:

- `portal-login.html` envia alunos Projeto LM para `/projeto-lm`.
- Menus do Projeto LM apontam para `/projeto-lm#...`.
- Navegação oficial não aponta para `project-lm-v5.html`, `projeto-lm-jornada.html`, `projeto-lm-onboarding.html`, `projeto-lm-planejamento.html` ou `project-lm-profile.html`.
- Links públicos do Projeto LM usam `/projeto-lm` em vez de entrypoints internos.
- Consultoria Premium não carrega assets `project-lm-2-*`.
- Admin não é alterado por este freeze.
