/** P5.50: one public, pinned, synthetic-only owner draft -> cited RAG acceptance route. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {inspectCsvBytes} from './local-csv-review.mjs';
import {verifyRagPrepSmaxBoundary} from './prep-smax-boundary.mjs';
import {openSyntheticSmaxVertical} from './smax-vertical-mvp.mjs';
const SHA=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Object.assign(Error('RAG_PREP_SYNTHETIC_JOURNEY_BLOCKED'),{code:'RAG_PREP_SYNTHETIC_JOURNEY_BLOCKED'});};
const fixture=()=>({
 v1:JSON.parse(fs.readFileSync(new URL('../fixtures/smax_p42/synthetic_v1.json',import.meta.url),'utf8')),
 csv:fs.readFileSync(new URL('../fixtures/ax_multi_doc_v0/sales.csv',import.meta.url)),
 policy:fs.readFileSync(new URL('../fixtures/ax_multi_doc_v0/returns_policy.txt',import.meta.url))
});
/** Input override is for negative synthetic tests only. P5.34 verifies hard-pinned public fixture hashes. */
export function runSyntheticMappedRagJourney(input=fixture()){
 const csv=Buffer.from(input.csv),v1=structuredClone(input.v1),policy=Buffer.from(input.policy);
 const review=inspectCsvBytes(csv);
 const draft={contract:'RAG_PREP_MAPPING_DRAFT_V1',source_sha256:SHA(csv),
  requested_mapping:structuredClone(v1.fields)};
 const bound=verifyRagPrepSmaxBoundary(review,draft,v1,csv);
 if(bound.status!=='REVIEW_HOLD'||bound.approval!=='NOT_GRANTED'||
    bound.preview_status!=='CALCULATED_PREVIEW_NOT_APPROVED'||!bound.row_lineage_verified||
    bound.source_sha256!==SHA(csv)||bound.provisional_revenue_krw===null)fail();
 let vertical;
 try{
  vertical=openSyntheticSmaxVertical({v1,csv,policy});
  if(vertical.status!=='SYNTHETIC_SMAX_TO_RAG_MVP_READY'||
     !vertical.synthetic_only||vertical.customer_data_approved!==false||
     vertical.real_smax_native_verified!==false||
     String(vertical.revenue_krw)!==bound.provisional_revenue_krw||
     String(vertical.units)!==bound.provisional_units||
     vertical.source_rows!==bound.provisional_orders||
     vertical.document_citations<1)fail();
  return Object.freeze({contract:'RAG_PREP_MAPPED_SYNTHETIC_JOURNEY_V1',
   status:'SYNTHETIC_MAPPED_RAG_CITED_QUERY_PASS',
   source_sha256:bound.source_sha256,source_rows:bound.source_rows,
   orders:bound.provisional_orders,units:bound.provisional_units,
   revenue_krw:bound.provisional_revenue_krw,document_citations:vertical.document_citations,
   mapping_verified:true,source_digest_verified:true,row_lineage_verified:true,
   fixed_sql_and_txt_citations_verified:true,
   synthetic_only:true,approval:'NOT_GRANTED',source_rights_verified:false,
   authenticated_reviewer:false,smax_native_approved:false,customer_data_approved:false,
   ax_customer_package_created:false,real_customer_indexed:false,remote_upload:false,
   source_modified:false});
 }finally{vertical?.cleanup();}
}
