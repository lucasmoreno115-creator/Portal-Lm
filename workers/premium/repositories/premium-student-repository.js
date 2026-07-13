import { createRepositoryContract } from './create-repository-contract.js';
export function createPremiumStudentRepositoryContract() { return createRepositoryContract('premiumStudentRepository', ['findById', 'findByEmail', 'list', 'create']); }
