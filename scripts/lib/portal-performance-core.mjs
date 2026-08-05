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
export function aggregateBytes(resources){const out=Object.fromEntries(TYPES.map(t=>[t,0]));for(const r of resources)out[resourceType(r.type)]+=r.transferBytes||0;return out;}
export function aggregateRuns(runs){const names=['ttfb','fcp','lcp','cls','domContentLoaded','load','longTaskCount','longTaskDuration','requestCount','apiRequestCount','failedRequestCount','transferBytes','bodyBytes'];return Object.fromEntries(names.map(n=>[n,{median:median(runs.map(r=>r.metrics[n])),p75:p75(runs.map(r=>r.metrics[n]))}]));}
export function reportStatus(pages, fatal=false){if(fatal||!pages.length)return 'FAILED';return pages.some(p=>p.scenarios.some(s=>s.runs.some(r=>r.error||r.unexpectedRedirect)))?'INCOMPLETE':'MEASURED';}
export function sortReport(report){report.pages.sort((a,b)=>a.page.localeCompare(b.page));for(const p of report.pages){p.scenarios.sort((a,b)=>a.scenario.localeCompare(b.scenario));for(const s of p.scenarios)for(const r of s.runs)r.resources.sort((a,b)=>a.url.localeCompare(b.url));}report.warnings.sort();return report;}
export async function safeWrite(root,name,data){await mkdir(root,{recursive:true});const canonical=await realpath(root);const target=path.resolve(canonical,name);if(path.dirname(target)!==canonical)throw Error('Escrita fora de artifacts/performance bloqueada');await writeFile(target,data);return target;}
export async function withCleanup(work,cleanups){try{return await work();}finally{for(const fn of [...cleanups].reverse())await fn();}}
