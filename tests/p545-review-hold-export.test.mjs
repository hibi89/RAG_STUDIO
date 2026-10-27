import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {planBrowserSmaxReview} from '../src/smax-browser-review-plan.mjs';
import {exportHeldReviewSummary} from '../src/review-hold-export.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const v1=JSON.parse(fs.readFileSync(new URL('../fixtures/smax_p42/synthetic_v1.json',import.meta.url)));
const csv=fs.readFileSync(new URL('../fixtures/ax_multi_doc_v0/sales.csv',import.meta.url));
const doc=fs.readFileSync(new URL('../fixtures/ax_multi_doc_v0/returns_policy.txt',import.meta.url));
test('P5.45 hold export is deterministic, minimal and never approval',()=>{
 const plan=planBrowserSmaxReview(v1,csv,doc,'.txt');
 const a=exportHeldReviewSummary(plan),b=exportHeldReviewSummary(plan);
 assert.deepEqual(a,b);
 const parsed=JSON.parse(a.json);
 assert.equal(parsed.unresolved_review_items,10);
 assert.equal(parsed.status,'REVIEW_HOLD');
 assert.equal(parsed.ax_package_created,false);
 assert.equal(parsed.sqlite_imported,false);
 assert.equal(parsed.customer_data_approved,false);
 assert.doesNotMatch(a.json,/O-1001|returns_policy|sales.csv|상품 수령일|72000|source_sha256|document/);
});
test('P5.45 forged approvals, mutated counts and malformed digest fail closed',()=>{
 const plan=planBrowserSmaxReview(v1,csv,doc,'.txt');
 for(const patch of [{status:'APPROVED'},{ax_package_created:true},
 {source_rights_verified:true},{customer_consent_verified:true},
 {authenticated_reviewer:true},{approval_record_persisted:true},
 {private_smax_native_signoff:true},{document_indexed:true},{remote_upload:true},
 {unresolved_review_items:0},{review_key_sha256:'bad'},
 {review_items:[{status:'APPROVED'}]}]){
  assert.throws(()=>exportHeldReviewSummary({...plan,...patch}),/REVIEW_EXPORT_BLOCKED/);
 }
});

import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
import path from 'node:path';
test('P5.45 localhost API returns redacted export and UI requires explicit click',async t=>{
 const root=path.join(fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url)));
 const server=createDashboardServer({packageRoot:root});
 const url=await listenDashboard(server,0);
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const token=dashboardLaunchUrl(server).split('#session=')[1];
 const payload={v1,source_csv_base64:csv.toString('base64'),
 document_base64:doc.toString('base64'),document_kind:'.txt'};
 const post=(headers)=>fetch(url+'/api/smax-review-plan',{
 method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload)});
 const anon=await post({});assert.equal(anon.status,401);
 const rsp=await post({Authorization:'Bearer '+token});assert.equal(rsp.status,200);
 const plan=await rsp.json(), exported=JSON.parse(plan.review_export_json);
 assert.equal(exported.status,'REVIEW_HOLD');
 assert.equal(exported.review_key_sha256,plan.review_key_sha256);
 assert.equal(exported.unresolved_review_items,10);
 assert.equal(exported.customer_data_approved,false);
 assert.doesNotMatch(plan.review_export_json,/O-1001|상품 수령일|returns_policy|sales.csv/);
 const html=fs.readFileSync(new URL('../ui/index.html',import.meta.url),'utf8');
 const script=fs.readFileSync(new URL('../ui/app.js',import.meta.url),'utf8');
 assert.match(html,/id="smaxReviewExportButton"[^>]*disabled/);
 assert.match(script,/URL\.createObjectURL/);
 assert.match(script,/pendingHoldExport=result\.review_export_json/);
 assert.match(script,/addEventListener\('change',clearHoldExport\)/);
});
