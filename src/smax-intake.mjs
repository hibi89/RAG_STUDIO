/** RAG-owned, public *read-only* SMAX V1 boundary: shape/provenance gate only.
 * Never imports Private SMAX implementation, approves rows, or exports raw cells.
 * This is deliberately NOT a replacement for the SMAX producer's full validator.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
const version='SMAX_PREPROCESS_GENERIC_CSV_V1';
const allowedTypes=new Set(['text','integer','decimal','date','boolean']);
const allowedIssues=new Set(['MISSING_REQUIRED','INVALID_DATE','INVALID_DECIMAL','INVALID_INTEGER','INVALID_BOOLEAN','FORMULA_RISK','UNMAPPED_FORMULA_RISK','DUPLICATE_SOURCE_ROW']);
const MAX_JSON_BYTES=4*1024*1024,MAX_CSV_BYTES=2*1024*1024;
const own=(x,k)=>Object.hasOwn(x,k);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(x);
const nat=x=>Number.isSafeInteger(x)&&x>=0;
// Reject ambiguous Unicode/control headers without importing Private SMAX code.
const unsafeHeader=/[\u0000-\u001f\u007f-\u009f\p{Default_Ignorable_Code_Point}]/u;
const canonicalHeader=x=>x.normalize('NFKC').toLocaleLowerCase('ko-KR');
function sameKeys(x,expected){
  return obj(x)&&Object.keys(x).length===expected.length&&expected.every(k=>own(x,k));
}
function fail(code){throw Object.assign(new Error('SMAX bridge refused invalid or unapproved input'),{code});}
function validateShape(pkg){
  if(!sameKeys(pkg,['schema_version','source','fields','rows','review_queue','quality','processing_mode','approval'])||
     pkg.schema_version!==version||pkg.processing_mode!=='DETERMINISTIC_LOCAL'||
     pkg.approval!=='NOT_GRANTED')fail('CONTRACT_OR_APPROVAL_INVALID');
  const s=pkg.source,q=pkg.quality;
  if(!sameKeys(s,['format','sha256','bytes','headers','source_rows'])||
     s.format!=='UTF8_CSV'||!/^[a-f0-9]{64}$/.test(s.sha256)||
     !nat(s.bytes)||s.bytes>MAX_CSV_BYTES||!nat(s.source_rows)||
     !Array.isArray(s.headers)||!s.headers.length||s.headers.length>256||
     s.headers.some(x=>typeof x!=='string'||!x||x!==x.trim()||unsafeHeader.test(x))||
     new Set(s.headers.map(canonicalHeader)).size!==s.headers.length)fail('SOURCE_METADATA_INVALID');
  if(!Array.isArray(pkg.fields)||pkg.fields.length<1||pkg.fields.length>64||
     !Array.isArray(pkg.rows)||pkg.rows.length>100000||
     !Array.isArray(pkg.review_queue)||pkg.review_queue.length>pkg.rows.length||
     s.source_rows!==pkg.rows.length)fail('STRUCTURE_INVALID');
  const mapped=new Set(),headers=new Set();
  for(const f of pkg.fields){
    if(!sameKeys(f,['key','source','type','required'])||!id(f.key)||
       typeof f.source!=='string'||!s.headers.includes(f.source)||
       !allowedTypes.has(f.type)||typeof f.required!=='boolean'||
       mapped.has(f.key)||headers.has(f.source))fail('FIELD_MAPPING_INVALID');
    mapped.add(f.key);headers.add(f.source);
  }
  if(!sameKeys(q,['input_rows','output_rows','review_rows','exact_duplicate_rows','missing_required_cells','invalid_cells','formula_risk_cells'])||
     Object.values(q).some(n=>!nat(n))||
     q.input_rows!==pkg.rows.length||q.output_rows!==pkg.rows.length)fail('QUALITY_INVALID');
  let reviews=0,duplicates=0,missing=0,invalid=0,formula=0;
  const expectedReview=[];
  const allSeen=new Set();
  for(let i=0;i<pkg.rows.length;i++){
    const row=pkg.rows[i];
    if(!sameKeys(row,['source_record','source_cells','values','status','issues'])||
       row.source_record!==i+2||!Array.isArray(row.source_cells)||
       row.source_cells.length!==s.headers.length||
       row.source_cells.some(x=>typeof x!=='string')||!obj(row.values)||
       Object.keys(row.values).length!==mapped.size||
       [...mapped].some(k=>!own(row.values,k)||
           !(row.values[k]===null||typeof row.values[k]==='string'||typeof row.values[k]==='boolean'))||
       !Array.isArray(row.issues)||row.issues.length>64)fail('ROW_STRUCTURE_INVALID');
    const duplicate=allSeen.has(JSON.stringify(row.source_cells));
    allSeen.add(JSON.stringify(row.source_cells));
    if(duplicate)duplicates++;
    let seenDup=false;
    for(const issue of row.issues){
      if(!sameKeys(issue,['field','code'])||!allowedIssues.has(issue.code)||
         !(issue.field===null||mapped.has(issue.field)))fail('ISSUE_INVALID');
      if(issue.code==='DUPLICATE_SOURCE_ROW'){if(seenDup||!duplicate||issue.field!==null)fail('DUPLICATE_PROVENANCE_INVALID');seenDup=true;}
      else if(issue.code==='UNMAPPED_FORMULA_RISK'){
        if(typeof issue.field!=='string'||!s.headers.includes(issue.field)||headers.has(issue.field))fail('ISSUE_INVALID');
      }else if(issue.field===null)fail('ISSUE_INVALID');
      if(issue.code==='MISSING_REQUIRED')missing++;
      else if(issue.code==='FORMULA_RISK'||issue.code==='UNMAPPED_FORMULA_RISK')formula++;
      else if(issue.code.startsWith('INVALID_'))invalid++;
    }
    if(duplicate!==seenDup)fail('DUPLICATE_PROVENANCE_INVALID');
    const needsReview=row.issues.length>0;
    if(row.status!==(needsReview?'NEEDS_REVIEW':'READY_FOR_HUMAN_REVIEW'))fail('ROW_APPROVAL_INVALID');
    if(needsReview){reviews++;expectedReview.push({source_record:row.source_record,issues:row.issues});}
  }
  if(q.review_rows!==reviews||q.exact_duplicate_rows!==duplicates||
     q.missing_required_cells!==missing||q.invalid_cells!==invalid||
     q.formula_risk_cells!==formula||pkg.review_queue.length!==expectedReview.length||
     pkg.review_queue.some((r,i)=>JSON.stringify(r)!==JSON.stringify(expectedReview[i])))fail('REVIEW_COUNTERS_INVALID');
  // Never assert verified normalized values here: private producer retains that responsibility.
  return {source_rows:s.source_rows,mapped_fields:mapped.size,review_rows:reviews,source_sha256:s.sha256,source_bytes:s.bytes};
}
function readFileSafe(filePath,limit){
  if(typeof filePath!=='string'||!filePath.trim())fail('PATH_REQUIRED');
  let fd;
  try{
    const st=fs.lstatSync(filePath);
    if(!st.isFile()||st.isSymbolicLink()||st.size>limit)fail('FILE_UNSAFE');
    fd=fs.openSync(filePath,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
    const live=fs.fstatSync(fd);
    if(!live.isFile()||live.size>limit||live.dev!==st.dev||live.ino!==st.ino)fail('FILE_UNSAFE');
    const bytes=fs.readFileSync(fd);
    if(bytes.length!==live.size||bytes.length>limit)fail('FILE_UNSAFE');
    return bytes;
  }catch(e){if(e?.code&&String(e.code).startsWith('CONTRACT'))throw e;fail('FILE_UNSAFE');}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
const decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
/**
 * Inspects an *unapproved* SMAX result, optionally hashes the original CSV.
 * Return report contains only counts & fixed codes, never raw fields, rows or paths.
 */
