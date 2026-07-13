import { createRepositoryContract } from './create-repository-contract.js';
export function createNutritionPlanRepositoryContract() { return createRepositoryContract('nutritionPlanRepository', ['findActiveByStudentId', 'save']); }
