const finite = value => typeof value === 'number' && Number.isFinite(value);

export function expectedCls(events) {
  if (!Array.isArray(events) || events.some(event => !event || !finite(event.value) || typeof event.hadRecentInput !== 'boolean')) throw new Error('LAYOUT_EVENTS_INVALID');
  return events.reduce((total, event) => total + (event.hadRecentInput ? 0 : event.value), 0);
}

export function clsConsistency(metricsCls, events) {
  const expected = expectedCls(events);
  if (!finite(metricsCls)) return { valid: false, expected, actual: metricsCls, tolerance: null };
  const tolerance = Number.EPSILON * Math.max(16, events.length * 4, Math.abs(expected) * 4, Math.abs(metricsCls) * 4);
  return { valid: Math.abs(metricsCls - expected) <= tolerance, expected, actual: metricsCls, tolerance };
}

export function sortLayoutSnapshots(snapshots) {
  if (!Array.isArray(snapshots)) throw new Error('LAYOUT_SNAPSHOTS_INVALID');
  return snapshots.map(snapshot => ({ ...snapshot, elements: [...snapshot.elements].sort((a, b) => a.selector.localeCompare(b.selector)) }))
    .sort((a, b) => a.monotonicTime - b.monotonicTime || a.phase.localeCompare(b.phase));
}

export function identifyUpstreamGrowth(snapshots, affectedSelectors = []) {
  const ordered = sortLayoutSnapshots(snapshots);
  if (ordered.length < 2) return [];
  const initial = new Map(ordered[0].elements.map(element => [element.selector, element]));
  const final = new Map(ordered.at(-1).elements.map(element => [element.selector, element]));
  return [...initial.keys()].filter(selector => !affectedSelectors.includes(selector) && final.has(selector))
    .map(selector => ({ selector, heightBefore: initial.get(selector).rect.height, heightAfter: final.get(selector).rect.height, delta: final.get(selector).rect.height - initial.get(selector).rect.height, stateBefore: initial.get(selector).state, stateAfter: final.get(selector).state }))
    .filter(item => item.delta > 0).sort((a, b) => b.delta - a.delta || a.selector.localeCompare(b.selector));
}
