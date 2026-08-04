# Portal LM technical baseline

Run the offline technical inventory locally or in CI with Node 22:

```sh
npm ci
npm run baseline:technical
```

The single command runs the repository test suite and the Project LM runtime synchronization check, then writes `artifacts/baseline/baseline-report.json` and `artifacts/baseline/baseline-report.md`. It does not contact D1, production, or any external service.

The JSON contract uses `schemaVersion` `1.0.0`. It separates repository observations from command verdicts, uses repository-relative paths, sorts inventories, redacts personal or credential-like strings, and represents every unavailable measurement as `NOT_EXECUTED`. A failed mandatory command makes the process exit nonzero.

Critical-page inventory scans inline JavaScript and local `script[src]` files resolved strictly inside `public/`. Query strings and fragments are ignored, remote scripts are never accessed, and traversal outside `public/` is blocked. Each page lists `sourcesScanned` and `unresolvedSources`: its status is `OBSERVED` after all local sources are read, `PARTIAL` when a local source cannot be read, or `NOT_EXECUTED` when its HTML cannot be read.

API inventory recognizes literal routes passed to `fetch`, Axios, and the local `api()` wrapper. The wrapper scanner balances nested expressions, strings, and template literals without executing JavaScript. Wrapper routes beginning with `/portal/` are reported under their effective `/api/portal/` path, and complete dynamic template expressions are represented as `{dynamic}` without copying their contents. Service Worker precache inventory resolves simple string constants; unresolved expressions produce a `PARTIAL` status and an aggregate `unresolvedEntries` entry without copying source code into the report.

Generated reports are intentionally not committed because their timestamp and suite duration are volatile. CI consumers should retain `artifacts/baseline/` as a run artifact when required.

## S0.3 — deterministic regression budget

The versioned policy is `config/technical-regression-budget.json`. After generating a report, run `npm run baseline:budget`; for the complete quality gate, run `npm run baseline:check`. The latter generates the S0.2 inventory once (including the full test suite and Project LM runtime check) and then compares it without repeating either command. The comparator uses only Node built-ins, reads JSON data without importing or evaluating repository source, performs no network, D1, or production access, never changes the policy, and writes deterministic JSON and Markdown results beside the baseline report.

The initial policy was calibrated from the repository's exact initial commit `f7b0ba3190e5a421dbd7d8857485481fd1716132` using Node `v22.22.2` on 2026-08-04. The clean measurement produced:

| Measurement | Actual | Maximum | Severity |
|---|---:|---:|---|
| `workers/api.js` | 287126 bytes | 293000 | error |
| public JavaScript | 431892 bytes | 453500 | error |
| public CSS | 239539 bytes | 251600 | error |
| public HTML | 268045 bytes | 281500 | error |
| largest public asset | 775360 bytes | 800000 | error |
| `public/` total | 16670484 bytes | 17005000 | warning |
| `SELECT *` in Workers | 0 | 0 | error |
| `ensureSchema` runtime references | 3 | 3 | error |

The suggested maxima accommodate that clean measurement, so no adjustment was necessary. Warning baselines record 875 executed tests, approximately 148 Worker routes, 37 migrations, and the root/public comparison split (14 duplicate and 19 divergent). A reduced test count or a changed route, migration, or duplication count is visible but does not block by itself.

The gate blocks invalid configuration or reports, missing/`NOT_EXECUTED` mandatory metrics, mandatory command failures, critical pages or the Service Worker not marked `OBSERVED`, unresolved precache entries, and exceeded `error` limits. Exceeded `warning` limits and inventory drift produce warnings and exit successfully when there are no errors. Every comparison reports the exact unrounded `actual`, baseline or maximum, delta, severity, and status, sorted by metric identifier.
