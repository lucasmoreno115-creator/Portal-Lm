import path from 'node:path';
import { realpath, mkdir, writeFile } from 'node:fs/promises';

export const AUTHORIZED_PAGES = Object.freeze(['/portal-login.html','/portal-premium-home.html','/portal-checkin.html','/portal-plano-alimentar.html','/portal-progressao.html']);
export const TYPES = Object.freeze(['document','script','stylesheet','image','font','other']);

export function validateProfile(p) {
  const keys=['schemaVersion','runs','viewport','network','cpuSlowdownMultiplier','scenarios','pages'];
  if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).sort().join()!==keys.sort().join()) throw Error('Perfil: propriedades inválidas');
  if(p.schemaVersion!=='1.0.0'||!Number.isInteger(p.runs)||p.runs<3) throw Error('Perfil: schemaVersion/runs inválido');
  const exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===k.sort().join();
  if(!exact(p.viewport,['width','height','deviceScaleFactor','mobile'])||!exact(p.network,['latencyMs','downloadBytesPerSecond','uploadBytesPerSecond'])) throw Error('Perfil: viewport/network inválido');
  for(const n of [p.viewport.width,p.viewport.height,p.viewport.deviceScaleFactor,p.network.latencyMs,p.network.downloadBytesPerSecond,p.network.uploadBytesPerSecond,p.cpuSlowdownMultiplier]) if(typeof n!=='number'||!Number.isFinite(n)||n<0) throw Error('Perfil: valor numérico inválido');
  if(typeof p.viewport.mobile!=='boolean'||JSON.stringify(p.scenarios)!=='["COLD","WARM"]') throw Error('Perfil: cenários inválidos');
  if(!Array.isArray(p.pages)||new Set(p.pages).size!==p.pages.length||p.pages.some(x=>!AUTHORIZED_PAGES.includes(x)||!x.startsWith('/')||x.startsWith('//'))) throw Error('Perfil: páginas inválidas');
  if(JSON.stringify(p.pages)!==JSON.stringify(AUTHORIZED_PAGES)) throw Error('Perfil: lista versionada incompleta');
  return p;
}
export function quantile(values,q){const a=values.filter(Number.isFinite).toSorted((x,y)=>x-y);if(!a.length)return null;return a[Math.ceil(q*a.length)-1];}
export const median=v=>{const a=v.filter(Number.isFinite).toSorted((x,y)=>x-y);return a.length?(a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2):null};
export const p75=v=>quantile(v,.75);
export function nullable(v){return typeof v==='number'&&Number.isFinite(v)?v:null;}
export function sanitizeUrl(raw){const u=new URL(raw,'http://127.0.0.1');for(const key of [...u.searchParams.keys()])u.searchParams.set(key,'[REDACTED]');return `${u.pathname}${u.search}`;}
export function assertLocalUrl(raw,port){const u=new URL(raw);const effectivePort=u.port||(u.protocol==='http:'?'80':'443');if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||(port&&effectivePort!==String(port)))throw Error(`Request externo bloqueado: ${sanitizeUrl(raw)}`);return u;}
export function resourceType(type='Other'){const x=type.toLowerCase();return TYPES.includes(x)?x:'other';}
export function aggregateBytes(resources, field='transferBytes'){const out=Object.fromEntries(TYPES.map(t=>[t,0]));for(const r of resources){const value=r[field];if(Number.isFinite(value))out[resourceType(r.type)]+=value;}return out;}
export function aggregateRuns(runs){const names=['ttfb','fcp','lcp','cls','domContentLoaded','load','longTaskCount','longTaskDuration','requestCount','apiRequestCount','failedRequestCount','transferBytes','encodedBodyBytes','decodedBodyBytes'];return Object.fromEntries(names.map(n=>[n,{median:median(runs.map(r=>r.metrics?.[n])),p75:p75(runs.map(r=>r.metrics?.[n]))}]));}

export function classifyRun(run) {
  const errors = [...(run.errors || [])];
  const warnings = [...(run.warnings || [])];
  if (run.externalRequestAttempted || (run.externalBlocked || []).length) errors.push('external_request_attempted');
  if (run.mainDocumentLoaded === false) errors.push('main_document_not_loaded');
  if (!Number.isInteger(run.mainDocumentStatus) || run.mainDocumentStatus < 200 || run.mainDocumentStatus >= 300) errors.push('main_document_status_invalid');
  if (run.unexpectedRedirect) errors.push('unexpected_redirect');
  if (run.loadEventFired === false) errors.push('load_event_missing');
  if (run.runtimeEvaluateFailed) errors.push('runtime_evaluate_failed');
  if (run.cdpError) errors.push('cdp_error');
  if (!run.metrics || !Array.isArray(run.resources) || !Array.isArray(run.failedRequests)) errors.push('missing_required_structures');
  if ((run.failedRequests || []).some(r => r.resourceType === 'Document' || r.isMainDocument)) errors.push('main_document_network_failed');
  const localApiFailures = (run.failedRequests || []).filter(r => r.isLocalApi || r.url?.startsWith('/api/'));
  if (localApiFailures.length) warnings.push('local_api_request_failed');
  const secondaryFailures = (run.failedRequests || []).filter(r => !(r.resourceType === 'Document' || r.isMainDocument) && !(r.isLocalApi || r.url?.startsWith('/api/')));
  if (secondaryFailures.length) warnings.push('secondary_resource_failed');
  const uniqueErrors = [...new Set(errors)].sort();
  const uniqueWarnings = [...new Set(warnings)].sort();
  return { completionStatus: uniqueErrors.length ? 'FAILED' : uniqueWarnings.length ? 'INCOMPLETE' : 'MEASURED', errors: uniqueErrors, warnings: uniqueWarnings };
}
export function expectedRunCount(profile){return profile.pages.length*profile.scenarios.length*profile.runs;}
export function reportStatus(pages, fatal=false, profile=null){if(fatal||!pages.length)return 'FAILED';if(profile){if(pages.length!==profile.pages.length)return 'FAILED';for(const page of profile.pages){const found=pages.find(p=>p.page===page);if(!found)return 'FAILED';for(const scenario of profile.scenarios){const s=found.scenarios.find(x=>x.scenario===scenario);if(!s||s.runs.length!==profile.runs)return 'FAILED';}}}let incomplete=false;for(const p of pages)for(const s of p.scenarios)for(const r of s.runs){const status=r.completionStatus||classifyRun(r).completionStatus;if(status==='FAILED')return 'FAILED';if(status==='INCOMPLETE')incomplete=true;}return incomplete?'INCOMPLETE':'MEASURED';}
export function exitCodeForStatus(status){return status==='FAILED'?1:0;}

export function sortReport(report){report.pages.sort((a,b)=>a.page.localeCompare(b.page));for(const p of report.pages){p.scenarios.sort((a,b)=>a.scenario.localeCompare(b.scenario));for(const s of p.scenarios)for(const r of s.runs)r.resources.sort((a,b)=>a.url.localeCompare(b.url));}report.warnings.sort();return report;}
export async function safeWrite(root,name,data){await mkdir(root,{recursive:true});const canonical=await realpath(root);const target=path.resolve(canonical,name);if(path.dirname(target)!==canonical)throw Error('Escrita fora de artifacts/performance bloqueada');await writeFile(target,data);return target;}
export async function withCleanup(work,cleanups){try{return await work();}finally{for(const fn of [...cleanups].reverse())await fn();}}
