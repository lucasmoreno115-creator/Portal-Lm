import test from 'node:test'; import assert from 'node:assert/strict';
import { RC1_SMOKE_CONTRACTS, validateSmokeResponses } from '../scripts/smoke-lm-premium-rc1.mjs';
test('RC1 smoke contract covers admin and student status families',()=>{assert.ok(RC1_SMOKE_CONTRACTS.some(([,r])=>r.includes('workspace/summary'))); assert.ok(RC1_SMOKE_CONTRACTS.some(([,r])=>r.includes('student/premium/weekly-feedback'))); assert.ok(RC1_SMOKE_CONTRACTS.flatMap(([, ,s])=>s).includes(409));});
test('RC1 smoke response validator rejects unexpected status',()=>{const [method,route]=RC1_SMOKE_CONTRACTS[0]; assert.equal(validateSmokeResponses([{method,route,status:200}])[0].ok,true); assert.equal(validateSmokeResponses([{method,route,status:500}])[0].ok,false);});
