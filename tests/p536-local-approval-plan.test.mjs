import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalSmaxApprovalPlan} from '../src/local-smax-approval-plan.mjs';
const report=()=>({
  contract:'RAG_LOCAL_SMAX_REVIEW_HOLD_V1',status:'REVIEW_HOLD',
  source_provenance:'ORIGINAL_CSV_DIGEST_VERIFIED',source_sha256:'a'.repeat(64),
  source_rows:6,rows_needing_review:0,sales_preview_status:'CALCULATED_PREVIEW_NOT_APPROVED',
  provisional_revenue_krw:'157000',source_path:'DO_NOT_EXPOSE/PRIVATE.csv',
  document:{status:'UNAPPROVED_TEXT_PREVIEW',kind:'.txt',sha256:'b'.repeat(64),
    line_count:4,size_bytes:100,filename:'DO_NOT_EXPOSE/PRIVATE.txt'},
  ax_package_created:false,sqlite_imported:false,document_indexed:false,
  authenticated_reviewer:false,source_rights_verified:false,smax_native_approved:false,
  customer_data_approved:false,remote_upload:false,source_files_modified:false
});
test('P5.36 clean validated source produces ONLY unverified review questions, never approval',()=>{
  const r=buildLocalSmaxApprovalPlan(report());
  assert.equal(r.contract,'RAG_LOCAL_SMAX_APPROVAL_PLAN_V1');
  assert.equal(r.status,'REVIEW_HOLD');
  assert.equal(r.promotion_status,'NOT_AUTHORIZED_FOR_AX_PROMOTION');
  assert.equal(r.unresolved_review_items,10);
  assert.ok(r.review_items.every(i=>i.status==='UNVERIFIED'));
  for(const key of ['authenticated_reviewer','source_rights_verified','semantic_meanings_verified',
    'customer_consent_verified','private_smax_native_signoff','ax_package_created',
    'sqlite_imported','document_indexed','approval_record_persisted','remote_upload'])
    assert.equal(r[key],false,key);
  assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.review_items));
  assert.doesNotMatch(JSON.stringify(r),/DO_NOT_EXPOSE|PRIVATE\.csv|157000/);
});
test('P5.36 identical inputs yield same digest; source, document and row changes change review fingerprint',()=>{
  const r=report(),a=buildLocalSmaxApprovalPlan(r).review_key_sha256;
  assert.equal(a,buildLocalSmaxApprovalPlan(report()).review_key_sha256);
  for(const patch of [{source_sha256:'c'.repeat(64)}, {source_rows:7}])
    assert.notEqual(a,buildLocalSmaxApprovalPlan({...report(),...patch}).review_key_sha256);
  const changed=report();changed.document.sha256='c'.repeat(64);
  assert.notEqual(a,buildLocalSmaxApprovalPlan(changed).review_key_sha256);
});
test('P5.36 unresolved row review stays blocked without revealing customer values',()=>{
  const r=report();r.sales_preview_status='REVIEW_HOLD';r.rows_needing_review=1;
  const result=buildLocalSmaxApprovalPlan(r);
  assert.equal(result.source_row_issues_pending,true);
  assert.equal(result.status,'REVIEW_HOLD');
  assert.equal(result.sqlite_imported,false);
});
test('P5.36 forged approved state or forbidden side-effect cannot be converted to a plan',()=>{
  for(const patch of [{status:'ACCEPTED'},{customer_data_approved:true},
    {sqlite_imported:true},{source_rights_verified:true},{remote_upload:true},
    {authenticated_reviewer:true},{contract:'OTHER'}])
    assert.throws(()=>buildLocalSmaxApprovalPlan({...report(),...patch}),{code:'LOCAL_SMAX_APPROVAL_PLAN_BLOCKED'});
});
test('P5.36 malformed or contradictory snapshots are denied',()=>{
  for(const patch of [{source_sha256:'oops'},{source_rows:0},{rows_needing_review:8},
    {rows_needing_review:1},{sales_preview_status:'UNKNOWN'}])
    assert.throws(()=>buildLocalSmaxApprovalPlan({...report(),...patch}));
  const bad=report();bad.document.kind='.pdf';
  assert.throws(()=>buildLocalSmaxApprovalPlan(bad));
  assert.throws(()=>buildLocalSmaxApprovalPlan(null));
});
