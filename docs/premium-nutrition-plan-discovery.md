# Premium Nutrition Plan Discovery

## Static architecture

The student endpoint is `GET /api/portal/premium/nutrition-plan/current`. Its handler calls `createGetNutritionPlanUseCase`, which resolves a Premium identity and reads `nutrition_plans` with `student_id`; its e-mail fallback is intentionally available only when identity resolution does not find a student. The Workspace endpoint is `GET /api/admin/premium/students/:identifier/nutrition-plan`; it resolves the identifier to `premium_students.student_id` and calls `createGetCurrentNutritionPlanUseCase`, which only reads the current plan by `student_id`.

Both flows use `createD1NutritionPlanRepository`. Current plans require `is_active=1` and `status='PUBLISHED'` (or a legacy null status). Drafts and archived plans are not current. The canonical Workspace schema is `nutrition_plans` with `student_id`, lifecycle status/version fields, and JSON columns; legacy rows may instead be linked only through `student_email` and lack lifecycle fields. `lm2_profiles.nutrition_plan_id` is separately inspected as a profile reference, never joined or modified.

## Confirmed divergence and recommendation

The Workspace has no e-mail fallback after resolving a Premium identity. Thus an active legacy row linked through `student_email`, or with the e-mail stored in `student_id`, can be visible through legacy/student reads while invisible in Workspace. The W2 identity backfill explicitly listed `nutrition_plans` as a **read-only audit table**, so it did not associate its `student_id` column.

Run `node scripts/diagnose-premium-nutrition-plan-linkage.mjs` only through the manual production workflow. The adapter permits one `SELECT`, `WITH`, or read `PRAGMA` statement and fails closed with `DIAGNOSTIC_WRITE_SQL_BLOCKED` for writes, transaction commands, or multiple statements. The JSON report hashes e-mail addresses and excludes names, tokens, clinical fields, and plan contents.

The next PR should review classifications and implement a separately approved, reversible association/conversion plan. It must handle duplicate plans, lifecycle/schema differences, and profile-only references conservatively; it must not be combined with this discovery PR.
