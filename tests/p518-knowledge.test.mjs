import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {knowledgeSearch,knowledgeCompare} from '../src/knowledge-base.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const origin=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const ids=['document-returns','document-shipping'];
function isolated(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p518-'));
 fs.cpSync(origin,root,{recursive:true});
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return root;
}
function writeDocument(root,name,content){
 const bytes=Buffer.from(content,'utf8');
 fs.writeFileSync(path.join(root,name),bytes);
 const p=path.join(root,'manifest.json'),m=JSON.parse(fs.readFileSync(p,'utf8'));
 const f=m.files.find(x=>x.relative_path===name);f.sha256=crypto.createHash('sha256').update(bytes).digest('hex');f.size_bytes=bytes.length;
 fs.writeFileSync(p,JSON.stringify(m));
}
function addDocument(root,id,content){
 const filename=id+'.txt',bytes=Buffer.from(content,'utf8');
 fs.writeFileSync(path.join(root,filename),bytes);
 const p=path.join(root,'manifest.json'),m=JSON.parse(fs.readFileSync(p,'utf8'));
 m.files.push({file_id:'file-'+id,relative_path:filename,kind:'document',
  sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size_bytes:bytes.length,import_status:'ACCEPTED'});
 m.documents.push({document_id:'document-'+id,file_id:'file-'+id,language:'ko',source_title:'추가 합성 '+id,page_info:'lines:1-2',index_status:'NOT_INDEXED'});
 m.processing_summary.accepted++;
 fs.writeFileSync(p,JSON.stringify(m));
}
test('P5.18 selected collection search limits citations to chosen document only',()=>{
 const x=knowledgeSearch(origin,[ids[0]],'반품 신청 기간');
 assert.equal(x.status,'FOUND');
 assert.ok(x.evidence.length>0);
 assert.deepEqual(new Set(x.evidence.map(e=>e.document_id)),new Set([ids[0]]));
 assert.deepEqual(x.scope.document_ids,[ids[0]]);
 const other=knowledgeSearch(origin,[ids[1]],'반품 신청 기간');
 assert.equal(other.evidence.every(e=>e.document_id===ids[1]),true);
});
test('P5.18 existing global search remains unchanged',()=>{
 const a=searchDocuments(origin,'배송 준비 반품 신청',{limit:8});
 assert.equal(a.status,'FOUND');
 assert.deepEqual(new Set(a.evidence.map(x=>x.document_id)),new Set(ids));
});
test('P5.18 selected two sources show different source units without false numeric ordering',()=>{
 const x=knowledgeCompare(origin,ids);
 assert.equal(x.status,'COMPARISON_READY');
 assert.equal(x.comparison.length,2);
 assert.deepEqual(x.comparison.map(c=>[c.document_id,c.domain,c.period,c.unit]),[
  ['document-returns','returns',7,'calendar_days'],['document-shipping','shipping',2,'business_days']]);
 assert.match(x.answer,/직접 크기 비교하지/);
 assert.equal(JSON.stringify(x).includes(origin),false);
});
test('P5.18 unsupported policy evidence is abstained from multi-document comparison',t=>{
 const root=isolated(t);
 writeDocument(root,'shipping_policy.txt','[FAKE] 배송 안내\n문의는 고객센터에 남겨주세요.\n');
 const x=knowledgeCompare(root,ids);
 assert.equal(x.status,'INSUFFICIENT_EVIDENCE');assert.equal(x.answer,null);
 assert.deepEqual(x.comparison,[]);
});
test('P5.18 detects conflicting period across selected documents with citations and no answer',t=>{
 const root=isolated(t);
 addDocument(root,'different-returns','[FAKE] 규정\n반품 신청은 14일 이내 가능.\n');
 const x=knowledgeCompare(root,[ids[0],'document-different-returns']);
 assert.equal(x.status,'POSSIBLE_CONFLICT');
 assert.equal(x.answer,null);
 assert.deepEqual(x.conflicts,['returns']);
 assert.deepEqual(new Set(x.review_evidence.map(e=>e.period)),new Set([7,14]));
});
test('P5.18 detects conflicting periods in same source line',t=>{
 const root=isolated(t);
 writeDocument(root,'returns_policy.txt','반품 신청 7일 이내 가능하거나 반품 신청 14일 이내 가능.\n');
 const x=knowledgeCompare(root,ids);
 assert.equal(x.status,'POSSIBLE_CONFLICT');
});
test('P5.18 unknown, duplicate, oversized and unapproved selectors fail closed',t=>{
 for(const bad of [[],[ids[0],ids[0]],['../manifest.json'],['file-sales'],Array(9).fill('document-other')]){
  assert.throws(()=>knowledgeSearch(origin,bad,'반품'),/knowledge|search/);
 }
 assert.throws(()=>knowledgeCompare(origin,[ids[0]]),/knowledge/);
 const root=isolated(t);
 const manifestPath=path.join(root,'manifest.json');
 const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 m.files.find(f=>f.file_id==='file-policy').import_status='NEEDS_REVIEW';
 m.processing_summary.accepted--;m.processing_summary.needs_review++;
 fs.writeFileSync(manifestPath,JSON.stringify(m));
 assert.throws(()=>knowledgeSearch(root,[ids[0]],'반품'),/knowledge/);
});
test('P5.18 tampering any approved package file invalidates selected search and comparison',t=>{
 const root=isolated(t);
 fs.appendFileSync(path.join(root,'sales.csv'),'tampered');
 assert.throws(()=>knowledgeSearch(root,[ids[0]],'반품'),/size|sha256/);
 assert.throws(()=>knowledgeCompare(root,ids),/size|sha256/);
});
test('P5.18 read-only comparison keeps source files byte-for-byte unchanged',()=>{
 const names=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
 const before=names.map(n=>fs.readFileSync(path.join(origin,n)));
 knowledgeSearch(origin,[ids[0]],'반품');
 knowledgeCompare(origin,ids);
 names.forEach((n,i)=>assert.deepEqual(fs.readFileSync(path.join(origin,n)),before[i]));
});
async function live(t){
 const server=createDashboardServer({packageRoot:origin});
 const base=await listenDashboard(server,0);
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const token=dashboardLaunchUrl(server).split('#session=')[1];
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
 const l=await (await fetch(base+'/api/projects',{headers})).json();
 const body={action:'search',project_key:l.selected,document_ids:[ids[0]],question:'반품 신청 기간'};
 const request=(payload=body,extra={})=>fetch(base+'/api/knowledge',{method:'POST',
  headers:{...headers,...extra.headers},body:typeof payload==='string'?payload:JSON.stringify(payload)});
 return {base,body,headers,request};
}
test('P5.18 authenticated localhost source-selected search and compare return exact claims',async t=>{
 const l=await live(t);
 const search=await l.request();
 assert.equal(search.status,200);
 const result=await search.json();
 assert.equal(result.status,'FOUND');
 assert.ok(result.evidence.every(x=>x.document_id===ids[0]));
 const compare=await l.request({action:'compare',project_key:l.body.project_key,document_ids:ids});
 assert.equal(compare.status,200);
 const checked=await compare.json();
 assert.equal(checked.status,'COMPARISON_READY');assert.equal(checked.comparison.length,2);
 assert.equal(JSON.stringify(checked).includes(origin),false);
});
test('P5.18 no bearer, cross-Origin and stale project key are rejected',async t=>{
 const l=await live(t);
 assert.equal((await l.request(l.body,{headers:{Authorization:''}})).status,401);
 assert.equal((await l.request(l.body,{headers:{Origin:'https://evil.test'}})).status,403);
 const wrong=await l.request({...l.body,project_key:'f'.repeat(32)});
 assert.equal(wrong.status,409);
});
test('P5.18 rejects malformed, extra-key, pathname and oversized requests',async t=>{
 const l=await live(t);
 for(const [input,code] of [
  ['{oops',400],[{...l.body,path:'/private/secret'},400],
  [{...l.body,document_ids:['../etc']},400],
  [{...l.body,document_ids:[ids[0],ids[0]]},400],
  [{...l.body,action:'compare'},400],
  [{...l.body,question:'가'.repeat(501)},400],
  [{...l.body,question:'Z'.repeat(4050)},413]
 ])assert.equal((await l.request(input)).status,code);
 assert.equal((await l.request(l.body,{headers:{'Content-Type':'text/plain'}})).status,415);
 const bogus=await l.request({...l.body,document_ids:['document-missing']});
 assert.equal(bogus.status,422);
 assert.equal((await bogus.json()).error,'KNOWLEDGE_UNVERIFIED');
});
