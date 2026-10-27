import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {searchDocuments} from '../src/document-search.mjs';
import {searchLexicalHybrid} from '../src/lexical-hybrid.mjs';
import {knowledgeSearch} from '../src/knowledge-base.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const fixture=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const returns='document-returns',shipping='document-shipping';
function isolated(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'p519-rag-'));
 fs.cpSync(fixture,root,{recursive:true});
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return root;
}
function addDocument(root,id,text){
 const file=id+'.txt',buf=Buffer.from(text);
 fs.writeFileSync(path.join(root,file),buf);
 const manifestPath=path.join(root,'manifest.json'),m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 m.files.push({file_id:'file-'+id,relative_path:file,kind:'document',
  sha256:crypto.createHash('sha256').update(buf).digest('hex'),
  size_bytes:buf.length,import_status:'ACCEPTED'});
 m.documents.push({document_id:'document-'+id,file_id:'file-'+id,
  language:'ko',source_title:'합성 '+id,page_info:'lines:1-2',index_status:'NOT_INDEXED'});
 m.processing_summary.accepted++;
 fs.writeFileSync(manifestPath,JSON.stringify(m));
}
test('P5.19 default BM25 remains source-identical and is not silently replaced',()=>{
 const old=searchDocuments(fixture,'반품 신청 기간',{limit:8,documentIds:[returns]});
 const current=knowledgeSearch(fixture,[returns],'반품 신청 기간');
 assert.deepEqual(current.evidence,old.evidence);
 assert.equal(current.search_mode,'bm25_line_ngrams');
 assert.deepEqual(knowledgeSearch(fixture,[returns],'반품 신청 기간',{mode:'bm25'}).evidence,old.evidence);
});
test('P5.19 experimental lexical RRF provides reproducible citation keys',()=>{
 const a=searchLexicalHybrid(fixture,'반품 신청 기간',{documentIds:[returns]});
 const b=searchLexicalHybrid(fixture,'반품 신청 기간',{documentIds:[returns]});
 assert.equal(a.status,'FOUND');
 assert.deepEqual(a,b);
 assert.ok(a.evidence.every(x=>x.document_id===returns&&Number.isInteger(x.line)&&x.line>=1));
 assert.ok(a.evidence.every(x=>x.retrieval_source.includes('chargram')||x.retrieval_source.includes('bm25')));
 assert.equal(a.search_mode,'lexical_rrf_bm25_chargram_experimental');
 assert.doesNotMatch(JSON.stringify(a),/\/tmp\/|file:\/\//);
});
test('P5.19 selected source allowlist isolates both ranking channels',()=>{
 const result=searchLexicalHybrid(fixture,'배송 준비 반품 신청',{documentIds:[shipping]});
 assert.equal(result.status,'FOUND');
 assert.ok(result.evidence.length>0);
 assert.deepEqual(new Set(result.evidence.map(x=>x.document_id)),new Set([shipping]));
 const other=knowledgeSearch(fixture,[returns],'반품 신청',{mode:'lexical_hybrid'});
 assert.equal(other.scope.mode,'SESSION_SELECTED_DOCUMENTS');
 assert.ok(other.evidence.every(e=>e.document_id===returns));
});
test('P5.19 insufficient lexical question returns no fabricated citation',()=>{
 const x=searchLexicalHybrid(fixture,'해왕성의 표면 온도');
 assert.equal(x.status,'NO_EVIDENCE');
 assert.equal(x.answer,null);
 assert.equal(x.evidence.length,0);
});
test('P5.19 preserves verified explicit policy disagreement',t=>{
 const root=isolated(t);
 addDocument(root,'alternate','합성\n반품 신청은 14일 이내 가능.\n');
 const x=searchLexicalHybrid(root,'반품 신청 기간',{documentIds:[returns,'document-alternate']});
 assert.equal(x.status,'POSSIBLE_CONFLICT');
 assert.equal(x.answer,null);
});
test('P5.19 detects conflict outside baseline top 10',t=>{
 const root=isolated(t);
 for(let i=0;i<12;i++)addDocument(root,'filler'+i,'합성\n반품 신청 가능 기간은 7일 이내.\n');
 addDocument(root,'zz-different','합성\n반품 신청 가능 기간은 14일 이내.\n');
 const ids=[returns,...Array.from({length:12},(_,i)=>'document-filler'+i),'document-zz-different'];
 // Without an explicit selection, all manifest-approved sources are included.
 const result=searchLexicalHybrid(root,'반품 신청 기간');
 assert.equal(result.status,'POSSIBLE_CONFLICT');
 assert.equal(result.answer,null);
 assert.ok(result.evidence.length>0);
 assert.equal(ids.includes(result.evidence[0].document_id),true);
});
test('P5.19 unsafe selection, malformed inputs and mode do not bypass validation',()=>{
 for(const ids of [[],[returns,returns],['../manifest.json'],['fake'],Array(9).fill('xx')])
   assert.throws(()=>searchLexicalHybrid(fixture,'반품',{documentIds:ids}));
 for(const q of [undefined,'',' ',{},'a'.repeat(501)])
   assert.throws(()=>searchLexicalHybrid(fixture,q));
 assert.throws(()=>searchLexicalHybrid(fixture,'반품',{limit:11}));
 assert.throws(()=>knowledgeSearch(fixture,[returns],'반품',{mode:'dense'}),/invalid mode/);
});
test('P5.19 source digest mutations invalidate both ranking channels',t=>{
 const root=isolated(t);
 fs.appendFileSync(path.join(root,'returns_policy.txt'),'tampered');
 assert.throws(()=>searchLexicalHybrid(root,'반품'),/size|sha256/);
});
test('P5.19 queries never mutate originals',()=>{
 const files=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
 const before=files.map(x=>fs.readFileSync(path.join(fixture,x)));
 searchLexicalHybrid(fixture,'배송 준비',{documentIds:[shipping]});
 files.forEach((f,i)=>assert.deepEqual(fs.readFileSync(path.join(fixture,f)),before[i]));
});
async function server(t){
 const s=createDashboardServer({packageRoot:fixture});
 const base=await listenDashboard(s,0);
 t.after(()=>new Promise(ok=>s.close(ok)));
 const auth=dashboardLaunchUrl(s).split('#session=')[1];
 const headers={Authorization:'Bearer '+auth,'Content-Type':'application/json'};
 const selected=(await (await fetch(base+'/api/projects',{headers})).json()).selected;
 const body={action:'search',project_key:selected,document_ids:[returns],question:'반품 신청 기간',mode:'lexical_hybrid'};
 const post=(value=body,overrides={})=>fetch(base+'/api/knowledge',{method:'POST',headers:{...headers,...overrides},
  body:typeof value==='string'?value:JSON.stringify(value)});
 return {post,body,headers,base};
}
test('P5.19 local HTTP returns opt-in hybrid; default still BM25',async t=>{
 const c=await server(t);
 const r=await c.post();assert.equal(r.status,200);
 const result=await r.json();assert.equal(result.status,'FOUND');
 assert.equal(result.search_mode,'lexical_rrf_bm25_chargram_experimental');
 assert.ok(result.evidence.every(e=>e.document_id===returns));
 const plain={...c.body};delete plain.mode;
 const baseline=await c.post(plain);assert.equal(baseline.status,200);
 assert.equal((await baseline.json()).search_mode,'bm25_line_ngrams');
});
test('P5.19 server rejects invalid mode, compare-mode injection and data exfiltration fields',async t=>{
 const c=await server(t);
 for(const payload of [
  {...c.body,mode:'faiss'}, {...c.body,mode:null},
  {...c.body,path:'/some/private/file'},
  {action:'compare',project_key:c.body.project_key,document_ids:[returns,shipping],mode:'lexical_hybrid'},
 ]){
  const r=await c.post(payload);assert.equal(r.status,400);
 }
 const wrong=await c.post({...c.body,project_key:'f'.repeat(32)});
 assert.equal(wrong.status,409);
 const badOrigin=await c.post(c.body,{Origin:'https://evil.example'});
 assert.equal(badOrigin.status,403);
 const unauth=await c.post(c.body,{Authorization:''});
 assert.equal(unauth.status,401);
});
