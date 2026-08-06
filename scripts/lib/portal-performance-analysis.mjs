import { aggregateRuns } from './portal-performance-core.mjs';

export const EXPECTED_PAGES = Object.freeze(['/portal-login.html','/portal-premium-home.html','/portal-checkin.html','/portal-plano-alimentar.html','/portal-progressao.html']);
export const EXPECTED_SCENARIOS = Object.freeze(['COLD','WARM']);
export const METRICS = Object.freeze(['ttfb','fcp','lcp','cls','domContentLoaded','load','longTaskCount','longTaskDuration','requestCount','apiRequestCount','failedRequestCount','transferBytes','encodedBodyBytes','decodedBodyBytes']);
const SHA = /^[0-9a-f]{40}$/;
const EVENTS = new Set(['pull_request','workflow_dispatch','local']);
const RECT_KEYS = ['bottom','height','left','right','top','width','x','y'];
const isNumberOrNull = value => value === null || (typeof value === 'number' && Number.isFinite(value));
const invalid = message => { throw new Error(`Relatório inválido: ${message}`); };
const sameNumber = (a,b) => a === b || (Number.isNaN(a) && Number.isNaN(b));
const quantile = (values,q) => { const sorted=values.filter(Number.isFinite).toSorted((a,b)=>a-b); return sorted.length ? sorted[Math.ceil(sorted.length*q)-1] : null; };
const median = values => { const a=values.filter(Number.isFinite).toSorted((x,y)=>x-y); return a.length ? (a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2) : null; };

export function buildPerformanceSource({checkoutSha,chromeVersion,env=process.env,nodeVersion=process.version}) {
  if (env.PERFORMANCE_CHECKOUT_SHA && env.PERFORMANCE_CHECKOUT_SHA !== checkoutSha) invalid('checkoutSha não corresponde ao git rev-parse HEAD');
  const eventName=env.PERFORMANCE_EVENT_NAME || 'local';
  const ref=env.PERFORMANCE_REF || 'local';
  const headSha=env.PERFORMANCE_HEAD_SHA || (eventName==='local'?checkoutSha:null);
  const baseSha=env.PERFORMANCE_BASE_SHA || (eventName==='workflow_dispatch'&&ref==='refs/heads/main'?checkoutSha:null);
  const workflowSha=env.GITHUB_SHA || (eventName==='workflow_dispatch'?headSha:null);
  const canonicalMainSha=eventName==='workflow_dispatch'&&ref==='refs/heads/main'?checkoutSha:null;
  const source={baseSha,headSha,checkoutSha,workflowSha,canonicalMainSha,ref,eventName,nodeVersion,chromeVersion:chromeVersion??null};
  validateSource(source); return source;
}

