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
