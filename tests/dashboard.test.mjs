import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard} from '../src/dashboard-server.mjs';
const fixture=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
async function run(t,{root=fixture}={}){
  const server=createDashboardServer({packageRoot:root});
  const url=await listenDashboard(server,0);
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return {server,url};
}
async function post(url,endpoint,question,options={}){
  return fetch(url+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),...options});
}
function tempRoot(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'rag-dash-'));fs.cpSync(fixture,d,{recursive:true});t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}

test('P3 serves real local dashboard HTML and JS with restrictive CSP',async t=>{
 const {url}=await run(t);const r=await fetch(url);assert.equal(r.status,200);
 const html=await r.text();assert.match(html,/RAG STUDIO/);assert.match(html,/매출/);
 assert.match(r.headers.get('content-security-policy'),/default-src 'none'/);assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);
 assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 for(const file of ['/app.js','/app.css']){const res=await fetch(url+file);assert.equal(res.status,200);assert.ok((await res.text()).length>400);}
});
test('P3 verified overview totals, data rows and document provenance',async t=>{
 const {url}=await run(t);const r=await fetch(url+'/api/overview');assert.equal(r.status,200);
 const x=await r.json();assert.equal(x.status,'VERIFIED_SYNTHETIC_PACKAGE');assert.equal(x.dataset.revenue_krw,'157000');
 assert.equal(x.dataset.orders,6);assert.equal(x.dataset.units,'10');assert.equal(x.dataset.source_rows.length,6);
 assert.equal(x.documents.length,2);assert.deepEqual(x.documents.map(d=>d.file_id),['file-policy','file-shipping']);
});
test('P3 POST routed query combines SQLite with both document citations',async t=>{
 const {url}=await run(t);const r=await post(url,'/api/query','총 매출과 반품 기간, 배송 준비 기간은?');
 assert.equal(r.status,200);const x=await r.json();assert.equal(x.status,'ANSWERED');
 assert.equal(x.metric_evidence.revenue_krw,'157000');assert.deepEqual(x.document_evidence.map(d=>d.period),[7,2]);
});
test('P3 POST search exposes original document quotes and line numbers',async t=>{
 const {url}=await run(t);const r=await post(url,'/api/search','반품 신청 기간 배송 준비');
 assert.equal(r.status,200);const x=await r.json();assert.equal(x.status,'FOUND');
 assert.ok(x.evidence.some(e=>e.file_id==='file-policy'&&e.line===2));
 assert.ok(x.evidence.some(e=>e.file_id==='file-shipping'&&e.line===2));
});
test('P3 unsupported question explicitly abstains',async t=>{
 const {url}=await run(t);const r=await post(url,'/api/query','내일 제주도 날씨');
 assert.equal(r.status,200);const x=await r.json();assert.equal(x.status,'NOT_SUPPORTED');assert.equal(x.answer,null);
});
test('P3 health contains no source data',async t=>{
 const {url}=await run(t);const r=await fetch(url+'/api/health');assert.deepEqual(await r.json(),{status:'READY',scope:'loopback_only'});
});
test('P3 no arbitrary local file or path traversal route',async t=>{
 const {url}=await run(t);for(const endpoint of ['/package.json','/src/evidence-router.mjs','/etc/passwd','/api/settings','/manifest.json']){
  const r=await fetch(url+endpoint);assert.equal(r.status,404,endpoint);
 }
});
test('P3 localhost-only listener',async t=>{
 const {server}=await run(t);assert.equal(server.address().address,'127.0.0.1');
});
test('P3 rejects rebinding Host spoof',async t=>{
 const {url}=await run(t);
 const code=await new Promise((resolve,reject)=>{const req=http.request(new URL(url+'/api/overview'),{headers:{Host:'evil.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
 assert.equal(code,403);
});
test('P3 rejects cross-origin POST before doing any query',async t=>{
 const {url}=await run(t);const r=await post(url,'/api/query','총 매출',{headers:{'Content-Type':'application/json',Origin:'https://evil.test'}});assert.equal(r.status,403);
});
test('P3 rejects unexpected media type',async t=>{
 const {url}=await run(t);const r=await post(url,'/api/query','총 매출',{headers:{'Content-Type':'text/plain'}});assert.equal(r.status,415);
});
test('P3 rejects malformed JSON and unknown field injection',async t=>{
 const {url}=await run(t);let r=await fetch(url+'/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:'{oops'});
 assert.equal(r.status,400);
 r=await fetch(url+'/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'총 매출',sql:'DELETE FROM sales'})});
 assert.equal(r.status,400);
});
test('P3 rejects oversized requests',async t=>{
 const {url}=await run(t);const r=await fetch(url+'/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'가'.repeat(900)})});
 assert.equal(r.status,413);
});
test('P3 blocks unsupported methods',async t=>{
 const {url}=await run(t);const r=await fetch(url+'/api/overview',{method:'PUT'});assert.equal(r.status,405);
});
test('P3 mutation of source file after startup fails closed, no stale KPI',async t=>{
 const d=tempRoot(t);const {url}=await run(t,{root:d});
 assert.equal((await fetch(url+'/api/overview')).status,200);
 fs.appendFileSync(path.join(d,'returns_policy.txt'),'tamper');
 let r=await fetch(url+'/api/overview');assert.equal(r.status,422);assert.equal((await r.json()).error,'PACKAGE_UNVERIFIED');
 r=await post(url,'/api/query','총 매출과 반품 기간');assert.equal(r.status,422);
});
test('P3 original source files are never modified by GET/POST',async t=>{
 const before=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'].map(n=>fs.readFileSync(path.join(fixture,n)));
 const {url}=await run(t);await fetch(url+'/api/overview');await post(url,'/api/query','총 매출과 반품 기간, 배송 준비 기간은?');await post(url,'/api/search','반품 신청 기간 배송 준비');
 ['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'].forEach((n,i)=>assert.deepEqual(fs.readFileSync(path.join(fixture,n)),before[i]));
});
test('P3 startup validates selected package',()=>{
 assert.throws(()=>createDashboardServer({packageRoot:'/this-does-not-exist'}));
});
test('P3 static UI uses no remote scripts, fonts, styles or images',()=>{
 const base=fileURLToPath(new URL('../ui/',import.meta.url));
 for(const name of ['index.html','app.css','app.js']){
  const file=fs.readFileSync(path.join(base,name),'utf8');
  assert.doesNotMatch(file,/https?:\/\//i,`external URL in ${name}`);
 }
});
test('P3 dynamic source strings render only as text, without markup injection sinks',()=>{
 const js=fs.readFileSync(fileURLToPath(new URL('../ui/app.js',import.meta.url)),'utf8');
 assert.match(js,/textContent/);
 assert.doesNotMatch(js,/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function\(/);
});
test('P3 UI ships accessible question form, responsive viewport and explicit provenance table',()=>{
 const html=fs.readFileSync(fileURLToPath(new URL('../ui/index.html',import.meta.url)),'utf8');
 for(const expected of ['name="viewport"','for="question"','id="askForm"','id="answerPane"','aria-live="polite"','id="sourceRows"','id="documentCards"'])assert.ok(html.includes(expected),expected);
});
