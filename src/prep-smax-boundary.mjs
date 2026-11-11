/** P5.49: bind owner draft, original CSV and untrusted public SMAX V1 in review-only mode. */
import crypto from 'node:crypto';
import {buildRagPrepReviewFromDraft} from './prep-mapping-draft.mjs';
import {inspectSmaxV1} from './smax-intake.mjs';
import {previewSmaxSales} from './smax-sales-preview.mjs';
const fail=reason=>{throw Object.assign(Error('RAG_PREP_SMAX_BOUNDARY_BLOCKED'+(reason?':'+reason:'')),{code:'RAG_PREP_SMAX_BOUNDARY_BLOCKED'});};
const salesKeys=['order_id','sku','quantity','unit_price_krw','amount_krw'];
export function verifyRagPrepSmaxBoundary(review,draft,pkg,sourceBytes){
 const plan=buildRagPrepReviewFromDraft(review,draft);
 if(!Buffer.isBuffer(sourceBytes)||sourceBytes.length!==plan.source_size_bytes||
   crypto.createHash('sha256').update(sourceBytes).digest('hex')!==plan.source_sha256||
   plan.source_rows<1||plan.requested_mapping.length!==plan.proposed_columns.length)fail();
 // Never equate a mapping proposal to semantic approval.
 if(plan.blockers.includes('MAPPING_INCOMPLETE'))fail();
 const check=inspectSmaxV1(pkg,{sourceBytes});
 if(check.status!=='REVIEW_REQUIRED'||check.provenance!=='SOURCE_DIGEST_VERIFIED')fail('PUBLIC_V1_GATE');
 if(pkg.source.sha256!==plan.source_sha256)fail('SOURCE_SHA');
 if(check.source_rows!==plan.source_rows)fail('SOURCE_ROWS');
 if(pkg.source.headers.length!==review.columns.length)fail('SOURCE_HEADER_COUNT');
 if(pkg.source.headers.some((name,i)=>name!==review.columns[i].name))fail('SOURCE_HEADERS');
 if(pkg.fields.length!==plan.requested_mapping.length)fail('MAPPING_COUNT');
 const map=new Map(pkg.fields.map(f=>[f.key,f]));
 for(const m of plan.requested_mapping){
   const f=map.get(m.key);
   if(!f||f.source!==m.source||f.type!==m.type||f.required!==m.required)fail();
 }
 if(map.size!==plan.requested_mapping.length)fail();
 let previewStatus='ROW_VALUES_UNVERIFIED';
 let orders=null,units=null,revenue=null,rowLineageVerified=false;
 const exactSales=salesKeys.every(k=>{const f=map.get(k);return f?.source===k&&f.required===true&&
   f.type===((k==='order_id'||k==='sku')?'text':'integer');})&&map.size===salesKeys.length;
 const qualityBlocked=plan.quality_issues!==0||plan.blockers.includes('TYPE_MISMATCH_REVIEW_REQUIRED');
 if(qualityBlocked)previewStatus='MAPPING_OR_SOURCE_QUALITY_REVIEW';
 else if(exactSales){
  const result=previewSmaxSales(pkg,sourceBytes);
  previewStatus=result.status;
  if(result.status==='CALCULATED_PREVIEW_NOT_APPROVED'){
   orders=result.orders;units=result.units;revenue=result.revenue_krw;
   rowLineageVerified=true;
  }
 }
 return Object.freeze({contract:'RAG_PREP_SMAX_BOUNDARY_V1',status:'REVIEW_HOLD',
  source_sha256:plan.source_sha256,source_rows:plan.source_rows,mapped_fields:map.size,
  source_digest_verified:true,mapping_exactly_bound:true,public_v1_shape_verified:true,
  row_lineage_verified:rowLineageVerified,preview_status:previewStatus,
  provisional_orders:orders,provisional_units:units,provisional_revenue_krw:revenue,
  approval:'NOT_GRANTED',authenticated_reviewer:false,source_rights_verified:false,
  smax_native_approved:false,customer_data_approved:false,ax_package_created:false,
  sqlite_imported:false,document_indexed:false,remote_upload:false,source_modified:false});
}
