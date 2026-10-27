/** P5.44: browser-selected three-file SMAX review PLAN, never an importer.
 * Reuses existing P5.13 source SHA/row/mapping verification and P5.36 checklist.
 * No raw source, document or private path is returned.
 */
import crypto from 'node:crypto';
import {previewSmaxSales} from './smax-sales-preview.mjs';
import {buildLocalSmaxApprovalPlan} from './local-smax-approval-plan.mjs';
const MAX_DOCUMENT=256*1024;
const fail=()=>{throw Object.assign(Error('Browser SMAX review not verified'),{code:'SMAX_BROWSER_REVIEW_BLOCKED'});};
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
export function planBrowserSmaxReview(v1,csvBytes,documentBytes,documentKind){
 if(!v1||typeof v1!=='object'||Array.isArray(v1)||
    !Buffer.isBuffer(csvBytes)||!Buffer.isBuffer(documentBytes)||
    csvBytes.length<1||csvBytes.length>2*1024*1024||
    documentBytes.length<1||documentBytes.length>MAX_DOCUMENT||
    !['.txt','.md'].includes(documentKind))fail();
 let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(documentBytes);}
 catch{fail();}
 if(!text.trim()||text.includes('\u0000')||
   /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text))fail();
 const lines=text.replace(/\r\n/g,'\n').split('\n');
 if(lines.length>500||lines.some(x=>x.length>4096))fail();
 const preview=previewSmaxSales(v1,csvBytes);
 if(!['REVIEW_HOLD','CALCULATED_PREVIEW_NOT_APPROVED'].includes(preview.status)||
    preview.source_digest_verified!==true||preview.customer_data_approved!==false||
    preview.ax_package_created!==false||preview.source_rights_verified!==false)fail();
 return buildLocalSmaxApprovalPlan({
  contract:'RAG_LOCAL_SMAX_REVIEW_HOLD_V1',status:'REVIEW_HOLD',
  source_provenance:'ORIGINAL_CSV_DIGEST_VERIFIED',
  source_sha256:sha(csvBytes),source_rows:preview.source_rows,
  rows_needing_review:preview.review_rows,sales_preview_status:preview.status,
  document:{status:'UNAPPROVED_TEXT_PREVIEW',kind:documentKind,sha256:sha(documentBytes),
    size_bytes:documentBytes.length,line_count:lines.length},
  ax_package_created:false,sqlite_imported:false,document_indexed:false,
  authenticated_reviewer:false,source_rights_verified:false,smax_native_approved:false,
  customer_data_approved:false,remote_upload:false,source_files_modified:false
 });
}
