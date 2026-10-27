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
 {unresolved_review_items:0},{review_key_sha256:'bad'},
 {review_items:[{status:'APPROVED'}]}]){
  assert.throws(()=>exportHeldReviewSummary({...plan,...patch}),/REVIEW_EXPORT_BLOCKED/);
 }
});
