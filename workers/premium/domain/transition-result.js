export function createTransitionResult({ domain, from, to, changed = from !== to, event = null, metadata = {} }) {
  return Object.freeze({
    ok: true,
    domain,
    from,
    to,
    changed,
    event,
    metadata: Object.freeze({ ...metadata }),
  });
}
