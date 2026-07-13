import { createRepositoryContract } from './create-repository-contract.js';
export function createFollowUpEventRepositoryContract() { return createRepositoryContract('followUpEventRepository', ['listByStudentId', 'record']); }
