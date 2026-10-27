import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {planBrowserSmaxReview} from '../src/smax-browser-review-plan.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const fixture=path.join(ROOT,'fixtures/ax_multi_doc_v0');
const v1=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/smax_p42/synthetic_v1.json'),'utf8'));
const csv=fs.readFileSync(path.join(fixture,'sales.csv'));
const doc=fs.readFileSync(path.join(fixture,'returns_policy.txt'));
const b64=b=>Buffer.from(b).toString('base64');
const payload=()=>({v1,source_csv_base64:b64(csv),document_base64:b64(doc),document_kind:'.txt'});
async function api(t){
 const server=createDashboardServer({packageRoot:fixture});
 const url=await listenDashboard(server,0);
 const token=dashboardLaunchUrl(server).split('#session=')[1];
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 return {url,headers,post:(body,extra={})=>fetch(url+'/api/smax-review-plan',{
  method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)})};
}
test('P5.44: genuine SMAX + CSV + TXT yields HOLD and ten unresolved questions, not AX import',()=>{
 const a=planBrowserSmaxReview(v1,csv,doc,'.txt');
 assert.equal(a.status,'REVIEW_HOLD');
 assert.equal(a.contract,'RAG_LOCAL_SMAX_APPROVAL_PLAN_V1');
 assert.equal(a.promotion_status,'NOT_AUTHORIZED_FOR_AX_PROMOTION');
 assert.equal(a.unresolved_review_items,10);
 assert.equal(a.ax_package_created,false);
 assert.equal(a.sqlite_imported,false);
 assert.equal(a.source_rights_verified,false);
 assert.equal(a.customer_consent_verified,false);
 assert.ok(a.review_items.every(i=>i.status==='UNVERIFIED'));
 assert.doesNotMatch(JSON.stringify(a),/O-1001|상품 수령일|72000|returns_policy|sales\.csv/);
 assert.equal(a.review_key_sha256,planBrowserSmaxReview(v1,csv,doc,'.txt').review_key_sha256);
});
test('P5.44: damaged document, wrong kind or CSV alteration blocks local plan',()=>{
 assert.throws(()=>planBrowserSmaxReview(v1,csv,Buffer.from([0xff]),'.txt'));
 assert.throws(()=>planBrowserSmaxReview(v1,csv,doc,'.pdf'));
 assert.throws(()=>planBrowserSmaxReview(v1,csv,Buffer.alloc(256*1024+1),' .txt'));
 assert.throws(()=>planBrowserSmaxReview(v1,Buffer.from('wrong'),doc,'.txt'));
 const changed=Buffer.from(doc);changed[changed.length-1]=0x58;
 assert.notEqual(planBrowserSmaxReview(v1,csv,changed,'.txt').review_key_sha256,
   planBrowserSmaxReview(v1,csv,doc,'.txt').review_key_sha256);
});
test('P5.44: real localhost API 200 review HOLD, anonymous 401, foreign origin 403',async t=>{
 const {url,headers,post}=await api(t);
 const rsp=await post(payload());
 assert.equal(rsp.status,200);
 const data=await rsp.json();
 assert.equal(data.status,'REVIEW_HOLD');
 assert.equal(data.unresolved_review_items,10);
 const anon=await fetch(url+'/api/smax-review-plan',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});
 assert.equal(anon.status,401);
 assert.equal((await anon.json()).error,'SESSION_REQUIRED');
 const forged=await post(payload(),{Origin:'https://example.invalid'});
 assert.equal(forged.status,403);
 assert.equal((await forged.json()).error,'FORBIDDEN_ORIGIN');
 const current=await fetch(url+'/api/query',{method:'POST',headers,
  body:JSON.stringify({question:'SKU N-02 매출 알려줘'})});
 assert.equal(current.status,200);
 assert.equal((await current.json()).metric_evidence.revenue_krw,'72000');
});
test('P5.44: forged, malformed or changed 3-file request refuses without source path disclosure',async t=>{
 const {post}=await api(t);
 for(const bad of [
  {...payload(),document_kind:'.docx'},
  {...payload(),document_base64:b64(Buffer.from([0xff]))},
  {...payload(),source_csv_base64:b64(Buffer.from('wrong'))},
  {...payload(),customer_data_approved:true}
 ]){
  const r=await post(bad);
  assert.ok([400,422].includes(r.status),r.status);
  const txt=await r.text();
  assert.doesNotMatch(txt,/O-1001|returns_policy|sales.csv|C:\\/);
 }
});
test('P5.44 browser UI surfaces three-file HOLD only, no approval control',()=>{
 const html=fs.readFileSync(path.join(ROOT,'ui/index.html'),'utf8');
 const script=fs.readFileSync(path.join(ROOT,'ui/app.js'),'utf8');
 assert.match(html,/id="smaxReviewPlanButton"/);
 assert.match(html,/id="smaxDocument"/);
 assert.match(html,/id="smaxReviewPlanResult"/);
 assert.match(script,/api\/smax-review-plan/);
 assert.match(script,/NOT_AUTHORIZED_FOR_AX_PROMOTION/);
 assert.doesNotMatch(script,/innerHTML\s*=/);
});
