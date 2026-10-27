/** P5.34: genuine running SMAX-shaped public synthetic V1 -> AX package
 * -> verified SQLite + cited TXT query. Never creates a customer-approved import.
 * The confirmation below is programmatic and SYNTHETIC ONLY, not an identity
 * or consent check. Unpinned real files are NEVER promoted to AX ACCEPTED.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {previewSmaxSales} from './smax-sales-preview.mjs';
import {beginSyntheticExport,syntheticReviewPlan,confirmSyntheticExport,
  writeSyntheticAxBundle} from './smax-synthetic-export.mjs';
import {routeQuestion} from './evidence-router.mjs';
import {aggregateSales} from './summary.mjs';

const fixtureRoot=new URL('../fixtures/',import.meta.url);
const readFixture=()=>{
 const raw=fs.readFileSync(new URL('smax_p42/synthetic_v1.json',fixtureRoot));
 if(raw.length>2*1024*1024)throw Error('SYNTHETIC_FIXTURE_INVALID');
 return {v1:JSON.parse(raw.toString('utf8')),
  csv:fs.readFileSync(new URL('ax_multi_doc_v0/sales.csv',fixtureRoot)),
  policy:fs.readFileSync(new URL('ax_multi_doc_v0/returns_policy.txt',fixtureRoot))};
};
const EXPECTED_ANSWER='매출과 반품 신청 기간은?';
export function openSyntheticSmaxVertical(input=readFixture()){
 const v1=structuredClone(input.v1),csv=Buffer.from(input.csv),policy=Buffer.from(input.policy);
 // Independent row/quantity/price SHA and source-row lineage recomputation.
 const preview=previewSmaxSales(v1,csv);
 if(preview.status!=='CALCULATED_PREVIEW_NOT_APPROVED'||preview.review_rows!==0)
  throw Error('UNAPPROVED_OR_REVIEWED_INPUT');
 // P4.2 exporter independently accepts only EXACT pinned public fixture hashes,
 // content semantics and strict order/row provenance. No customer input works.
 const request=beginSyntheticExport(v1,csv,policy);
 const typedByCode=request.review_challenge; // NOT a human consent/approval.
 const bundle=confirmSyntheticExport(request,typedByCode,syntheticReviewPlan(request));
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p534-synthetic-'));
 const root=path.join(temp,'ax-source');
 let closed=false;
 const cleanup=()=>{if(!closed){closed=true;fs.rmSync(temp,{recursive:true,force:true});}};
 try{
  const exported=writeSyntheticAxBundle(bundle,root);
  const sales=aggregateSales(root);
  if(sales.orders!==preview.orders||sales.units!==preview.units||
     sales.revenue_krw!==preview.revenue_krw||
     sales.row_evidence.length!==preview.source_rows||
     sales.row_evidence.some((row,i)=>row.csv_line!==i+2||row.file_id!=='file-sales'))
    throw Error('SMAX_TO_AX_METRIC_OR_LINEAGE_MISMATCH');
  const answer=routeQuestion(root,EXPECTED_ANSWER);
  if(answer.status!=='ANSWERED'||answer.kind!=='SQL_DOCUMENT'||
     answer.metric_evidence?.revenue_krw!==sales.revenue_krw||
     answer.metric_evidence?.row_evidence?.length!==sales.orders||
     !answer.document_evidence?.some(e=>e.file_id==='file-policy'&&
       Number.isInteger(e.line)&&e.line>0))
    throw Error('SMAX_TO_RAG_EVIDENCE_MISSING');
  return Object.freeze({
    root,cleanup,
    status:'SYNTHETIC_SMAX_TO_RAG_MVP_READY',
    source_rows:sales.orders,units:sales.units,revenue_krw:sales.revenue_krw,
    document_citations:answer.document_evidence.length,
    source_digest_verified:true,schema_version:'AX_DATA_PACKAGE_V0',
    authenticated_reviewer:false,customer_data_approved:false,
    real_smax_native_verified:false,synthetic_only:true,
    export_status:exported.status
  });
 }catch(e){cleanup();throw e;}
}
