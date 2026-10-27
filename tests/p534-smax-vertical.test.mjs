import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openSyntheticSmaxVertical} from '../src/smax-vertical-mvp.mjs';
import {aggregateSales} from '../src/summary.mjs';
import {routeQuestion} from '../src/evidence-router.mjs';
const root=fileURLToPath(new URL('../fixtures/',import.meta.url));
const original=()=>({
 v1:JSON.parse(fs.readFileSync(new URL('smax_p42/synthetic_v1.json',root),'utf8')),
 csv:fs.readFileSync(new URL('ax_multi_doc_v0/sales.csv',root)),
 policy:fs.readFileSync(new URL('ax_multi_doc_v0/returns_policy.txt',root))
});
test('P5.34 SMAX V1 bytes become a verified temporary AX package with real SQL + citations',t=>{
 const files=original(),snap=[Buffer.from(files.csv),Buffer.from(files.policy)];
 const work=openSyntheticSmaxVertical(files);
 t.after(()=>work.cleanup());
 assert.equal(work.status,'SYNTHETIC_SMAX_TO_RAG_MVP_READY');
 assert.equal(work.source_rows,6);assert.equal(work.units,'10');
 assert.equal(work.revenue_krw,'157000');assert.ok(work.document_citations>0);
 assert.equal(work.authenticated_reviewer,false);
 assert.equal(work.customer_data_approved,false);
 assert.equal(work.real_smax_native_verified,false);
 assert.equal(work.synthetic_only,true);
 const verified=aggregateSales(work.root);
 assert.equal(verified.revenue_krw,'157000');assert.equal(verified.row_evidence.length,6);
 assert.deepEqual(verified.row_evidence.map(e=>e.csv_line),[2,3,4,5,6,7]);
 const answer=routeQuestion(work.root,'매출과 반품 신청 기간은?');
 assert.equal(answer.status,'ANSWERED');assert.equal(answer.kind,'SQL_DOCUMENT');
 assert.equal(answer.metric_evidence.row_evidence.length,6);
 assert.equal(answer.metric_evidence.revenue_krw,'157000');
 assert.ok(answer.document_evidence.some(e=>e.line>0&&e.file_id==='file-policy'));
 assert.deepEqual(files.csv,snap[0]);assert.deepEqual(files.policy,snap[1]);
});
test('P5.34 temporary synthesized workspace has idempotent cleanup',()=>{
 const work=openSyntheticSmaxVertical();
 assert.equal(fs.existsSync(work.root),true);
 work.cleanup();work.cleanup();assert.equal(fs.existsSync(work.root),false);
});
test('P5.34 unverified original byte mutation fails closed',()=>{
 const input=original();input.csv[22]^=1;
 assert.throws(()=>openSyntheticSmaxVertical(input));
});
test('P5.34 policy tampering fails closed even if sales proof remains valid',()=>{
 const input=original();input.policy=Buffer.from(input.policy);input.policy[5]^=1;
 assert.throws(()=>openSyntheticSmaxVertical(input));
});
test('P5.34 synthetic SMAX normalized value forgery refuses before package creation',()=>{
 const input=original();input.v1.rows[0].values.amount_krw='999999';
 assert.throws(()=>openSyntheticSmaxVertical(input));
});
test('P5.34 rows marked NEEDS_REVIEW never become approved local SQL',()=>{
 const input=original(),q=input.v1;const issue={field:'quantity',code:'INVALID_INTEGER'};
 q.rows[0].issues=[issue];q.rows[0].status='NEEDS_REVIEW';q.review_queue=[{source_record:2,issues:[issue]}];
 q.quality.review_rows=1;q.quality.invalid_cells=1;
 assert.throws(()=>openSyntheticSmaxVertical(input),/UNAPPROVED_OR_REVIEWED_INPUT/);
});
test('P5.34 forged producer claim of approval is refused',()=>{
 const input=original();input.v1.approval='GRANTED';
 assert.throws(()=>openSyntheticSmaxVertical(input));
});
test('P5.34 arbitrary substitute same schema is NOT accepted as synthetic',()=>{
 const input=original();
 const csv=Buffer.from(input.csv);
 const idx=csv.indexOf(Buffer.from('30000'));
 assert.ok(idx>=0);csv[idx]=0x31; // equivalent-length mutation, no trusted digest update
 input.csv=csv;
 assert.throws(()=>openSyntheticSmaxVertical(input));
});
