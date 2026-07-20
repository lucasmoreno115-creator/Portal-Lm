import { createD1PremiumStudentRepository } from '../workers/premium/repositories/d1-premium-student-repository.js';
import { BACKFILL_MODE, rollbackPremiumStudentIdentityBackfill, runPremiumStudentIdentityBackfill } from './premium-student-identity-backfill.mjs';

const MODES = new Set(['dry-run', 'apply', 'rollback']);
const REQUEST_TIMEOUT_MS = 30_000;
const BATCH_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

function safeError(code, detail = '') {
  const suffix = detail ? `:${detail}` : '';
  return new Error(`${code}${suffix}`);
}

export function parseArguments(argv = process.argv.slice(2)) {
  const selected = argv.filter((value) => ['--dry-run', '--apply', '--rollback'].includes(value));
  if (selected.length !== 1) throw safeError('INVALID_BACKFILL_MODE');
  const batchIndex = argv.indexOf('--batch-id');
  if (batchIndex >= 0 && (!argv[batchIndex + 1] || argv[batchIndex + 1].startsWith('--'))) throw safeError('BACKFILL_BATCH_ID_REQUIRED');
  return { mode: selected[0].slice(2), batchId: batchIndex >= 0 ? argv[batchIndex + 1].trim() : '' };
}

export function validateRemoteConfig(env = process.env) {
  const config = {
    token: String(env.CLOUDFLARE_API_TOKEN ?? '').trim(),
    accountId: String(env.CLOUDFLARE_ACCOUNT_ID ?? '').trim(),
    databaseId: String(env.CLOUDFLARE_D1_DATABASE_ID ?? '').trim(),
  };
  if (!config.token || !config.accountId || !config.databaseId) throw safeError('CLOUDFLARE_D1_CONFIGURATION_MISSING');
  return config;
}

export function validateOperation({ mode, batchId, confirmApply = '', confirmRollback = '' }) {
  if (!MODES.has(mode)) throw safeError('INVALID_BACKFILL_MODE');
  if ((mode === 'apply' || mode === 'rollback') && !String(batchId ?? '').trim()) throw safeError('BACKFILL_BATCH_ID_REQUIRED');
  if (String(batchId ?? '') && !BATCH_ID_PATTERN.test(String(batchId))) throw safeError('INVALID_BACKFILL_BATCH_ID');
  if (mode === 'apply' && confirmApply !== 'APPLY_LEGACY_PREMIUM_BACKFILL') throw safeError('APPLY_CONFIRMATION_REQUIRED');
  if (mode === 'rollback' && confirmRollback !== 'ROLLBACK_LEGACY_PREMIUM_BACKFILL') throw safeError('ROLLBACK_CONFIRMATION_REQUIRED');
}

export function operationFromEnv(env = process.env) {
  return { mode: String(env.BACKFILL_MODE ?? ''), batchId: String(env.BACKFILL_BATCH_ID ?? ''), confirmApply: String(env.CONFIRM_APPLY ?? ''), confirmRollback: String(env.CONFIRM_ROLLBACK ?? '') };
}

export function validateOperationFromEnv(env = process.env) {
  const operation = operationFromEnv(env);
  validateOperation(operation);
  return operation;
}

