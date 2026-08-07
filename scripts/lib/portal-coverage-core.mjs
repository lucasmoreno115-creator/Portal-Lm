import path from 'node:path';
import { mkdir, realpath, writeFile } from 'node:fs/promises';

export const HOME_PAGE='/portal-premium-home.html';
export const STATES=Object.freeze(['HOME_DEFAULT','PWA_INSTALL_AVAILABLE','PUSH_ENABLED','PUSH_BLOCKED','PUSH_UNSUPPORTED','WEEKLY_PLAN_EMPTY','WEEKLY_PLAN_ERROR','FULL_INTERACTION']);
const SCENARIOS=['COLD','WARM'], INTERACTIONS=['PWA_MODAL_OPEN_CLOSE'];
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===keys.toSorted().join();
const finiteNonnegative=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function validateCoverageProfile(p){
  if(!exact(p,['schemaVersion','environment','page','runs','viewports','network','cpuSlowdownMultiplier','scenarios','states','interactions','quietWindowMs']))throw Error('Perfil S0.7: propriedade extra ou ausente');
  if(p.schemaVersion!=='1.0.0'||p.environment!=='LAB_STUBBED'||p.page!==HOME_PAGE||p.page.includes('..')||p.page.startsWith('//')||/^[a-z]+:/i.test(p.page))throw Error('Perfil S0.7: página inválida');
  if(!Number.isInteger(p.runs)||p.runs<3)throw Error('Perfil S0.7: runs inválidas');
  if(JSON.stringify(p.scenarios)!==JSON.stringify(SCENARIOS))throw Error('Perfil S0.7: cenários inválidos');
  if(!Array.isArray(p.states)||new Set(p.states).size!==p.states.length||JSON.stringify(p.states)!==JSON.stringify(STATES))throw Error('Perfil S0.7: matriz de estados inválida');
  if(!Array.isArray(p.interactions)||p.interactions.some(x=>!INTERACTIONS.includes(x)))throw Error('Perfil S0.7: interação inválida');
  if(!Array.isArray(p.viewports)||p.viewports.length!==2)throw Error('Perfil S0.7: viewports inválidos');
  for(const v of p.viewports){if(!exact(v,['name','width','height','deviceScaleFactor','mobile'])||!['mobile','desktop'].includes(v.name)||typeof v.mobile!=='boolean'||![v.width,v.height,v.deviceScaleFactor].every(finiteNonnegative))throw Error('Perfil S0.7: viewport inválido');}
  if(p.viewports[0].name!=='mobile'||p.viewports[0].width!==390||p.viewports[0].height!==844||p.viewports[1].name!=='desktop')throw Error('Perfil S0.7: matriz de viewport inválida');
  if(!exact(p.network,['latencyMs','downloadBytesPerSecond','uploadBytesPerSecond'])||![...Object.values(p.network),p.cpuSlowdownMultiplier,p.quietWindowMs].every(finiteNonnegative))throw Error('Perfil S0.7: número inválido');
  return p;
}
export function mergeRanges(ranges,sourceLength){
  if(sourceLength!==null&&sourceLength!==undefined&&(!Number.isInteger(sourceLength)||sourceLength<0))throw Error('sourceLength inválido');
  const normalized=ranges.map(r=>{if(!r||!Number.isInteger(r.startOffset)||!Number.isInteger(r.endOffset)||r.startOffset<0||r.endOffset<0||r.endOffset<r.startOffset)throw Error('Range inválido');return {startOffset:sourceLength==null?r.startOffset:Math.min(r.startOffset,sourceLength),endOffset:sourceLength==null?r.endOffset:Math.min(r.endOffset,sourceLength)};}).sort((a,b)=>a.startOffset-b.startOffset||a.endOffset-b.endOffset);
  const out=[];for(const r of normalized){const last=out.at(-1);if(last&&r.startOffset<=last.endOffset)last.endOffset=Math.max(last.endOffset,r.endOffset);else out.push({...r});}return out;
}
export const rangeLength=r=>r.reduce((n,x)=>n+x.endOffset-x.startOffset,0);
export function coverageSummary(ranges,sourceLength){if(sourceLength==null)return{sourceLength:null,observedCodeUnits:null,notObservedCodeUnits:null,observedPercent:null};const merged=mergeRanges(ranges,sourceLength),observed=rangeLength(merged);return{sourceLength,observedCodeUnits:observed,notObservedCodeUnits:sourceLength-observed,observedPercent:sourceLength===0?null:Math.max(0,Math.min(100,observed/sourceLength*100))};}
export function sanitizeUrl(raw){try{const u=new URL(raw,'http://127.0.0.1');return u.protocol==='http:'&&u.hostname==='127.0.0.1'?u.pathname:'[EXTERNAL]';}catch{return '[INVALID]';}}
export function isInternalScript(url){return !url||/^(chrome(?:-extension)?|devtools|extensions?|eval):/i.test(url);}
export function sanitizeValue(value){const text=JSON.stringify(value);if(/authorization|bearer|cookie|localStorage|sessionStorage|\btoken\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text))throw Error('Dado sensível bloqueado');return value;}
export const median=v=>{const a=v.filter(Number.isFinite).toSorted((x,y)=>x-y);return a.length?(a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2):null};
export const p75=v=>{const a=v.filter(Number.isFinite).toSorted((x,y)=>x-y);return a.length?a[Math.ceil(a.length*.75)-1]:null};
export function reportStatus(runs,expected){if(!runs.length||runs.some(r=>r.completionStatus==='FAILED'))return'FAILED';if(runs.length!==expected||runs.some(r=>r.completionStatus!=='MEASURED'))return'INCOMPLETE';return'MEASURED';}
export function aggregateResources(runs){const map=new Map();for(const run of runs)for(const r of run.resources||[]){const key=`${run.scenario}|${run.viewport.name}|${r.type}|${r.url}`,x=map.get(key)||{url:r.url,type:r.type,scenario:run.scenario,viewport:run.viewport.name,runsObserved:0,states:new Set(),transfer:[],decoded:[]};x.runsObserved++;x.states.add(run.state);x.transfer.push(r.transferBytes);x.decoded.push(r.decodedBodyBytes);map.set(key,x);}return[...map.values()].map(x=>({...x,states:[...x.states].sort(),medianTransferBytes:median(x.transfer),p75TransferBytes:p75(x.transfer),medianDecodedBodyBytes:median(x.decoded),p75DecodedBodyBytes:p75(x.decoded)})).sort((a,b)=>a.scenario.localeCompare(b.scenario)||a.viewport.localeCompare(b.viewport)||a.url.localeCompare(b.url));}
export async function safeWriteS07(root,name,data){await mkdir(root,{recursive:true});const real=await realpath(root),target=path.resolve(real,name);if(path.dirname(target)!==real)throw Error('Escrita fora de artifacts/performance/s0.7 bloqueada');await writeFile(target,data);return target;}
export const exitCodeForStatus=s=>s==='MEASURED'?0:1;
