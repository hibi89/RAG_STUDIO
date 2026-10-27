/**
 * P4.2: tightly allowlisted SYNTHETIC-ONLY SMAX V1 -> AX_DATA_PACKAGE_V0 demo.
 *
 * The review challenge is an in-process confirmation step, NOT human identity,
 * a digital signature, or a production approval system. No private SMAX code.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {inspectSmaxV1} from './smax-intake.mjs';
import {aggregateSales} from './summary.mjs';

const SALES_SHA='8213907ae23423c34db415c0e31f8113eccceed9fdbc2bb4557e1b6ea31e03b9';
const POLICY_SHA='906d20338fc26e3e755abd24ed04cc62b9fd8d51c079805b073e4609d360a950';
const PROJECT_ID='synthetic-smax-p42-demo';
const HEADERS=['order_id','sku','quantity','unit_price_krw','amount_krw'];
const MAX_SAFE=BigInt(Number.MAX_SAFE_INTEGER);
const approvals=new WeakMap(),bundles=new WeakMap();
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
function refuse(code){
  const e=new Error('Synthetic AX export gate refused');
  e.code=code;
  throw e;
}
function rowsFromSource(bytes,expectedCount){
  if(!Buffer.isBuffer(bytes)||bytes.length>2*1024*1024)refuse('SOURCE_BYTES_REQUIRED');
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{refuse('SOURCE_UTF8_INVALID');}
  if(!text.endsWith('\n')||text.includes('\r')||text.includes('"')||
     /[\u0000-\u0009\u000b-\u001f\u007f]/u.test(text))refuse('UNSUPPORTED_CSV');
  const lines=text.slice(0,-1).split('\n');
  if(lines.length!==expectedCount+1||lines.some(x=>x.length===0))refuse('ROW_COUNT_MISMATCH');
  const rows=lines.map(x=>x.split(','));
  if(rows.some(r=>r.length!==HEADERS.length)||
     HEADERS.some((h,i)=>rows[0][i]!==h))refuse('UNSUPPORTED_COLUMNS');
  return rows.slice(1);
}
function checkedInteger(text,allowZero=true){
  if(typeof text!=='string'||!/^(0|[1-9][0-9]*)$/.test(text))refuse('NUMBER_INVALID');
  const value=BigInt(text);
  if(value>MAX_SAFE||(!allowZero&&value===0n))refuse('NUMBER_RANGE');
  return value;
}
/** Independent consumer verification of all source rows; SMAX clean != approved. */
function verifySyntheticInputs(v1,sourceBytes,policyBytes){
  const gate=inspectSmaxV1(v1,{sourceBytes});
  if(gate.status!=='REVIEW_REQUIRED'||gate.provenance!=='SOURCE_DIGEST_VERIFIED')
    refuse('SMAX_GATE_INVALID');
  if(hash(sourceBytes)!==SALES_SHA||!Buffer.isBuffer(policyBytes)||
     hash(policyBytes)!==POLICY_SHA)refuse('SYNTHETIC_ALLOWLIST_ONLY');
  let policy;
  try{policy=new TextDecoder('utf-8',{fatal:true}).decode(policyBytes);}
  catch{refuse('POLICY_ENCODING_INVALID');}
  if(!policy.includes('테스트용 합성 데이터'))refuse('POLICY_NOT_SYNTHETIC');
  if(v1.source.headers.length!==HEADERS.length||
     HEADERS.some((h,i)=>v1.source.headers[i]!==h)||
     v1.fields.length!==HEADERS.length||
     v1.quality.review_rows!==0||v1.review_queue.length!==0)refuse('REVIEW_OR_MAPPING_UNSUPPORTED');
  for(let i=0;i<HEADERS.length;i++){
    const f=v1.fields[i];
    if(f.key!==HEADERS[i]||f.source!==HEADERS[i]||f.required!==true||
       f.type!==(i<2?'text':'integer'))refuse('REVIEW_OR_MAPPING_UNSUPPORTED');
  }
  const rows=rowsFromSource(sourceBytes,v1.rows.length);
  const orders=new Set();
  let revenue=0n,units=0n;
  for(let i=0;i<rows.length;i++){
    const values=rows[i],item=v1.rows[i];
    if(item.source_record!==i+2||item.status!=='READY_FOR_HUMAN_REVIEW'||
       item.issues.length!==0||
       JSON.stringify(item.source_cells)!==JSON.stringify(values)||
       HEADERS.some((h,j)=>item.values[h]!==values[j]))
      refuse('PROVENANCE_OR_NORMALIZATION_MISMATCH');
    const [order,sku,q,p,a]=values;
    if(!/^[A-Z0-9-]{1,40}$/.test(order)||orders.has(order)||
       !/^[A-Z0-9-]{1,40}$/.test(sku))refuse('BUSINESS_ID_INVALID');
    orders.add(order);
    const qty=checkedInteger(q,false),price=checkedInteger(p),amount=checkedInteger(a);
    if(qty*price!==amount)refuse('AMOUNT_ARITHMETIC_INVALID');
    revenue+=amount;units+=qty;
    if(revenue>MAX_SAFE||units>MAX_SAFE)refuse('TOTAL_OVERFLOW');
  }
  return Object.freeze({row_count:rows.length,revenue_krw:revenue.toString(),
    units:units.toString(),source_sha256:SALES_SHA,policy_sha256:POLICY_SHA});
}
/** In-process, ephemeral, single-use confirmation challenge. No reviewer identity claim. */
export function beginSyntheticExport(v1,sourceBytes,policyBytes){
  const info=verifySyntheticInputs(v1,sourceBytes,policyBytes);
  const digest=hash(Buffer.from(PROJECT_ID+':'+SALES_SHA+':'+POLICY_SHA));
  const challenge='CONFIRM SYNTHETIC '+digest.slice(0,16).toUpperCase();
  const handle=Object.freeze({
    status:'AWAITING_EXPLICIT_SYNTHETIC_CONFIRMATION',
    project_id:PROJECT_ID,source_rows:info.row_count,
    review_challenge:challenge,
    export_allowed:false,reviewer_identity_verified:false
  });
  approvals.set(handle,{v1:structuredClone(v1),source:Buffer.from(sourceBytes),
    policy:Buffer.from(policyBytes),info,challenge,used:false});
  return handle;
}
export function syntheticReviewPlan(handle){
  if(!approvals.has(handle))refuse('INVALID_CHALLENGE');
  const state=approvals.get(handle);
  if(state.used)refuse('CHALLENGE_USED');
  return Object.freeze({
    schema_version:'RAG_SYNTHETIC_APPROVAL_V0',
    project_id:PROJECT_ID,
    source_sha256:SALES_SHA,
    document_sha256:POLICY_SHA,
    semantic_roles:Object.freeze([...HEADERS]),
    currency:'KRW',amount_unit:'KRW_INTEGER',
    amount_meaning:'QUANTITY_TIMES_UNIT_PRICE',
    tax_basis:'TAX_NOT_APPLICABLE',
    source_records:Object.freeze(Array.from({length:state.info.row_count},(_,i)=>i+2)),
    decision:'CONFIRM_SYNTHETIC_EXPORT',
    acknowledgement:'SYNTHETIC_DEMO_ONLY_NO_CUSTOMER_APPROVAL'
  });
}
function checkPlan(plan,reference){
  if(!exact(plan,['schema_version','project_id','source_sha256','document_sha256',
    'semantic_roles','currency','amount_unit','amount_meaning','tax_basis',
    'source_records','decision','acknowledgement'])||
    !Object.entries(reference).every(([k,v])=>JSON.stringify(plan[k])===JSON.stringify(v)))
    refuse('EXPLICIT_REVIEW_PLAN_INVALID');
}
function createBundle(state){
  const sales=Buffer.from(state.source),policy=Buffer.from(state.policy);
  const files=[
    {file_id:'file-sales',relative_path:'sales.csv',kind:'dataset',
      sha256:hash(sales),size_bytes:sales.length,import_status:'ACCEPTED'},
    {file_id:'file-policy',relative_path:'returns_policy.txt',kind:'document',
      sha256:hash(policy),size_bytes:policy.length,import_status:'ACCEPTED'}
  ];
  const manifest={
    schema_version:'AX_DATA_PACKAGE_V0',project_id:PROJECT_ID,
    created_at_utc:'2026-10-27T00:00:00Z',files,
    datasets:[{dataset_id:'dataset-sales',file_id:'file-sales',
      row_count:state.info.row_count,provenance_mode:'csv_line_1_based',
      columns:HEADERS.map((name,i)=>({name,type:i<2?'string':'integer',
        source_column:name,review_status:'APPROVED'}))}],
    documents:[{document_id:'document-returns',file_id:'file-policy',
      language:'ko',source_title:'합성 반품 규정',page_info:'lines:1-4',index_status:'NOT_INDEXED'}],
    review_items:[],processing_summary:{accepted:2,needs_review:0,rejected:0,
      failed_file_ids:[],unsupported:[]}
  };
  const bundle=Object.freeze({status:'SYNTHETIC_AX_BUNDLE_PREPARED',
    project_id:PROJECT_ID,source_rows:state.info.row_count,
    reviewer_identity_verified:false,customer_data_allowed:false,
    output_written:false});
  bundles.set(bundle,{manifest,sales,policy,used:false});
  return bundle;
}
/** This proves an explicit call/typed challenge, NOT trusted real-human authorization. */
export function confirmSyntheticExport(handle,typedChallenge,plan){
  const state=approvals.get(handle);
  if(!state||state.used)refuse('INVALID_OR_USED_CHALLENGE');
  if(typedChallenge!==state.challenge)refuse('CHALLENGE_NOT_CONFIRMED');
  checkPlan(plan,syntheticReviewPlan(handle));
  verifySyntheticInputs(state.v1,state.source,state.policy);
  state.used=true;
  return createBundle(state);
}
/** Write an exclusive NEW directory, then verify using the actual RAG SQL contract. */
export function writeSyntheticAxBundle(bundle,targetDirectory){
  const data=bundles.get(bundle);
  if(!data||data.used)refuse('INVALID_OR_USED_BUNDLE');
  if(typeof targetDirectory!=='string'||!targetDirectory.trim())refuse('TARGET_REQUIRED');
  // No recursive mkdir or existing-directory overwrite. Synthetic payload only.
  fs.mkdirSync(targetDirectory,{mode:0o700});
  data.used=true;
  try{
    for(const [name,bytes] of [['sales.csv',data.sales],['returns_policy.txt',data.policy]]){
      fs.writeFileSync(path.join(targetDirectory,name),bytes,{flag:'wx',mode:0o600});
    }
    fs.writeFileSync(path.join(targetDirectory,'manifest.json'),
      JSON.stringify(data.manifest,null,2)+'\n',{flag:'wx',mode:0o600});
    const verified=aggregateSales(targetDirectory); // Calls loadPackage and checks all sums.
    if(verified.orders!==data.manifest.datasets[0].row_count||
       verified.revenue_krw!=='157000'||verified.units!=='10')
       refuse('POST_EXPORT_ASSERTION_FAILED');
    return Object.freeze({status:'SYNTHETIC_AX_VERIFIED',project_id:PROJECT_ID,
      orders:verified.orders,revenue_krw:verified.revenue_krw,units:verified.units,
      reviewer_identity_verified:false,customer_data_allowed:false});
  }catch{
    // Removing only the directory created exclusively by this invocation.
    fs.rmSync(targetDirectory,{recursive:true,force:true});
    refuse('SYNTHETIC_WRITE_OR_VERIFICATION_FAILED');
  }
}
