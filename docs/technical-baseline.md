# Portal LM technical baseline

Run the offline technical inventory locally or in CI with Node 22:

```sh
npm ci
npm run baseline:technical
```

The single command runs the repository test suite and the Project LM runtime synchronization check, then writes `artifacts/baseline/baseline-report.json` and `artifacts/baseline/baseline-report.md`. It does not contact D1, production, or any external service.

The JSON contract uses `schemaVersion` `1.0.0`. It separates repository observations from command verdicts, uses repository-relative paths, sorts inventories, redacts personal or credential-like strings, and represents every unavailable measurement as `NOT_EXECUTED`. A failed mandatory command makes the process exit nonzero.

Generated reports are intentionally not committed because their timestamp and suite duration are volatile. CI consumers should retain `artifacts/baseline/` as a run artifact when required.
