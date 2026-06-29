# LM 2.0 — Official Architecture

## Purpose

LM 2.0 is a new, isolated 30-day guided program for weight loss through continuity. It is introduced alongside the existing V5 experience and must not replace or mutate V5, Premium, Admin, routing, database, or API behavior in this foundation sprint.

## Core Method

- Plano A = continuidade.
- Plano B = continuidade.
- Nenhum = 0 ponto.
- The student advances by completing 5 of 7 continuity days.

## Isolation Boundaries

- Canonical public route: `/projeto-lm`, rewritten to the LM 2.0 HTML entrypoint.
- HTML entrypoint: `public/project-lm-2.html`.
- JavaScript namespace: `ProjectLm2*` globals only.
- CSS namespace: `lm2-*` classes only.
- No database objects are created in this PR.
- No APIs are created in this PR.
- The official public route is `/projeto-lm`; the underlying LM 2.0 entrypoint remains `public/project-lm-2.html`.
- V5, Premium and Admin remain isolated from the LM 2.0 route.

## Foundation Assets

The entrypoint loads only LM 2.0 assets:

1. `/assets/css/project-lm-2.css`
2. `/assets/js/project-lm-2-state.js`
3. `/assets/js/project-lm-2-router.js`
4. `/assets/js/project-lm-2-app.js`

## Initial Runtime Shape

The foundation runtime is intentionally static and client-only. It provides a functional placeholder and prepares state/router seams for future PRs without integrating persistence, auth, or backend workflows.
