export function createPassThroughPresenter(name) {
  return Object.freeze({
    name,
    present(payload) {
      return payload;
    },
  });
}
