# Projeto LM — Inventário Legado Controlado

Este inventário marca os pontos do Projeto LM anteriores ao cutover oficial V5. Eles permanecem no repositório para consulta, compatibilidade e rollback controlado, mas não devem receber novas extensões de produto.

## Regra de manutenção

Todos os arquivos abaixo estão classificados como **LEGACY** e receberam o comentário visível:

```text
LEGACY - DO NOT EXTEND
SUPERSEDED BY PROJECT LM V5
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
| Jornada principal | `projeto-lm-jornada.html` | `public/project-lm-v5.html` | OFFICIAL para V5 / LEGACY para legado |
| Perfil inicial | `project-lm-profile.html`, `project-lm-profile.js` | `public/project-lm-v5.html#project-lm/journey` | LEGACY |
| Planejamento | `projeto-lm-planejamento.html`, `project-lm-planning.js` | `#project-lm/stage-1-actions` | LEGACY / OFFICIAL |
| Plano B | `projeto-lm-dia-dificil.html` | `#project-lm/plan-b` | LEGACY / OFFICIAL |
| Conquistas | `projeto-lm-conquistas.html` | `#project-lm/victories` | LEGACY / OFFICIAL |
| Consistência/estatísticas | `projeto-lm-consistencia.html`, `projeto-lm-estatisticas.html` | View model V5 | LEGACY |
| Biblioteca | `projeto-lm-biblioteca.html`, `projeto-lm-conteudo.html` | Fora do cutover oficial V5 | LEGACY |
| Assets CSS | `project-lm.css`, estilos em `portal.css` | `public/assets/css/project-lm-v5.css` | OFFICIAL para V5 / LEGACY para legado |
| Assets JS | `project-lm-profile.js`, `project-lm-planning.js` | `project-lm-v5-app.js`, `project-lm-v5-state.js`, `project-lm-v5-screen-contracts.js` | OFFICIAL para V5 / LEGACY para legado |
| Endpoints legados | `/api/portal/project-lm/*`, `/api/project-lm/profile` | `/api/project-lm/journey`, `/stage-1/actions`, `/plan-b`, `/victories`, `/recovery`, `/maintenance-goals` | LEGACY / OFFICIAL |
