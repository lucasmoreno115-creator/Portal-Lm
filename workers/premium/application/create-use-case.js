function missingHandler(name) {
  return async () => {
    throw new Error(`Premium use case ${name} requires an implementation adapter`);
  };
}

export function createPremiumUseCase(name, handler = missingHandler(name)) {
  return Object.freeze({
    name,
    execute: handler,
  });
}
