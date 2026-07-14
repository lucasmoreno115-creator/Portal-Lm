import test from 'node:test'; import assert from 'node:assert/strict';
import { REQUIRED_FLAGS, verifyLmPremiumRc1 } from '../scripts/verify-lm-premium-rc1.mjs';
test('RC1 verify inventories required Premium flags',()=>{assert.deepEqual(REQUIRED_FLAGS,['PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED','PREMIUM_NUTRITION_PLAN_WORKFLOW_ENABLED']); const r=verifyLmPremiumRc1({schema:{},flags:{}}); assert.ok(r.featureFlags.missingFlags.includes('PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED'));});
