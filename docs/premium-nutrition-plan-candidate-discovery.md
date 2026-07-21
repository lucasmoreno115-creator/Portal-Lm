# Premium nutrition-plan candidate discovery

This diagnostic is a **read-only** production discovery tool. It identifies a conservative, potential legacy plan candidate for each active Premium student, without associating, migrating, publishing, converting, or changing any record.

## Operation and safety

Run it only through the manual GitHub Actions workflow `premium-nutrition-plan-candidate-discovery.yml`. The workflow targets the `production` environment, uses only `CLOUDFLARE_D1_API_TOKEN`, and retains the JSON artifact for one day. Its GitHub summary contains aggregate counts only.

The runner accepts only a single `SELECT` or `WITH` statement. It reads the `nutrition_plans` table declaration from `sqlite_schema` (not `PRAGMA`) before constructing its projection, so only schema columns confirmed in the target D1 database are requested.

The artifact contains canonical student IDs, a salted stable email hash, hashed opaque plan IDs, statuses, available timestamps, versions, linkage type, and decision metadata. It deliberately excludes emails, names, plan contents, meals, and notes.

## Classification rules

| Classification | Meaning | Association posture |
| --- | --- | --- |
| `SINGLE_LEGACY_CANDIDATE` | Exactly one legacy plan | High confidence; eligible only for separately approved future work |
| `DETERMINISTIC_MULTIPLE_CANDIDATE` | Multiple legacy plans with a complete, unique newest timestamp | Medium confidence; review historical records first |
| `AMBIGUOUS_MULTIPLE_PLANS` | Timestamp missing, invalid, tied, or lifecycle comparison is unsafe | Blocked; manual review |
| `MODERN_DRAFT_CONFLICT` | Legacy plan(s) coexist with modern DRAFT(s) | Blocked; never choose automatically |
| `MODERN_DRAFT_ONLY` | Only DRAFT lifecycle plans | Blocked; a DRAFT is not published/current |
| `NO_PLAN` | No matching plan | Blocked; no association candidate |

For multiple legacy records, timestamp precedence is `published_at`, then `updated_at`, then `created_at`; a usable column must have valid timestamps for every legacy record and a unique latest value. `version_number` is reported but never substitutes for temporal evidence.

## Local verification

```bash
node --test tests/premium-nutrition-plan-candidate-discovery.test.mjs
npm test
npm run check:project-lm-runtime
git diff --check
```
