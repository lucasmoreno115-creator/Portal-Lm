# Portal-Lm

## Database tooling and Wrangler launcher

The database tooling in `scripts/db-tool.mjs` runs Wrangler through a launcher that keeps the Wrangler command and D1 arguments as separate `execFileSync` argv entries.

Normally you do not need to set `WRANGLER_BIN`. When it is not set, the tooling resolves Wrangler in this order: `WRANGLER_BIN`, local `node_modules/.bin/wrangler`, `npx wrangler`, and finally a global `wrangler` fallback if the npx launcher cannot be started. On Windows the `.cmd` launchers run through `cmd.exe /d /s /c`.

If `WRANGLER_BIN` points to an npx launcher (`npx`, `npx.cmd`, or a full path ending in either name), the tooling automatically inserts `wrangler` before the D1 subcommand. For example, `WRANGLER_BIN=npx.cmd` runs as:

```text
cmd.exe /d /s /c npx.cmd wrangler d1 execute ...
```

If `WRANGLER_BIN` points directly to a Wrangler executable (`wrangler`, `wrangler.cmd`, or a full path ending in either name, including `node_modules/.bin/wrangler.cmd`), the tooling does not insert another `wrangler` argument. For example, `WRANGLER_BIN=wrangler.cmd` runs as:

```text
cmd.exe /d /s /c wrangler.cmd d1 execute ...
```

SQL supplied to D1 is passed as a single `--command` argv value rather than concatenated into a shell command string, so spaces, quotes, and CMD metacharacters such as `&`, `|`, `(`, and `)` remain part of the SQL argument. The script entrypoint uses `fileURLToPath(import.meta.url)` with normalized path comparison so `node scripts/db-tool.mjs ...` and Windows-style paths invoke `main()` reliably.
