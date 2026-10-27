import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';

const home=fileURLToPath(new URL('../',import.meta.url));
const fixture=path.join(home,'fixtures/ax_multi_doc_v0');
const source=fs.readFileSync(path.join(fixture,'sales.csv'));
const producer=JSON.parse(fs.readFileSync(path.join(home,'fixtures/smax_p42/synthetic_v1.json'),'utf8'));
const form=(v1=producer,bytes=source)=>JSON.stringify({v1,source_csv_base64:bytes.toString('base64')});
async function boot(t){
  const server=createDashboardServer({packageRoot:fixture});
  const base=await listenDashboard(server,0);
  t.after(()=>new Promise(done=>server.close(done)));
  const secret=dashboardLaunchUrl(server).split('#session=')[1];
  return {base,secret,headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'}};
}
async function send(state,body=form(),headers={}){
  return fetch(state.base+'/api/smax-preview',{method:'POST',
    headers:{...state.headers,...headers},body});
}
test('P5.14 actual local API recomputes sales and keeps original dashboard unchanged',async t=>{
  const state=await boot(t);
  const a=await send(state);
  assert.equal(a.status,200);
  assert.equal(a.headers.get('cache-control'),'no-store');
  const result=await a.json();
  assert.equal(result.status,'CALCULATED_PREVIEW_NOT_APPROVED');
  assert.equal(result.orders,6);
  assert.equal(result.revenue_krw,'157000');
  assert.equal(result.units,'10');
  assert.equal(result.sku_totals.length,3);
  assert.equal(result.source_digest_verified,true);
  assert.equal(result.customer_data_approved,false);
  assert.equal(result.ax_package_created,false);
  assert.equal(result.importer_enabled,false);
  const overview=await fetch(state.base+'/api/overview',{headers:state.headers});
  assert.equal(overview.status,200);
  assert.equal((await overview.json()).dataset.revenue_krw,'157000');
});
test('P5.14 unauthenticated source upload denied BEFORE consuming body',async t=>{
  const state=await boot(t);
  const res=await fetch(state.base+'/api/smax-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:form()});
  assert.equal(res.status,401);
  assert.equal((await res.json()).error,'SESSION_REQUIRED');
});
test('P5.14 invalid session token rejected',async t=>{
  const state=await boot(t);
  const r=await send(state,form(),{Authorization:'Bearer '+'A'.repeat(43)});
  assert.equal(r.status,401);
});
test('P5.14 cross-origin browser POST refused even with valid token',async t=>{
  const state=await boot(t);
  const r=await send(state,form(),{Origin:'https://unauthorized.example'});
  assert.equal(r.status,403);
  assert.equal((await r.json()).error,'FORBIDDEN_ORIGIN');
});
test('P5.14 mismatched original CSV is not echoed and never creates approved import',async t=>{
  const state=await boot(t);
  const broken=Buffer.from(source);broken[broken.indexOf('30000')]=0x39;
  const r=await send(state,form(producer,broken));
  assert.equal(r.status,422);
  const data=await r.json();
  assert.deepEqual(data,{error:'SMAX_PREVIEW_UNVERIFIED'});
  assert.doesNotMatch(JSON.stringify(data),/O-1001|N-01|30000/);
});
test('P5.14 native review request remains HOLD and omits financial metrics',async t=>{
  const state=await boot(t);
  const v1=structuredClone(producer);
  const issue={field:'quantity',code:'INVALID_INTEGER'};
  v1.rows[0].status='NEEDS_REVIEW';v1.rows[0].issues=[issue];
  v1.review_queue=[{source_record:2,issues:[issue]}];
  v1.quality.review_rows=1;v1.quality.invalid_cells=1;
  const r=await send(state,form(v1));
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.status,'REVIEW_HOLD');
  assert.equal(data.revenue_krw,null);assert.equal(data.orders,null);
  assert.deepEqual(data.sku_totals,[]);
  assert.equal(data.ax_package_created,false);
});
test('P5.14 invalid JSON body gets 400 without raw parser diagnostics',async t=>{
  const state=await boot(t);
  const r=await send(state,'{"v1":');
  assert.equal(r.status,400);
  assert.deepEqual(await r.json(),{error:'INVALID_JSON'});
});
test('P5.14 unknown JSON fields, missing source and extra source denied',async t=>{
  const state=await boot(t);
  for(const body of [
    JSON.stringify({v1:producer}),
    JSON.stringify({v1:producer,source_csv_base64:source.toString('base64'),sql:'DROP TABLE'}),
    JSON.stringify({v1:[],source_csv_base64:source.toString('base64')}),
    JSON.stringify({v1:producer,source_csv_base64:'%INVALID'})
  ]){
    const res=await send(state,body);
    assert.equal(res.status,400);
    assert.equal((await res.json()).error,'INVALID_SOURCE_FORM');
  }
});
test('P5.14 2MiB CSV limit enforced before domain parsing',async t=>{
  const state=await boot(t);
  const huge=Buffer.alloc(2*1024*1024+1,65);
  const response=await send(state,form(producer,huge));
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'INVALID_SOURCE_FORM');
});
test('P5.14 content type must be JSON',async t=>{
  const state=await boot(t);
  const res=await send(state,form(),{'Content-Type':'text/plain'});
  assert.equal(res.status,415);
});
test('P5.14 route is not a read endpoint and arbitrary URLs remain unavailable',async t=>{
  const state=await boot(t);
  for(const endpoint of ['/api/smax-preview','/api/smax-raw','/upload','/sales.csv']){
    const res=await fetch(state.base+endpoint,{headers:state.headers});
    assert.equal(res.status,404,endpoint);
  }
});
test('P5.14 preview does not mutate any original fixture or create workspace files',async t=>{
  const files=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
  const before=files.map(name=>fs.readFileSync(path.join(fixture,name)));
  const state=await boot(t);
  await send(state);
  await send(state,'{"v1":');
  for(let i=0;i<files.length;i++)assert.deepEqual(fs.readFileSync(path.join(fixture,files[i])),before[i]);
});
test('P5.14 browser bundles file controls without adding third-party external forms',async t=>{
  const state=await boot(t);
  const html=await (await fetch(state.base+'/')).text();
  const app=await (await fetch(state.base+'/app.js')).text();
  assert.match(html,/id="smaxForm"/);
  assert.match(html,/id="smaxJson"/);
  assert.match(html,/id="smaxCsv"/);
  assert.match(html,/id="smaxResult"/);
  assert.match(app,/source_csv_base64/);
  assert.doesNotMatch(html,/action="https?:\/\//);
  assert.doesNotMatch(app,/innerHTML|outerHTML|insertAdjacentHTML|eval\(/);
});
