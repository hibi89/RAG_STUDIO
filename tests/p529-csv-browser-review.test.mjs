import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const fixture=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const source=Buffer.from('secret_sku,quantity,date\nSKU-PRIVATE-01,2,2026-10-25\nSKU-PRIVATE-02,3,2026-10-26\n');
const valid=JSON.stringify({source_csv_base64:source.toString('base64')});
async function boot(t){
 const server=createDashboardServer({packageRoot:fixture});
 const base=await listenDashboard(server,0);
 t.after(async()=>{const closing=new Promise(done=>server.close(done));server.closeAllConnections();await closing;});
 const token=dashboardLaunchUrl(server).split('#session=')[1];
 return {base,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}};
}
const send=(ctx,body=valid,headers={})=>fetch(ctx.base+'/api/csv-review',
 {method:'POST',headers:{...ctx.headers,...headers},body});
test('P5.29 authenticated browser review returns no source values or import, preserves KPI',async t=>{
 const ctx=await boot(t);
 const before=await (await fetch(ctx.base+'/api/overview',{headers:ctx.headers})).json();
 const r=await send(ctx);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const x=await r.json();
 assert.equal(x.status,'NEEDS_REVIEW');
 assert.deepEqual(x.columns.map(c=>c.inferred_type),['TEXT','INTEGER','DATE']);
 assert.equal(x.row_count,2);
 for(const field of ['customer_data_approved','smax_native_approved','imported_to_sqlite','ax_package_created','original_modified'])
   assert.equal(x[field],false,field);
 assert.doesNotMatch(JSON.stringify(x),/SKU-PRIVATE-0[12]|source_csv_base64|\/secret\//);
 const after=await (await fetch(ctx.base+'/api/overview',{headers:ctx.headers})).json();
 assert.deepEqual(after,before);assert.equal(after.dataset.revenue_krw,'157000');
});
test('P5.29 no token and false bearer rejected before parsing',async t=>{
 const ctx=await boot(t);
 for(const auth of [undefined,'Bearer '+'A'.repeat(43)]){
  const headers={'Content-Type':'application/json'};if(auth)headers.Authorization=auth;
  const r=await fetch(ctx.base+'/api/csv-review',{method:'POST',headers,body:valid});
  assert.equal(r.status,401);assert.deepEqual(await r.json(),{error:'SESSION_REQUIRED'});
 }
});
test('P5.29 other origin with valid bearer is forbidden',async t=>{
 const ctx=await boot(t);const r=await send(ctx,valid,{Origin:'https://hostile.invalid'});
 assert.equal(r.status,403);assert.deepEqual(await r.json(),{error:'FORBIDDEN_ORIGIN'});
});
test('P5.29 invalid media, JSON, extra field, malformed base64 are rejected',async t=>{
 const ctx=await boot(t);
 for(const [body,headers,status,error] of [
  [valid,{'Content-Type':'text/plain'},415,'INVALID_MEDIA_TYPE'],
  ['{',{},400,'INVALID_JSON'],
  [JSON.stringify({source_csv_base64:'%BAD'}),{},400,'INVALID_CSV_REVIEW_FORM'],
  [JSON.stringify({source_csv_base64:source.toString('base64'),path:'/etc/passwd'}),{},400,'INVALID_CSV_REVIEW_FORM'],
  [JSON.stringify({source_csv_base64:123}),{},400,'INVALID_CSV_REVIEW_FORM']
 ]){
  const r=await send(ctx,body,headers);assert.equal(r.status,status);
  const text=await r.text();
  assert.equal(JSON.parse(text).error,error);
  assert.doesNotMatch(text,/SKU-PRIVATE/);
 }
});
test('P5.29 1MiB source cap and body cap are enforced',async t=>{
 const ctx=await boot(t);
 const big=Buffer.alloc(1024*1024+1,65);
 const a=await send(ctx,JSON.stringify({source_csv_base64:big.toString('base64')}));
 assert.equal(a.status,400);
 const b=await send(ctx,JSON.stringify({source_csv_base64:'x'.repeat(2*1024*1024)}));
 assert.equal(b.status,413);
});
test('P5.29 invalid source UTF8 or CSV fails closed',async t=>{
 const ctx=await boot(t);
 for(const bad of [Buffer.from([255,254]),Buffer.from('a,b\n"unclosed,2')]){
  const r=await send(ctx,JSON.stringify({source_csv_base64:bad.toString('base64')}));
  assert.equal(r.status,422);assert.deepEqual(await r.json(),{error:'CSV_REVIEW_UNVERIFIED'});
 }
});
test('P5.29 no raw CSV export or GET route exists',async t=>{
 const ctx=await boot(t);
 for(const endpoint of ['/api/csv-review','/api/csv-export','/csv-review','/secret.csv']){
  const r=await fetch(ctx.base+endpoint,{headers:ctx.headers});assert.equal(r.status,404);
 }
});
test('P5.29 form and safe UI DOM render present without external target',async t=>{
 const ctx=await boot(t);
 const html=await (await fetch(ctx.base+'/')).text(),app=await (await fetch(ctx.base+'/app.js')).text();
 for(const id of ['csvReviewForm','csvReviewFile','csvReviewButton','csvReviewResult'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/\/api\/csv-review/);assert.match(app,/source_csv_base64/);
 assert.doesNotMatch(html,/action="https?:\/\//);
 assert.doesNotMatch(app,/innerHTML|outerHTML|insertAdjacentHTML|eval\(/);
});
test('P5.29 fixture source not modified on success or error',async t=>{
 const names=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
 const before=names.map(n=>fs.readFileSync(path.join(fixture,n)));
 const ctx=await boot(t);await send(ctx);await send(ctx,'{');
 for(let i=0;i<names.length;i++)assert.deepEqual(fs.readFileSync(path.join(fixture,names[i])),before[i]);
});
