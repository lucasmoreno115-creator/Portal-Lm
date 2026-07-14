import { createRepositoryContract } from './create-repository-contract.js';
export function createPremiumStudentRepositoryContract() {
  return createRepositoryContract('premiumStudentRepository', ['findByStudentId', 'findByNormalizedEmail', 'create', 'updateEmail', 'listBackfillCandidates', 'listAssociationCandidates', 'associateStudentId', 'batchAssociateStudentIds']);
}
