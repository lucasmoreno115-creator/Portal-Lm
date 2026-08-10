export function parseLatestWorkerVersionId(payload) {
  if (!payload || payload.success !== true) {
    throw new Error('Cloudflare API did not return success=true.');
  }

  if (!payload.result || typeof payload.result !== 'object') {
    throw new Error('Cloudflare API response is missing result.');
  }

  if (!Array.isArray(payload.result.items)) {
    throw new Error('Cloudflare API response result.items is not an array.');
  }

  if (payload.result.items.length === 0) {
    throw new Error('Cloudflare API returned no Worker versions in result.items.');
  }

  const versionId = payload.result.items[0]?.id;
  if (typeof versionId !== 'string' || versionId.trim() === '') {
    throw new Error('Cloudflare API latest Worker version is missing a non-empty id.');
  }

  return versionId;
}
