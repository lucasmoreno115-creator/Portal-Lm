import assert from 'node:assert/strict';
import test from 'node:test';

import { parseLatestWorkerVersionId } from '../scripts/lib/cloudflare-worker-version.mjs';

test('extracts the latest Worker version id from result.items', () => {
  const response = {
    success: true,
    result: {
      items: [{ id: '18f97339-c287-4872-9bdd-e2135c07ec12' }]
    }
  };

  assert.equal(
    parseLatestWorkerVersionId(response),
    '18f97339-c287-4872-9bdd-e2135c07ec12'
  );
});

test('rejects an empty result.items array', () => {
  assert.throws(
    () => parseLatestWorkerVersionId({ success: true, result: { items: [] } }),
    /no Worker versions/
  );
});

test('rejects result.items when it is not an array', () => {
  assert.throws(
    () => parseLatestWorkerVersionId({ success: true, result: { items: {} } }),
    /not an array/
  );
});

test('rejects success=false', () => {
  assert.throws(
    () => parseLatestWorkerVersionId({ success: false, result: { items: [] } }),
    /success=true/
  );
});

test('rejects a missing result', () => {
  assert.throws(
    () => parseLatestWorkerVersionId({ success: true }),
    /missing result/
  );
});

test('rejects a latest version without an id', () => {
  assert.throws(
    () => parseLatestWorkerVersionId({ success: true, result: { items: [{}] } }),
    /missing a non-empty id/
  );
});
