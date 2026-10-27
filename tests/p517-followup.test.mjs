import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {answerFollowUp} from '../src/conversation.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const follow=(q,previous)=>answerFollowUp(root,q,previous);
test('P5.17 single return-period follow-up re-verifies provenance',()=>{
 const x=follow('그건 며칠이야?','반품 기간은?');
 assert.equal(x.status,'ANSWERED');assert.equal(x.conversation.mode,'SOURCE_RECHECKED_FOLLOWUP');
 assert.equal(x.conversation.resolved_question,'반품 신청 기간은?');
 assert.deepEqual(x.document_evidence.map(e=>e.period),[7]);
 assert.equal(x.metric_evidence,null);
});
test('P5.17 independently resolves shipping period',()=>{
 const x=follow('그럼 몇 일이야?','배송 준비 기간은?');
 assert.equal(x.status,'ANSWERED');assert.deepEqual(x.document_evidence.map(e=>e.period),[2]);
 assert.equal(x.conversation.resolved_question,'배송 준비 기간은?');
});
test('P5.17 third turn can reuse only reverified canonical question',()=>{
 const first=follow('그건 며칠이야?','반품 기간은?');
 const next=follow('그 기간은?',first.conversation.resolved_question);
 assert.equal(next.status,'ANSWERED');
 assert.deepEqual(next.document_evidence.map(e=>e.period),[7]);
});
test('P5.17 sales, combined contexts and unverified previous requests abstain',()=>{
 for(const prior of ['총 매출은?','총 매출과 반품 기간은?']){
  const r=follow('그건 며칠이야?',prior);
  assert.equal(r.status,'AMBIGUOUS_CONTEXT');assert.equal(r.answer,null);
 }
 const x=follow('그건 며칠이야?','올해 매출은?');
 assert.equal(x.status,'CONTEXT_UNVERIFIED');
});
test('P5.17 unsupported follow-up wording does not infer intent',()=>{
 const x=follow('그럼 작년에는 몇 일이었어?','반품 기간은?');
 assert.equal(x.status,'NOT_SUPPORTED');
 assert.equal(x.document_evidence.length,0);
});
test('P5.17 corrupt previous input and missing source fail closed',t=>{
 assert.throws(()=>follow('그건 며칠이야?',' '),/INVALID_FOLLOWUP/);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'p517-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 fs.cpSync(root,tmp,{recursive:true});
 fs.appendFileSync(path.join(tmp,'returns_policy.txt'),'tamper');
 assert.throws(()=>answerFollowUp(tmp,'그건 며칠이야?','반품 기간은?'));
});
async function live(t){
 const server=createDashboardServer({packageRoot:root});
 const url=await listenDashboard(server,0);
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const secret=dashboardLaunchUrl(server).split('#session=')[1];
 const auth={Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 const list=await (await fetch(url+'/api/projects',{headers:auth})).json();
 const body={question:'그건 며칠이야?',previous_question:'반품 기간은?',project_key:list.selected};
 const post=(payload=body,headers=auth)=>fetch(url+'/api/conversation',{method:'POST',headers,body:typeof payload==='string'?payload:JSON.stringify(payload)});
 return {post,body,auth,url};
}
test('P5.17 localhost API verifies source and binds an active project key',async t=>{
 const s=await live(t);
 const response=await s.post();assert.equal(response.status,200);
 const x=await response.json();assert.equal(x.status,'ANSWERED');
 assert.equal(x.document_evidence[0].period,7);
 assert.equal(JSON.stringify(x).includes(root),false);
});
test('P5.17 no token or cross-site POST is blocked',async t=>{
 const s=await live(t);
 assert.equal((await s.post(s.body,{'Content-Type':'application/json'})).status,401);
 assert.equal((await s.post(s.body,{...s.auth,Origin:'https://evil.example'})).status,403);
});
test('P5.17 stale project key cannot cause cross-project answer',async t=>{
 const s=await live(t);
 const r=await s.post({...s.body,project_key:'f'.repeat(32)});
 assert.equal(r.status,409);assert.equal((await r.json()).error,'WORKSPACE_CHANGED');
});
test('P5.17 strict request types, no extra fields or oversized histories',async t=>{
 const s=await live(t);
 for(const [payload,expected] of [
  [{...s.body,path:'/private'},400],
  [{...s.body,previous_question:''},400],
  [{...s.body,question:'x'.repeat(501)},400],
  ['{oops',400],
  [{...s.body,previous_question:'r'.repeat(2100)},413],
 ]){
  assert.equal((await s.post(payload)).status,expected);
 }
 assert.equal((await s.post(s.body,{...s.auth,'Content-Type':'text/plain'})).status,415);
});
