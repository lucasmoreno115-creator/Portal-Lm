import { assertPremiumEvent } from '../domain/premium-events.js';

export function createPremiumEventService({ repository } = {}) {
  return Object.freeze({
    validate(event) {
      return assertPremiumEvent(event);
    },
    async record(event, payload = {}) {
      assertPremiumEvent(event);
      if (!repository?.record) {
        return Object.freeze({ event, payload: Object.freeze({ ...payload }), persisted: false });
      }
      return repository.record({ event, payload });
    },
  });
}
