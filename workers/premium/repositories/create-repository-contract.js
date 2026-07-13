function notImplemented(repositoryName, methodName) {
  return async () => {
    throw new Error(`${repositoryName}.${methodName} is not implemented`);
  };
}

export function createRepositoryContract(repositoryName, methodNames) {
  return Object.freeze(Object.fromEntries(methodNames.map((methodName) => [methodName, notImplemented(repositoryName, methodName)])));
}
