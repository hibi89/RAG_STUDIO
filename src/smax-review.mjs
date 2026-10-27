/**
 * P4.1 synthetic-only semantic review handshake.
 * Not an identity service, SMAX producer validator, package exporter or approval authority.
 * No raw source values are returned, no files/network are written.
 */
import {inspectSmaxV1} from './smax-intake.mjs';
const issue=code=>{throw Object.assign(new Error('SMAX review handshake refused'),{code});};
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const roles=['order_id','quantity','line_amount_krw'];
const integer=s=>typeof s==='string'&&/^(0|[1-9][0-9]*)$/.test(s)&&Number.isSafeInteger(Number(s));
const orderId=s=>typeof s==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(s);
const report=(status,rows)=>Object.freeze({
  status,source_binding:'MATCHED',source_rows:rows,
  semantic_review_recorded:status==='REVIEW_RECORD_READY',
  reviewer_identity_verified:false,ax_package_created:false,
  limitation:'No authenticated reviewer or approved AX_DATA_PACKAGE_V0 exporter'
});
/** Fail-closed bounded CSV subset: plain rows only. Quoted/multiline CSV needs a
 * separate complete CSV parser before it can ever be imported.
 */
function parsePlainCsv(sourceBytes,expectedRows){
  if(!Buffer.isBuffer(sourceBytes)||sourceBytes.length>2*1024*1024)issue('SOURCE_INVALID');
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(sourceBytes);}
  catch{issue('SOURCE_UTF8_INVALID');}
  if(!text||text.includes('\uFEFF')||text.includes('"')||/[\u0000-\u0009\u000b-\u000c\u000e-\u001f\u007f]/u.test(text))issue('CSV_UNSUPPORTED');
  const normalized=text.replace(/\r\n/g,'\n');
  if(normalized.includes('\r')||!normalized.endsWith('\n'))issue('CSV_UNSUPPORTED');
  const lines=normalized.slice(0,-1).split('\n');
  if(lines.length!==expectedRows+1||lines.some(line=>!line))issue('ROW_PROVENANCE_MISMATCH');
  const grid=lines.map(x=>x.split(','));
  const header=grid[0];
  if(header.length!==3||header.some(x=>!x.trim()||x!==x.trim())||
    new Set(header).size!==header.length||
    grid.some(row=>row.length!==3))issue('CSV_UNSUPPORTED');
  return {header,records:grid.slice(1)};
}
function verifyValues(pkg,sourceBytes){
  // This is only a public RAG checker; never call this producer approval.
  const initial=inspectSmaxV1(pkg,{sourceBytes});
  if(initial.status!=='REVIEW_REQUIRED'||initial.provenance!=='SOURCE_DIGEST_VERIFIED')issue('PROVENANCE_NOT_VERIFIED');
  if(pkg.source.source_rows<1||pkg.source.source_rows>1000||
     pkg.source.headers.length!==3||pkg.fields.length!==3||
     pkg.quality.review_rows!==0||pkg.review_queue.length!==0)issue('REQUIRES_CLEAN_THREE_FIELD_SAMPLE');
  const {header,records}=parsePlainCsv(sourceBytes,pkg.source.source_rows);
  if(JSON.stringify(header)!==JSON.stringify(pkg.source.headers))issue('HEADER_MISMATCH');
  const fieldByKey=new Map(pkg.fields.map(f=>[f.key,f]));
  if(!exact(Object.fromEntries(fieldByKey),['order_id','quantity','amount_krw'])||
     fieldByKey.get('order_id').type!=='text'||
     fieldByKey.get('quantity').type!=='integer'||
     fieldByKey.get('amount_krw').type!=='integer'||
     pkg.fields.some(f=>!f.required))issue('UNSUPPORTED_FIELD_TYPES');
  const indexes=new Map(pkg.source.headers.map((x,i)=>[x,i]));
  const ids=new Set();
  for(let i=0;i<records.length;i++){
    const row=pkg.rows[i],cells=records[i];
    if(JSON.stringify(row.source_cells)!==JSON.stringify(cells)||
       row.source_record!==i+2||row.status!=='READY_FOR_HUMAN_REVIEW'||row.issues.length)
      issue('SOURCE_ROW_MISMATCH');
    for(const key of ['order_id','quantity','amount_krw']){
      const v=cells[indexes.get(fieldByKey.get(key).source)];
      if(v!==v.trim()||row.values[key]!==v)issue('VALUE_MISMATCH');
    }
    const id=row.values.order_id,qty=row.values.quantity,amount=row.values.amount_krw;
    if(!orderId(id)||ids.has(id)||!integer(qty)||qty==='0'||!integer(amount))
      issue('ROW_SEMANTIC_INVALID');
    ids.add(id);
  }
  return records.length;
}
/**
 * A user-supplied record documents explicit *intent to review*, NOT authority.
 * No caller can produce ACCEPTED/APPROVED AX data through this function.
 */
export function assessSmaxReview(pkg,sourceBytes,review=null){
  const rows=verifyValues(pkg,sourceBytes);
  if(review===null)return report('PENDING_SEMANTIC_REVIEW',rows);
  if(!exact(review,['schema_version','source_sha256','semantic_roles','currency','amount_unit',
       'amount_meaning','tax_basis','source_records','decision','acknowledgement'])||
     review.schema_version!=='RAG_SMAX_REVIEW_V0'||
     review.source_sha256!==pkg.source.sha256||
     !exact(review.semantic_roles,roles)||
     review.semantic_roles.order_id!=='order_id'||
     review.semantic_roles.quantity!=='quantity'||
     review.semantic_roles.line_amount_krw!=='amount_krw'||
     review.currency!=='KRW'||review.amount_unit!=='KRW_INTEGER'||
     review.amount_meaning!=='LINE_TOTAL'||
     !['TAX_INCLUDED','TAX_EXCLUDED','TAX_NOT_APPLICABLE'].includes(review.tax_basis)||
     !Array.isArray(review.source_records)||review.source_records.length!==rows||
     review.source_records.some((x,i)=>x!==i+2)||
     !['HOLD','CONFIRM_FOR_NEXT_GATE'].includes(review.decision)||
     review.acknowledgement!=='I_CHECKED_SOURCE_FIELDS_TAX_AND_ALL_ROWS')
    issue('REVIEW_PLAN_INVALID');
  return report(review.decision==='HOLD'?'REVIEW_HOLD':'REVIEW_RECORD_READY',rows);
}
