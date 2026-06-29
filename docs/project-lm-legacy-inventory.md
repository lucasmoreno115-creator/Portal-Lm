# Projeto LM — Inventário Legado Controlado

Este inventário marca os pontos do Projeto LM anteriores ao freeze oficial LM 2.0. Eles permanecem no repositório para consulta, compatibilidade e rollback controlado, mas não devem receber novas extensões de produto.

## Regra de manutenção

Todos os arquivos abaixo estão classificados como **LEGACY** e receberam o comentário visível:

```text
LEGACY - DO NOT EXTEND
SUPERSEDED BY PROJECT LM V5

Observação PR 27: V5 também está congelado como legado/deprecated e foi substituído como fluxo oficial por `/projeto-lm` (LM 2.0).
```

## Inventário

| Arquivo | Função | Motivo da manutenção | Plano de remoção futura |
|---|---|---|---|
| `projeto-lm-jornada.html` | Jornada Projeto LM anterior à V5 | Preservar compatibilidade e histórico de UI | Remover após Beta Launch, auditoria de acessos e confirmação de ausência de tráfego |
| `project-lm-profile.html` | Perfil/onboarding técnico legado do Projeto LM | Preservar fallback sem alterar onboarding aprovado | Remover após migração completa de entrada para V5 |
| `projeto-lm-planejamento.html` | Planejamento/ações mínimas legado | Preservar dados e fallback operacional | Consolidar na rota V5 `#project-lm/stage-1-actions` e remover posteriormente |
| `projeto-lm-estatisticas.html` | Estatísticas legadas do Projeto LM | Preservar consulta histórica de consistência | Remover ou migrar métricas úteis para V5 em PR futuro |
| `projeto-lm-conquistas.html` | Marcos/conquistas legadas | Preservar referência histórica | Consolidar com vitórias V5 e remover após validação |
| `projeto-lm-onboarding.html` | Onboarding legado | Preservar conteúdo aprovado sem alterações | Remover após confirmação de que não é entrypoint |
| `projeto-lm-plano-inicial.html` | Plano inicial legado | Preservar conteúdo aprovado sem alterações | Consolidar ou arquivar após Beta Launch |
| `projeto-lm-consistencia.html` | Consistência legada | Preservar histórico de UX | Migrar aprendizado para V5 sem alterar regra nutricional |
| `projeto-lm-biblioteca.html` | Biblioteca legada do Projeto LM | Preservar acesso histórico a conteúdos | Decidir se permanece como recurso separado ou se será arquivada |
| `projeto-lm-dia-dificil.html` | Modo Dia Difícil legado | Preservar fallback operacional | Consolidar na rota V5 `#project-lm/plan-b` |
| `projeto-lm-conteudo.html` | Conteúdo da biblioteca legado | Preservar leitura de itens existentes | Remover junto com a biblioteca legada, se aplicável |
| `project-lm-profile.js` | Script de perfil legado | Compatibilidade com tela de perfil legada | Remover quando `project-lm-profile.html` for removido |
| `project-lm-planning.js` | Script de planejamento legado | Compatibilidade com planejamento legado | Remover quando `projeto-lm-planejamento.html` for removido |
| `project-lm.css` | Estilos de perfil/planejamento legado | Compatibilidade visual das telas legadas | Remover com as telas legadas dependentes |

## Tabela de classificação

| Componente | Legado | V5 | Status |
|------------|---------|-----|--------|
| Jornada principal | `projeto-lm-jornada.html` | `public/project-lm-v5.html` | HISTÓRICO V5 / LEGACY para legado |
| Perfil inicial | `project-lm-profile.html`, `project-lm-profile.js` | `public/project-lm-v5.html#project-lm/journey` | LEGACY |
| Planejamento | `projeto-lm-planejamento.html`, `project-lm-planning.js` | `#project-lm/stage-1-actions` | LEGACY / HISTÓRICO V5 |
| Plano B | `projeto-lm-dia-dificil.html` | `#project-lm/plan-b` | LEGACY / HISTÓRICO V5 |
| Conquistas | `projeto-lm-conquistas.html` | `#project-lm/victories` | LEGACY / HISTÓRICO V5 |
| Consistência/estatísticas | `projeto-lm-consistencia.html`, `projeto-lm-estatisticas.html` | View model V5 | LEGACY |
| Biblioteca | `projeto-lm-biblioteca.html`, `projeto-lm-conteudo.html` | Fora do cutover oficial V5 | LEGACY |
| Assets CSS | `project-lm.css`, estilos em `portal.css` | `public/assets/css/project-lm-v5.css` | HISTÓRICO V5 / LEGACY para legado |
| Assets JS | `project-lm-profile.js`, `project-lm-planning.js` | `project-lm-v5-app.js`, `project-lm-v5-state.js`, `project-lm-v5-screen-contracts.js` | HISTÓRICO V5 / LEGACY para legado |
| Endpoints legados | `/api/portal/project-lm/*`, `/api/project-lm/profile` | `/api/project-lm/journey`, `/stage-1/actions`, `/plan-b`, `/victories`, `/recovery`, `/maintenance-goals` | LEGACY / HISTÓRICO V5 |


## Freeze PR 27

A partir do freeze legado do Projeto LM, a URL pública oficial é `/projeto-lm`. O entrypoint `public/project-lm-2.html` é interno. V5 (`public/project-lm-v5.html`, assets `project-lm-v5-*`, docs e testes V5) e o legado antigo (`projeto-lm-*.html`, `project-lm-profile.html`, APIs `/api/portal/project-lm/*`, `/api/project-lm/profile` e tabelas antigas `project_lm_*`) permanecem apenas como histórico/deprecated. Novas implementações não devem criar links públicos para esses entrypoints.