export function inspectSmaxV1(pkg,{sourceBytes=null}={}){
  const info=validateShape(pkg);
  let provenance='SOURCE_BYTES_NOT_SUPPLIED';
  if(sourceBytes!==null){
    if(!Buffer.isBuffer(sourceBytes)||sourceBytes.length!==info.source_bytes||
       crypto.createHash('sha256').update(sourceBytes).digest('hex')!==info.source_sha256)
      fail('SOURCE_DIGEST_MISMATCH');
    provenance='SOURCE_DIGEST_VERIFIED';
  }
  return Object.freeze({
    status:'REVIEW_REQUIRED',
    schema_version:version,
    source_rows:info.source_rows,
    mapped_fields:info.mapped_fields,
    review_rows:info.review_rows,
    provenance,
    acceptance:'NOT_GRANTED',
    ax_package_created:false,
    reason:'Requires explicit field-semantic approval, original source review and AX_DATA_PACKAGE_V0 producer contract'
  });
}
export function inspectSmaxFiles(jsonPath,csvPath=null){
  try{
    const data=readFileSafe(jsonPath,MAX_JSON_BYTES);
    const pkg=JSON.parse(decode(data));
    const source=csvPath===null?null:readFileSafe(csvPath,MAX_CSV_BYTES);
    return inspectSmaxV1(pkg,{sourceBytes:source});
  }catch{
    // Do not reveal untrusted filenames, malformed source values or parser exceptions.
    return Object.freeze({status:'REJECTED',code:'SMAX_CONTRACT_OR_PROVENANCE_INVALID',ax_package_created:false});
  }
}
