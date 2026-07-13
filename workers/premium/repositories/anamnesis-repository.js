import { createRepositoryContract } from './create-repository-contract.js';
export function createAnamnesisRepositoryContract() { return createRepositoryContract('anamnesisRepository', ['findByStudentId', 'markSent', 'markResponded', 'markAnalyzed']); }
