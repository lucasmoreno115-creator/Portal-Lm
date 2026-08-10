import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { request, runSmoke } from '../scripts/qa-sprint7-staging-e2e.mjs';

const env = { QA_BASE_URL:'https://qa.example', QA_STUDENT_EMAIL:'student@example.test', QA_STUDENT_TOKEN:'student-token', QA_ADMIN_SESSION:'admin-session', QA_ADMIN_TOKEN:'admin-token' };
const json = (status, value) => ({ ok:status===200, status, responseBody:JSON.stringify(value), durationMs:1 });
const plan = { ok:true, data:{ title:'Plano', meals:[], substitutions:[], observations:'' } };

async function withServer(handler, fn) {
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); server.close(); await once(server, 'close'); }
}

test('public page accepts direct 200, 302 to 200, and 307 to 200 but rejects redirect to 404', async () => {
  await withServer((req,res) => {
    if (req.url === '/direct' || req.url === '/final') { res.writeHead(200).end('ok'); return; }
    if (req.url === '/missing') { res.writeHead(404).end('missing'); return; }
    const destinations = { '/temporary':'/final', '/preserve':'/final', '/bad':'/missing' };
    res.writeHead(req.url === '/preserve' ? 307 : 302, { location:destinations[req.url] }).end();
  }, async base => {
    for (const path of ['/direct','/temporary','/preserve']) assert.equal((await request(base,path)).ok,true);
    const bad = await request(base,'/bad'); assert.equal(bad.ok,false); assert.equal(bad.status,404);
  });
});

test('public page rejects redirect loops and timeouts', async () => {
  await withServer((req,res) => {
    if (req.url === '/loop') res.writeHead(302,{location:'/loop'}).end();
    else setTimeout(()=>res.writeHead(200).end('late'),100);
  }, async base => {
    assert.equal((await request(base,'/loop',{timeoutMs:500})).ok,false);
    const timedOut = await request(base,'/slow',{timeoutMs:20}); assert.equal(timedOut.ok,false); assert.equal(timedOut.status,null);
  });
});

function smokeRequest(workspace, portal = plan) {
  return async (path, options = {}) => {
    if (path === '/api/admin/premium/workspace') return workspace;
    if (path === '/api/portal/nutrition-plan' && options.headers) return json(200,portal);
    if (path === '/api/portal/nutrition-plan') return json(401,{ code:'UNAUTHORIZED' });
    return { ok:true, status:200, responseBody:'ok', durationMs:1 };
  };
}

test('Workspace 200 with valid JSON produces functional evidence', async () => {
  const report = await runSmoke({ env, requestFn:smokeRequest(json(200,{ ok:true, data:[] })) });
  assert.ok(report.evidence.some(item=>item.scope==='workspace' && /contrato JSON/.test(item.message)));
  assert.equal(report.failures.some(item=>item.scope==='professional-auth'),false);
});

test('expired admin session is an auth failure and QA fixture failure without functional evidence', async () => {
  const report = await runSmoke({ env, requestFn:smokeRequest(json(401,{ code:'ADMIN_SESSION_EXPIRED' })) });
  assert.ok(report.failures.some(item=>item.scope==='professional-auth'));
  assert.ok(report.failures.some(item=>item.scope==='qa-fixture' && item.code==='ADMIN_SESSION_EXPIRED'));
  assert.equal(report.evidence.some(item=>item.scope==='workspace'),false);
});

test('any valid JSON body on Workspace 401 cannot count as functional success', async () => {
  const report = await runSmoke({ env, requestFn:smokeRequest(json(401,{ ok:false, code:'OTHER_AUTH_ERROR' })) });
  assert.equal(report.evidence.some(item=>item.scope==='workspace'),false);
  assert.ok(report.failures.some(item=>item.scope==='professional-auth'));
});

test('current public nutrition contract succeeds without internal active fields', async () => {
  const report = await runSmoke({ env, requestFn:smokeRequest(json(200,{ ok:true }),plan) });
  assert.ok(report.evidence.some(item=>item.scope==='workspace-portal-integration'));
  assert.equal(report.failures.some(item=>item.scope==='workspace-portal-integration'),false);
});

test('invalid or absent expected plan fails the public contract assertion', async () => {
  for (const payload of [{ ok:true, data:null },{ ok:true, data:{ title:'Plano', meals:'invalid', substitutions:[] } }]) {
    const report = await runSmoke({ env, requestFn:smokeRequest(json(200,{ ok:true }),payload) });
    assert.ok(report.failures.some(item=>item.scope==='workspace-portal-integration'));
  }
});

test('Projeto LM remains one isolated compatibility request without Premium check-in logic', async () => {
  const calls=[];
  const requestFn=async(path,options)=>{ calls.push({path,options}); return smokeRequest(json(200,{ok:true}))(path,options); };
  const report=await runSmoke({env,requestFn});
  assert.equal(report.evidence.filter(item=>item.scope==='compatibility').length,1);
  assert.deepEqual(calls.filter(call=>call.path.startsWith('/projeto-lm')), [{path:'/projeto-lm/',options:{expectedStatus:[200]}}]);
  assert.equal(calls.some(call=>/checkin/i.test(call.path)),false);
});
