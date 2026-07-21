# Premium Nutrition Plan Blocked Review

This workflow is a production, read-only discovery for blocked legacy nutrition-plan cases. It uses only `SELECT`/`WITH` statements and the dedicated `CLOUDFLARE_D1_API_TOKEN`; it has no apply mode.

## Portal source of truth

The Premium endpoint is `GET /api/portal/nutrition-plan` in `workers/api.js`. It invokes `createGetNutritionPlanUseCase`, which resolves the Premium identity and calls `findCurrentByStudentId` in `workers/premium/repositories/d1-nutrition-plan-repository.js`.

The exact repository SQL is exported as `PORTAL_NUTRITION_PLAN_QUERIES`. The portal use case opts into `allowLegacyFallback: true`. After identity resolution, `dualReadByIdentity` first calls `findCurrentByStudentId(student_id)` with `byStudentId`: it filters `student_id`, `is_active = 1`, and `status = 'PUBLISHED' OR status IS NULL`, then orders by `version_number DESC, datetime(published_at) DESC LIMIT 1`. If this has no record, the explicit fallback policy calls `findCurrentByEmail(email)` with the authenticated portal email. `byEmail` filters `lower(student_email) = lower(?)`, `student_id IS NULL`, the same active/published-or-legacy predicate, and orders by `datetime(updated_at) DESC, datetime(created_at) DESC LIMIT 1`.

The artifact contains stable email hashes, opaque plan IDs, metadata, structural counts, and non-reversible content fingerprints only. It never includes plan text, meal names, food items, notes, names, or emails. The GitHub Step Summary contains aggregates only and the artifact is retained for one day.
