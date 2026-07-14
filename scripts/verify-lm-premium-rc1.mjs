#!/usr/bin/env node
import { auditLmPremiumRc1 } from './audit-lm-premium-rc1.mjs';
export const REQUIRED_TABLES=['premium_students','student_access','premium_anamnesis','student_checkins','nutrition_plans','premium_pending_items','premium_followup_entries','activity_timeline'];
export const REQUIRED_FLAGS=['PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED','PREMIUM_NUTRITION_PLAN_WORKFLOW_ENABLED'];
export function verifyLmPremiumRc1({schema={},data={},flags={}}={}){const missingTables=REQUIRED_TABLES.filter(t=>!schema[t]); const missingFlags=REQUIRED_FLAGS.filter(f=>!(f in flags)); const audit=auditLmPremiumRc1(data); return {ok:missingTables.length===0&&audit.ok,generatedAt:new Date().toISOString(),schema:{missingTables},featureFlags:{missingFlags,provided:Object.keys(flags)},audit};}
if(import.meta.url===`file://${process.argv[1]}`){const r=verifyLmPremiumRc1(); console.log(JSON.stringify(r,null,2)); process.exit(r.ok?0:1);}
