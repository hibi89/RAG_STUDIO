import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReviewConsistency} from '../src/review-bundle-verify.mjs';

const SHA='b'.repeat(64);
function fixture(){
 const evidence=[{source_line:2,sku:'N-01',quantity:'2',amount_krw:'200'},
  {source_line:3,sku:'N-02',quantity:'1',amount_krw:'150'}];
 const metrics={orders:2,units:'3',revenue_krw:'350'};
 const sales={
  contract:'RAG_PREP_SALES_PREVIEW_V1',status:'REVIEW_HOLD',
  source_sha256:SHA,source_size_bytes:93,source_rows:2,
  metrics,sku_totals:[{sku:'N-01',orders:1,units:'2',revenue_krw:'200'},
   {sku:'N-02',orders:1,units:'1',revenue_krw:'150'}],
  source_evidence:evidence,evidence_truncated:false,
  ax_package_created:false,sqlite_imported:false,remote_upload:false,
  source_modified:false,customer_data_approved:false,source_rights_verified:false,smax_native_approved:false
 };
 const mixed={
  contract:'RAG_PREP_MIXED_PREVIEW_V1',status:'PREVIEW_WITH_CITATIONS',approval:'NOT_GRANTED',
  answer:null,source_sha256:SHA,source_rows:2,
  metric_evidence:{metrics:structuredClone(metrics),source_lines:structuredClone(evidence),source_evidence_truncated:false},
  document_evidence:{sha256:'a'.repeat(64),size_bytes:50,
   source_lines:[{source_line:1,quote:'반품 7일 이내 신청 가능',kind:'UNAPPROVED_SOURCE_EXCERPT'}],
   source_evidence_truncated:false},
  ax_package_created:false,sqlite_imported:false,document_indexed:false,remote_upload:false,
  source_modified:false,customer_data_approved:false,source_rights_verified:false,smax_native_approved:false
 };
 return {manifest:{source_sha256:SHA},sales,mixed};
}
const rejects=edit=>{
 const x=fixture();edit(x);
 assert.throws(()=>validateReviewConsistency(x.manifest,x.sales,x.mixed),
  error=>error.code==='RAG_REVIEW_BUNDLE_INVALID');
};
test('P5.56 internally consistent synthetic unapproved review accepted',()=>{
 const x=fixture();assert.equal(validateReviewConsistency(x.manifest,x.sales,x.mixed),true);
});
test('P5.56 mismatch between sales and mixed metrics is blocked',()=>{
 rejects(x=>x.mixed.metric_evidence.metrics.revenue_krw='500');
});
test('P5.56 forged SKU subtotal, total count and overflow blocked',()=>{
 rejects(x=>x.sales.sku_totals[0].revenue_krw='999');
 rejects(x=>x.sales.metrics.orders=3);
 rejects(x=>x.sales.metrics.revenue_krw='9007199254740992');
});
test('P5.56 duplicate SKU and falsified source excerpt blocked',()=>{
 rejects(x=>x.sales.sku_totals[1].sku='N-01');
 rejects(x=>x.mixed.metric_evidence.source_lines[0].source_line=10);
 rejects(x=>x.sales.source_evidence[1].source_line=2);
});
test('P5.56 missing policy evidence and claim of approval blocked',()=>{
 rejects(x=>x.mixed.document_evidence.source_lines=[]);
 rejects(x=>x.mixed.document_evidence.source_lines[0].kind='APPROVED');
 rejects(x=>x.mixed.customer_data_approved=true);
 rejects(x=>x.sales.source_rights_verified=true);
});
test('P5.56 unsupported status and zero/negative/unsafe numeric totals blocked',()=>{
 rejects(x=>x.mixed.status='READY');
 rejects(x=>x.sales.sku_totals[0].units='0');
 rejects(x=>x.sales.sku_totals[0].revenue_krw='-1');
 rejects(x=>x.sales.source_evidence[0].amount_krw='NaN');
});
