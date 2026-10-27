import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const fixture=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
async function run(t,root=fixture){
 const server=createDashboardServer({packageRoot:root});
 const base=await listenDashboard(server,0);
 const token=new URL(dashboardLaunchUrl(server)).hash.slice('#session='.length);
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const get=(route,auth=true)=>fetch(base+route,{headers:auth?{Authorization:'Bearer '+token}:{}});
 return {get};
}
test('P5.16 approved document is readable as numbered verified source lines',async t=>{
 const {get}=await run(t);
 const r=await get('/api/documents?document_id=document-returns');
 assert.equal(r.status,200);const d=await r.json();
 assert.equal(d.status,'VERIFIED_SOURCE_LINES');assert.equal(d.document_id,'document-returns');
 assert.equal(d.lines[0].line,1);assert.equal(d.total_lines>=3,true);
 assert.equal(d.lines.some(x=>/반품/.test(x.text)),true);
 assert.equal(JSON.stringify(d).includes(fixture),false);
});
test('P5.16 no bearer token yields 401 without any document bytes',async t=>{
 const {get}=await run(t);
 const r=await get('/api/documents?document_id=document-returns',false);
 assert.equal(r.status,401);assert.equal((await r.json()).error,'SESSION_REQUIRED');
});
test('P5.16 document ID must be allowlisted; filesystem path is never accepted',async t=>{
 const {get}=await run(t);
 for(const id of ['manifest.json','etc-passwd','file-sales']){
  const r=await get('/api/documents?document_id='+encodeURIComponent(id));
  assert.equal(r.status,id==='manifest.json'?400:404,id);
 }
});
test('P5.16 rejects duplicate, unknown, invalid and oversized page parameters',async t=>{
 const {get}=await run(t);
 for(const q of ['','?document_id=document-returns&start=0',
  '?document_id=document-returns&start=99999',
  '?document_id=document-returns&start=1&start=2',
  '?document_id=document-returns&file_path=../../x',
  '?document_id=%2Fetc%2Fpasswd']){
  assert.equal((await get('/api/documents'+q)).status,400,q);
 }
});
test('P5.16 page beyond source range refused rather than showing wrong source',async t=>{
 const {get}=await run(t);
 const r=await get('/api/documents?document_id=document-returns&start=40');
 assert.equal(r.status,400);assert.equal((await r.json()).error,'PAGE_OUT_OF_RANGE');
});
test('P5.16 changed source on disk fails closed instead of returning stale text',async t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'p516-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 for(const f of fs.readdirSync(fixture))fs.copyFileSync(path.join(fixture,f),path.join(tmp,f));
 const {get}=await run(t,tmp);
 assert.equal((await get('/api/documents?document_id=document-returns')).status,200);
 fs.appendFileSync(path.join(tmp,'returns_policy.txt'),'tampered!');
 const r=await get('/api/documents?document_id=document-returns');
 assert.equal(r.status,422);assert.equal((await r.json()).error,'PACKAGE_UNVERIFIED');
});