export function createRemoteD1Client({ token, accountId, databaseId, fetchImpl = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  async function request(body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let payload;
      try { payload = await response.json(); } catch { throw safeError('CLOUDFLARE_D1_INVALID_RESPONSE'); }
      if (!response.ok || payload?.success === false) {
        const cfCode = Number(payload?.errors?.[0]?.code ?? payload?.code);
        throw safeError('CLOUDFLARE_D1_HTTP_ERROR', `${response.status}${Number.isFinite(cfCode) ? `:CF_${cfCode}` : ''}`);
      }
      return payload.result;
    } catch (error) {
      if (error?.name === 'AbortError') throw safeError('CLOUDFLARE_D1_TIMEOUT');
      if (String(error?.message ?? '').startsWith('CLOUDFLARE_D1_')) throw error;
      throw safeError('CLOUDFLARE_D1_REQUEST_FAILED');
    } finally { clearTimeout(timeout); }
  }
  async function query(sql, params = []) {
    const result = await request({ sql, params });
    const firstResult = Array.isArray(result) ? result[0] : result;
    if (!firstResult || typeof firstResult !== 'object') throw safeError('CLOUDFLARE_D1_INVALID_RESPONSE');
    return firstResult;
  }
  async function batch(statements) {
    if (!Array.isArray(statements) || statements.length === 0) return [];
    const payload = statements.map((statement) => statement?.remoteStatement);
    if (payload.some((statement) => !statement || typeof statement.sql !== 'string' || !Array.isArray(statement.params))) throw safeError('CLOUDFLARE_D1_INVALID_BATCH');
    const results = await request({ batch: payload });
    if (!Array.isArray(results) || results.length !== payload.length || results.some((result) => !result || result.success === false)) throw safeError('CLOUDFLARE_D1_BATCH_FAILED');
    return results;
  }
  return Object.freeze({ query, first: async (sql, params) => (await query(sql, params)).results?.[0] ?? null, all: async (sql, params) => ({ results: (await query(sql, params)).results ?? [] }), run: query, batch,
  });
}

// Small D1 binding-shaped facade lets the established repository retain all SQL allowlists.
export function createRemoteD1Binding(client) {
  return Object.freeze({
    prepare(sql) {
      const statement = (params) => ({ remoteStatement: { sql, params }, all: () => client.all(sql, params), first: () => client.first(sql, params), run: () => client.run(sql, params) });
      return { bind(...params) { return statement(params); }, all: () => client.all(sql), run: () => client.run(sql) };
    },
    batch(statements) { return client.batch(statements); },
  });
}

export function summarizeDryRun(result) {
  return { mode: 'dry-run', scanned: result.scanned, classifications: result.classifications };
}

export async function executeRemoteBackfill({ mode, batchId = '', confirmApply = '', confirmRollback = '', env = process.env, fetchImpl, timeoutMs } = {}) {
  validateOperation({ mode, batchId, confirmApply, confirmRollback });
  const config = validateRemoteConfig(env);
  const repository = createD1PremiumStudentRepository(createRemoteD1Binding(createRemoteD1Client({ ...config, fetchImpl, timeoutMs })));
  if (mode === 'rollback') {
    const result = await rollbackPremiumStudentIdentityBackfill({ repository, batchId });
    return { mode, batch_id: batchId, audited: result.audited, restored: result.restored, deleted: result.deleted, errors: 0 };
  }
  const dryRun = await runPremiumStudentIdentityBackfill({ repository, mode: BACKFILL_MODE.DRY_RUN });
  const drySummary = summarizeDryRun(dryRun);
  if (mode === 'dry-run') return drySummary;
  const classifications = dryRun.classifications;
  if (classifications.error > 0 || classifications.ambiguous > 0 || classifications.conflicting_student_id > 0) throw safeError('BACKFILL_APPLY_BLOCKED');
  const result = await runPremiumStudentIdentityBackfill({ repository, mode: BACKFILL_MODE.APPLY, batchId });
  return { mode, batch_id: batchId, created: result.created, associated: result.associated, already_migrated: result.classifications.already_migrated, ignored: result.skipped, errors: result.classifications.error, dry_run: drySummary };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const operation = validateOperationFromEnv();
    const output = await executeRemoteBackfill(operation);
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    // Error codes are deliberately opaque: never echo request bodies, identifiers, or credentials.
    process.stderr.write(`${JSON.stringify({ error: String(error?.message ?? 'BACKFILL_FAILED').split(':').slice(0, 3).join(':') })}\n`);
    process.exitCode = 1;
  }
}
