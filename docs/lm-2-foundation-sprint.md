# LM 2.0 — Foundation Sprint

## Scope

This sprint creates the safe structural base for LM 2.0 without replacing any production flow.

## Included

- New static page: `public/project-lm-2.html`.
- New isolated JS and CSS assets under `public/assets`.
- Initial state layer.
- Minimal internal router.
- Foundation documentation.
- Automated foundation test coverage.

## Explicitly Excluded

- Database creation.
- API creation.
- `wrangler.toml` changes.
- Deploy or routing changes.
- V5 changes.
- Premium changes.
- Admin changes.
- `lm-access.js` changes.

## Acceptance Statement

LM 2.0 is born isolated, existing experiences remain untouched, and this PR is safe to merge as a foundation scaffold.

## Incremento 06C — Data Layer & Onboarding API

Este incremento cria somente a persistência inicial e os contratos de onboarding/home mínima do LM 2.0. Não inclui frontend completo de onboarding, Semana 1, check-in, Plano B ou avanço das Semanas 2–4.

### Entregas

- Schema isolado `lm2_profiles` e `lm2_journeys`.
- `POST /api/project-lm-2/onboarding` usando a autenticação atual do aluno (`x-student-email`/`x-student-token`).
- `GET /api/project-lm-2/home` para validar o estado inicial do aluno.
- Seleção interna automática de plano alimentar por sexo/peso e treino por sexo.
- Garantia de atualização do perfil existente sem duplicar jornada ativa.

## LM 2.0-11 — Week Unlock & Continuity Logic

Implementada a conclusão oficial da Semana 1 com aula assistida, Plano B inicial e 5 dias de continuidade não consecutivos. A Semana 2 permanece apenas como placeholder e é precedida por uma tela de celebração da Semana 1.

## LM 2.0-14 — Week 2 Completion Status & Transition Guardrails

Este incremento consolida a conclusão oficial da Semana 2 e prepara apenas a transição futura para a Semana 3.

### Entregas

- Cálculo oficial de conclusão da Semana 2: aula + reflexão + resposta mínima + 5 dias de continuidade.
- `GET /api/project-lm-2/week-status` expandido para `current_week = 2`.
- Home passa a retornar `week_2_complete` quando os critérios forem cumpridos.
- Rotas `week-2-complete` e `week-3-placeholder`.
- Guardrail técnico `POST /api/project-lm-2/activate-week-3` sem implementar conteúdo real da Semana 3.

### Fora de escopo preservado

Não há aula, vitórias, gamificação, dashboard ou estatísticas complexas da Semana 3. V5, Premium, Admin e `lm-access.js` permanecem fora do escopo.
