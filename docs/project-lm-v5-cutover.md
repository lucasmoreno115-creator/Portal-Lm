# Projeto LM V5 Official Cutover

## Arquitetura oficial

A implementação oficial do Projeto LM passa a ser a Jornada V5, isolada em frontend, assets e namespace de API próprios. O cutover não altera regras Premium, regras nutricionais, banco/schema ou conteúdo aprovado da Jornada V5.

## Frontend oficial

- `public/project-lm-v5.html`

## Assets oficiais

- `public/assets/js/project-lm-v5-app.js`
- `public/assets/js/project-lm-v5-state.js`
- `public/assets/js/project-lm-v5-screen-contracts.js`
- `public/assets/css/project-lm-v5.css`

## Rotas oficiais

- `#project-lm/journey`
- `#project-lm/stage-1-actions`
- `#project-lm/plan-b`
- `#project-lm/victories`
- `#project-lm/recovery`
- `#project-lm/maintenance`

## Fluxo oficial

1. Novo usuário Projeto LM autenticado entra pela Jornada V5.
2. `portal.html` redireciona usuários `projeto_lm` para `public/project-lm-v5.html#project-lm/journey`.
3. O menu plan-aware de Projeto LM aponta apenas para rotas V5.
4. As rotas V5 consomem os endpoints `/api/project-lm/*` da foundation V5.

## Inventário legado

O inventário completo está em `docs/project-lm-legacy-inventory.md`. Os arquivos legados foram mantidos, marcados como **LEGACY** e não são mais entrypoints oficiais para novos fluxos.

## O que foi alterado

- Redirecionamento de usuários Projeto LM em `portal.html` para a Jornada V5.
- Links internos de Projeto LM em `portal.html` para hash routes oficiais V5.
- Menu plan-aware em `public/assets/js/lm-access.js` para apontar para V5.
- Redirecionamentos de fallback/onboarding Projeto LM para V5.
- Comentários de legado nos arquivos antigos do Projeto LM.
- Documentação de cutover e inventário legado.
- Testes estáticos de readiness do cutover.

## O que NÃO foi alterado

- Regras de negócio Premium.
- Regras nutricionais.
- Student 360.
- Admin.
- Autenticação.
- Banco, migrations existentes e schema.
- Conteúdo aprovado da Jornada V5.
- Funcionalidades legadas estáveis, que foram preservadas.

## Isolamento

- Premium continua usando `portal.html`, `portal.css`, `portal-shared.js` e seus assets existentes.
- Premium não carrega `project-lm-v5-app.js`, `project-lm-v5-state.js`, `project-lm-v5-screen-contracts.js` nem `project-lm-v5.css`.
- Projeto LM V5 carrega apenas os assets V5 listados acima e não carrega telas/assets Premium.

## Checklist Beta Launch

- [x] Uma Jornada Projeto LM oficial definida.
- [x] Novos fluxos Projeto LM apontam para V5.
- [x] Assets V5 oficiais documentados.
- [x] Rotas V5 oficiais documentadas.
- [x] Legado preservado e marcado.
- [x] Isolamento Premium x Projeto LM validado por teste estático.
- [x] Rotas V5 continuam acessíveis.
- [ ] Monitorar tráfego real das telas legadas durante beta.
- [ ] Confirmar comunicação operacional para alunos Projeto LM.

## Plano futuro de remoção do legado

1. Instrumentar/consultar acessos reais às telas legadas durante o beta.
2. Confirmar que não há links externos ativos para telas antigas.
3. Migrar qualquer métrica útil para V5 sem alterar regras nutricionais.
4. Abrir PR específico de remoção/arquivamento legado após o Beta Launch.
