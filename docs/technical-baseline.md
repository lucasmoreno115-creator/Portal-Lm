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
