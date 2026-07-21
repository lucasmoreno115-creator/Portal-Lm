# Premium nutrition-plan association — Phase 1

This manual production operation is limited to a legacy plan that is currently a `SINGLE_LEGACY_CANDIDATE`. It changes only `nutrition_plans.student_id`; it does not publish, change lifecycle fields, timestamps, plan content, or `student_email`.

## Modes

- **`dry-run`** re-reads all Premium students, emits a sanitized eligibility manifest, and never issues a write.
- **`apply`** requires `APPLY_PHASE_1`, re-runs the same eligibility checks, then performs one parameterized update per eligible plan with `id` and `student_id IS NULL` conditions. Every update must report exactly one changed row.
- **`rollback`** requires `ROLLBACK_PHASE_1` plus the sanitized `rollback_manifest` from an apply artifact. It finds the internal ID by matching the opaque plan ID among plans still associated to the manifest student, and writes `NULL` only when that exact association remains. It will not overwrite a later manual change.

The workflow is manually dispatched, restricted to `main`, protected by the `production` environment, and uses `CLOUDFLARE_D1_API_TOKEN`. Its artifact retention is one day and its job summary is aggregate-only. The artifact excludes email addresses, names, plan content, meals, and raw plan IDs.

## Eligibility

At execution time a candidate must have an active student, one matching plan, null `student_id`, null/absent lifecycle status, no modern lifecycle record or canonical association, one matching Premium identity, and the unchanged single-legacy classification. All other categories, identity collisions, state changes, and non-exact updates are blocked individually.