export function sanitizeSelectorValue(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 240 || !value.trim()) return null;
  if (/<|@|\b(innerHTML|textContent|value|email|token|auth|password|secret|student|aluno|nome)\b/i.test(value)) return null;
  const clean = value.split('>').slice(-3).map(part => part.trim().replace(/[^a-zA-Z0-9_.#:-]/g,'').slice(0,70)).filter(Boolean).join('>');
  return clean && clean.length <= 220 ? clean : null;
}
export function sanitizeSelector({tag='div',id='',classes=[],parents=[]}={}) {
  const part = item => `${item.tag || 'div'}${item.id ? `#${item.id}` : ''}${(item.classes || []).slice(0,2).map(x=>`.${x}`).join('')}`;
  return sanitizeSelectorValue([...parents.slice(-2),{tag,id,classes}].map(part).join('>'));
}
export function delta(cold,warm) {
  const absolute = isNumberOrNull(cold) && isNumberOrNull(warm) && cold !== null && warm !== null ? cold-warm : null;
  return { absolute, percentage: absolute === null || warm === 0 ? null : absolute/warm*100 };
}
export const exitCodeForAnalysis = status => status === 'MEASURED' ? 0 : 1;
function validateSource(source) {
  const exact=['baseSha','canonicalMainSha','checkoutSha','chromeVersion','eventName','headSha','nodeVersion','ref','workflowSha'];
  if (!source || Object.keys(source).toSorted().join() !== exact.toSorted().join()) invalid('source');
  if (!EVENTS.has(source.eventName)) invalid('eventName');
  if (typeof source.ref !== 'string' || !source.ref || /[\s\0]/.test(source.ref)) invalid('ref');
  for (const key of ['baseSha','headSha','checkoutSha','workflowSha','canonicalMainSha']) if (source[key] !== null && !SHA.test(source[key])) invalid(`${key} SHA`);
  if (!SHA.test(source.checkoutSha) || !SHA.test(source.headSha)) invalid('checkoutSha/headSha obrigatórios');
  if (source.eventName === 'pull_request' && (!SHA.test(source.baseSha) || !SHA.test(source.workflowSha) || source.canonicalMainSha !== null)) invalid('proveniência pull_request');
  if (source.eventName === 'workflow_dispatch') {
    if (!SHA.test(source.workflowSha)) invalid('workflowSha workflow_dispatch');
    if (source.ref === 'refs/heads/main' && (source.baseSha !== source.checkoutSha || source.headSha !== source.checkoutSha || source.canonicalMainSha !== source.checkoutSha)) invalid('main canônica');
    if (source.ref !== 'refs/heads/main' && source.canonicalMainSha !== null) invalid('branch não é main');
  }
  if (source.eventName === 'local' && (source.baseSha !== null || source.workflowSha !== null || source.canonicalMainSha !== null || source.headSha !== source.checkoutSha)) invalid('proveniência local');
  if (typeof source.nodeVersion !== 'string' || !(typeof source.chromeVersion === 'string' || source.chromeVersion === null)) invalid('versões');
}
function validateRect(rect) {
  if (rect === null) return;
  if (!rect || Array.isArray(rect) || Object.keys(rect).toSorted().join() !== RECT_KEYS.join()) invalid('layout rect');
  for (const key of RECT_KEYS) if (!isNumberOrNull(rect[key])) invalid(`layout rect ${key}`);
}
function validateLayout(events) {
  if (!Array.isArray(events)) invalid('layoutShiftEvents');
  for (const event of events) {
    if (!event || Object.keys(event).toSorted().join() !== ['hadRecentInput','sources','startTime','value'].join()) invalid('layout event');
    if (!isNumberOrNull(event.startTime) || typeof event.value !== 'number' || !Number.isFinite(event.value) || event.value < 0 || typeof event.hadRecentInput !== 'boolean' || !(event.sources === null || Array.isArray(event.sources))) invalid('layout event values');
    for (const source of event.sources || []) {
      if (!source || Object.keys(source).toSorted().join() !== ['currentRect','nodeSelector','previousRect'].join()) invalid('layout source');
      if (!(source.nodeSelector === null || typeof source.nodeSelector === 'string')) invalid('nodeSelector');
      validateRect(source.previousRect); validateRect(source.currentRect);
    }
  }
}
function validateResources(resources) {
  if (!Array.isArray(resources)) invalid('resources');
  for (const resource of resources) {
    if (!resource || typeof resource.url !== 'string' || !resource.url.startsWith('/') || typeof resource.type !== 'string' || !isNumberOrNull(resource.transferBytes) || !isNumberOrNull(resource.decodedBodyBytes) || typeof resource.fromCache !== 'boolean' || !isNumberOrNull(resource.status)) invalid('resource');
  }
}
function validateFailedRequests(requests) {
  if (!Array.isArray(requests)) invalid('failedRequests');
  for (const request of requests) if (!request || typeof request.url !== 'string' || !('reason' in request || 'status' in request)) invalid('failedRequest');
}
export function validatePerformanceReport(report) {
  if (!report || report.schemaVersion !== '1.0.0' || report.environment !== 'LAB_STUBBED') invalid('schemaVersion/environment');
  validateSource(report.source);
  if (!report.profile || report.profile.runs !== 5 || JSON.stringify(report.profile.pages) !== JSON.stringify(EXPECTED_PAGES) || JSON.stringify(report.profile.scenarios) !== JSON.stringify(EXPECTED_SCENARIOS)) invalid('profile');
  if (!Array.isArray(report.pages) || report.pages.length !== 5 || new Set(report.pages.map(x=>x.page)).size !== 5 || report.pages.some(x=>!EXPECTED_PAGES.includes(x.page))) invalid('inventário de páginas');
  if (!['MEASURED','INCOMPLETE','FAILED'].includes(report.status)) invalid('status');
  for (const pageName of EXPECTED_PAGES) {
    const page=report.pages.find(x=>x.page===pageName);
    if (!page || !Array.isArray(page.scenarios) || page.scenarios.length !== 2 || new Set(page.scenarios.map(x=>x.scenario)).size !== 2 || page.scenarios.some(x=>!EXPECTED_SCENARIOS.includes(x.scenario))) invalid(`cenários ${pageName}`);
    for (const scenarioName of EXPECTED_SCENARIOS) {
      const scenario=page.scenarios.find(x=>x.scenario===scenarioName);
      if (!Array.isArray(scenario.runs) || scenario.runs.length !== 5 || scenario.runs.map(x=>x.run).toSorted((a,b)=>a-b).join() !== '1,2,3,4,5') invalid(`runs ${pageName}/${scenarioName}`);
      for (const run of scenario.runs) {
        if (run.page !== pageName || run.scenario !== scenarioName || !['MEASURED','INCOMPLETE','FAILED'].includes(run.completionStatus) || !run.metrics) invalid('coerência da run');
        for (const key of METRICS) if (!(key in run.metrics) || !isNumberOrNull(run.metrics[key])) invalid(`métrica ${key}`);
        validateResources(run.resources); validateFailedRequests(run.failedRequests); validateLayout(run.layoutShiftEvents);
      }
      const calculated=aggregateRuns(scenario.runs);
      if (!scenario.aggregate) invalid('aggregate');
      for (const key of METRICS) if (!scenario.aggregate[key] || !sameNumber(scenario.aggregate[key].median,calculated[key].median) || !sameNumber(scenario.aggregate[key].p75,calculated[key].p75)) invalid(`aggregate contraditório ${key}`);
    }
  }
  const statuses=report.pages.flatMap(p=>p.scenarios.flatMap(s=>s.runs.map(r=>r.completionStatus)));
  const expected=statuses.includes('FAILED')?'FAILED':statuses.includes('INCOMPLETE')?'INCOMPLETE':'MEASURED';
  if (report.status !== expected) invalid('status contradiz runs');
  return report;
}
function classification(type,cacheHits) { return type==='stylesheet'||type==='script'?'candidato para coverage':type==='image'?'candidato para compressão':cacheHits?'candidato para cache':'sem evidência suficiente'; }
function buildResources(report) {
  const byPage=[]; const global=new Map();
  for (const page of report.pages) for (const scenario of page.scenarios) {
    const local=new Map();
    for (const run of scenario.runs) for (const resource of run.resources) {
      const values=local.get(resource.url)||[]; values.push(resource); local.set(resource.url,values);
      const key=`${scenario.scenario}\0${resource.url}`, group=global.get(key)||{scenario:scenario.scenario,url:resource.url,values:[],pages:new Set()};group.values.push(resource);group.pages.add(page.page);global.set(key,group);
    }
    for (const [url,values] of local) byPage.push({page:page.page,scenario:scenario.scenario,url,medianTransferBytes:median(values.map(x=>x.transferBytes)),p75TransferBytes:quantile(values.map(x=>x.transferBytes),.75),medianDecodedBodyBytes:median(values.map(x=>x.decodedBodyBytes)),type:values[0].type,cacheHitCount:values.filter(x=>x.fromCache).length,status:[...new Set(values.map(x=>x.status))].toSorted(),classification:classification(values[0].type,values.filter(x=>x.fromCache).length),removalAuthorized:false});
  }
  byPage.sort((a,b)=>a.page.localeCompare(b.page)||a.scenario.localeCompare(b.scenario)||(b.p75TransferBytes??-Infinity)-(a.p75TransferBytes??-Infinity)||a.url.localeCompare(b.url));
  const ranking=[...global.values()].map(group=>{const transfers=group.values.map(x=>x.transferBytes);return{scenario:group.scenario,url:group.url,medianTransferBytes:median(transfers),p75TransferBytes:quantile(transfers,.75),totalObservedTransferBytes:transfers.some(Number.isFinite)?transfers.filter(Number.isFinite).reduce((a,b)=>a+b,0):null,medianDecodedBodyBytes:median(group.values.map(x=>x.decodedBodyBytes)),pagesPresent:[...group.pages].toSorted(),pageCount:group.pages.size,requestOccurrences:group.values.length,cacheHitCount:group.values.filter(x=>x.fromCache).length,status:[...new Set(group.values.map(x=>x.status))].toSorted(),type:group.values[0].type,classification:classification(group.values[0].type,group.values.filter(x=>x.fromCache).length),removalAuthorized:false}});
  ranking.sort((a,b)=>(b.totalObservedTransferBytes??-Infinity)-(a.totalObservedTransferBytes??-Infinity)||(b.p75TransferBytes??-Infinity)-(a.p75TransferBytes??-Infinity)||a.url.localeCompare(b.url)||a.scenario.localeCompare(b.scenario));
  return {resourcesByPage:byPage,globalResourceRanking:ranking};
}
const descending=(rows,key)=>rows.toSorted((a,b)=>(b[key]??-Infinity)-(a[key]??-Infinity)||a.page.localeCompare(b.page));
function buildPageRanking(report) {
  const rows=report.pages.map(page=>{const scenarios={};for(const scenario of page.scenarios)scenarios[scenario.scenario]={transferBytesMedian:scenario.aggregate.transferBytes.median,transferBytesP75:scenario.aggregate.transferBytes.p75,decodedBodyBytesMedian:scenario.aggregate.decodedBodyBytes.median,requestCountMedian:scenario.aggregate.requestCount.median,failedRequestCount:scenario.runs.reduce((n,r)=>n+r.metrics.failedRequestCount,0),fcpP75:scenario.aggregate.fcp.p75,lcpP75:scenario.aggregate.lcp.p75,clsP75:scenario.aggregate.cls.p75,loadP75:scenario.aggregate.load.p75,longTaskCountP75:scenario.aggregate.longTaskCount.p75,completionStatus:scenario.runs.some(r=>r.completionStatus==='FAILED')?'FAILED':scenario.runs.some(r=>r.completionStatus==='INCOMPLETE')?'INCOMPLETE':'MEASURED'};return{page:page.page,scenarios}});
  const cold=rows.map(x=>({page:x.page,...x.scenarios.COLD}));return{pages:rows.toSorted((a,b)=>a.page.localeCompare(b.page)),byColdTransfer:descending(cold,'transferBytesP75'),byColdLcp:descending(cold,'lcpP75'),byColdCls:descending(cold,'clsP75'),byRequests:descending(cold,'requestCountMedian'),incompleteOrFailed:cold.filter(x=>x.completionStatus!=='MEASURED').toSorted((a,b)=>a.page.localeCompare(b.page))};
}
function finding(base){return{...base,comparator:base.comparator??null,environmentLimitation:'LAB_STUBBED não comprova staging ou produção.',optimizationAllowed:false};}
export function analyzePerformanceReport(input) {
  const report=validatePerformanceReport(structuredClone(input)); const findings=[];const layoutShiftElements=new Map();const layoutShiftSummary={totalLayoutShiftEvents:0,eventsWithSources:0,eventsWithoutSources:0,sourcesSanitized:0,sourcesDiscarded:0};
  if(report.status!=='MEASURED')findings.push(finding({id:`status-${report.status.toLowerCase()}`,page:null,scenario:null,category:'measurement-integrity',metric:'status',actual:report.status,priority:'P0',evidenceLevel:'INSUFFICIENT',confidenceReason:'A baseline não terminou MEASURED.',suggestedInvestigation:'Corrigir a medição antes de declarar rankings definitivos.'}));
  const comparisons=[];
  for(const page of report.pages){const cold=page.scenarios.find(x=>x.scenario==='COLD'),warm=page.scenarios.find(x=>x.scenario==='WARM'),metrics={};for(const key of METRICS)metrics[key]={median:{COLD:cold.aggregate[key].median,WARM:warm.aggregate[key].median,...delta(cold.aggregate[key].median,warm.aggregate[key].median)},p75:{COLD:cold.aggregate[key].p75,WARM:warm.aggregate[key].p75,...delta(cold.aggregate[key].p75,warm.aggregate[key].p75)}};comparisons.push({page:page.page,metrics});for(const scenario of page.scenarios){for(const run of scenario.runs){for(const request of run.failedRequests)findings.push(finding({id:`request-${findings.length+1}`,page:page.page,scenario:scenario.scenario,category:'measurement-integrity',metric:'failedRequest',actual:request.status??request.reason,priority:'P0',evidenceLevel:'STRONG_LAB',confidenceReason:'Request local observado.',suggestedInvestigation:'Confirmar contrato e infraestrutura local.'}));for(const event of run.layoutShiftEvents){if(event.hadRecentInput)continue;layoutShiftSummary.totalLayoutShiftEvents++;if(event.sources?.length)layoutShiftSummary.eventsWithSources++;else layoutShiftSummary.eventsWithoutSources++;for(const source of event.sources||[]){const selector=sanitizeSelectorValue(source.nodeSelector);if(!selector){layoutShiftSummary.sourcesDiscarded++;continue}layoutShiftSummary.sourcesSanitized++;const item=layoutShiftElements.get(selector)||{selector,count:0,contribution:0};item.count++;item.contribution+=event.value;layoutShiftElements.set(selector,item)}}}const cls=scenario.runs.map(x=>x.metrics.cls);if(cls.filter(x=>Number.isFinite(x)&&x>0).length>=3)findings.push(finding({id:`cls-${page.page}-${scenario.scenario}`,page:page.page,scenario:scenario.scenario,category:'visual-experience',metric:'cls',actual:scenario.aggregate.cls.p75,priority:'P1',evidenceLevel:'MODERATE_LAB',confidenceReason:'CLS repetido nas cinco runs controladas.',suggestedInvestigation:'Inspecionar fontes sanitizadas do deslocamento.'}))}}
  const resources=buildResources(report);for(const resource of resources.globalResourceRanking.slice(0,20))findings.push(finding({id:`resource-${findings.length+1}`,page:null,scenario:resource.scenario,category:'resource-cost',metric:'totalObservedTransferBytes',actual:resource.totalObservedTransferBytes,comparator:resource.url,priority:'P2',evidenceLevel:'STRONG_LAB',confidenceReason:'Custo agregado diretamente no laboratório.',suggestedInvestigation:`Medir ${resource.classification.replace('candidato para ','')}; não remover automaticamente.`}));findings.push(finding({id:'staging-authenticated',page:null,scenario:null,category:'production-hypothesis',metric:'realLatency',actual:null,priority:'P3',evidenceLevel:'WEAK_PRODUCTION',confidenceReason:'API e autenticação são substituídas.',suggestedInvestigation:'Executar staging autenticado com dados fictícios.'}));findings.sort((a,b)=>a.priority.localeCompare(b.priority)||String(a.page).localeCompare(String(b.page))||a.id.localeCompare(b.id));return{schemaVersion:'1.0.0',environment:report.environment,source:report.source,status:report.status,validity:{pages:5,scenarios:10,runs:50},comparisons,pageRanking:buildPageRanking(report),...resources,layoutShiftSummary,layoutShiftElements:[...layoutShiftElements.values()].toSorted((a,b)=>b.contribution-a.contribution||a.selector.localeCompare(b.selector)),findings,coverage:{status:'NEXT_EXPERIMENT',limitation:'Coverage representa apenas o fluxo; remoção não autorizada.'},optimizationAuthorized:false};
}
const display=value=>value===null?'indisponível':value;
function rankingTable(title,rows,key,label){return[`## ${title}`,'',`Ordenado por **${label}** decrescente; empates por página.`,`| Posição | Página | ${label} |`,'|---:|---|---:|',...rows.map((row,index)=>`| ${index+1} | ${row.page} | ${display(row[key])} |`),''];}
export function analysisMarkdown(a) {const definitive=a.status==='MEASURED';const lines=['# Análise de performance do Portal do Aluno','',`## Resumo executivo`,`Status: **${a.status}**. ${definitive?'Baseline estrutural concluída.':'Baseline não concluída; rankings são diagnósticos provisórios.'}`,'','## Validade da baseline',`5 páginas, 10 cenários e 50 runs. checkoutSha: \`${a.source.checkoutSha}\`; headSha: \`${a.source.headSha}\`; baseSha: \`${a.source.baseSha??'null'}\`; workflowSha: \`${a.source.workflowSha??'null'}\`; canonicalMainSha: \`${a.source.canonicalMainSha??'null'}\`. Merge ref não é main.`,'','## Limitações do LAB_STUBBED','Não comprova autenticação, API, Worker/D1, rede ou cache de produção.','',...rankingTable('Ranking por transferência COLD',a.pageRanking.byColdTransfer,'transferBytesP75','Transferência p75'),...rankingTable('Ranking por LCP COLD',a.pageRanking.byColdLcp,'lcpP75','LCP p75'),...rankingTable('Ranking por CLS COLD',a.pageRanking.byColdCls,'clsP75','CLS p75'),...rankingTable('Ranking por quantidade de requests COLD',a.pageRanking.byRequests,'requestCountMedian','Requests mediana'),'## Páginas incompletas ou falhas','',...(a.pageRanking.incompleteOrFailed.length?a.pageRanking.incompleteOrFailed.map(x=>`- ${x.page}: ${x.completionStatus}`):['- Nenhuma.']),'','## Requests falhos','',...(a.findings.filter(x=>x.metric==='failedRequest').map(x=>`- ${x.page} ${x.scenario}: ${x.actual}`).concat(a.findings.some(x=>x.metric==='failedRequest')?[]:['- Nenhum.'])),'','## Fontes do CLS','',`Eventos: ${a.layoutShiftSummary.totalLayoutShiftEvents}; com sources: ${a.layoutShiftSummary.eventsWithSources}; sem sources: ${a.layoutShiftSummary.eventsWithoutSources}; sources sanitizadas: ${a.layoutShiftSummary.sourcesSanitized}; descartadas: ${a.layoutShiftSummary.sourcesDiscarded}.`,...(a.layoutShiftElements.length?a.layoutShiftElements.map(x=>`- \`${x.selector}\`: ${x.count} eventos; contribuição ${x.contribution}.`):['- `null`: sem identificação segura; nenhuma causa inferida.']),'','## Ranking global de recursos','',`| Posição | Cenário | URL | Transferência total observada | p75 | Páginas |`,'|---:|---|---|---:|---:|---:|',...a.globalResourceRanking.slice(0,20).map((x,i)=>`| ${i+1} | ${x.scenario} | \`${x.url}\` | ${display(x.totalObservedTransferBytes)} | ${display(x.p75TransferBytes)} | ${x.pageCount} |`),'','## Evidência classificada',...a.findings.map(x=>`- ${x.id}: ${x.evidenceLevel}, ${x.priority}.`),'','## Backlog P0–P3',...['P0','P1','P2','P3'].map(p=>`- ${p}: ${a.findings.filter(x=>x.priority===p).map(x=>x.suggestedInvestigation).join(' / ')||'sem item confirmado'}`),'','## Itens sem evidência suficiente','- Custos reais de API, autenticação, Worker/D1 e produção.','','## Experimentos recomendados','- Coverage CDP e staging autenticado, sem remoção automática.','','## Autorização','**Nenhuma otimização foi autorizada ou implementada na S0.5.**',''];return lines.join('\n');}
