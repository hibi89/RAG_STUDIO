/** P5.2: fail-closed negative-evidence regression on local PUBLIC SYNTHETIC data only.
 * Each case copies a verified immutable seed into an exclusive temporary directory.
 * No customer data, private SMAX source, network or user-provided fixture mutations.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadPackage} from './validate.mjs';
import {routeQuestion} from './evidence-router.mjs';

const ROOT_PROJECT='synthetic-shop-001';
const SALES_SHA='8213907ae23423c34db415c0e31f8113eccceed9fdbc2bb4557e1b6ea31e03b9';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const MIXED='총 매출과 반품 기간, 배송 준비 기간은?';
const RETURNS='반품 신청 기간은?';
const SHIPPING='배송 준비는 언제 시작해?';
const SALES='총 매출 알려줘';

function manifestFile(d){return path.join(d,'manifest.json');}
function mutateManifest(d,fn) {
  const file=manifestFile(d),m=JSON.parse(fs.readFileSync(file,'utf8'));
  fn(m);
  fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n',{flag:'w'});
}
function replaceText(d,name,body) {
  const bytes=Buffer.from(body,'utf8');
  fs.writeFileSync(path.join(d,name),bytes,{flag:'w'});
  mutateManifest(d,m=>{
    const f=m.files.find(x=>x.relative_path===name);
    if(!f)throw new Error('CASE_SETUP_INVALID');
    f.sha256=hash(bytes);f.size_bytes=bytes.length;
  });
}
function addDocument(d,id,body) {
  const name=id+'.txt',bytes=Buffer.from(body,'utf8');
  fs.writeFileSync(path.join(d,name),bytes,{flag:'wx'});
  mutateManifest(d,m=>{
    m.files.push({file_id:'file-'+id,relative_path:name,kind:'document',
      sha256:hash(bytes),size_bytes:bytes.length,import_status:'ACCEPTED'});
    m.documents.push({document_id:'document-'+id,file_id:'file-'+id,
      language:'ko',source_title:'합성 충돌 검사',page_info:'lines:1-2',index_status:'NOT_INDEXED'});
    m.processing_summary.accepted++;
  });
}
function setUnapproved(d,name) {
  mutateManifest(d,m=>{
    const f=m.files.find(x=>x.relative_path===name);
    if(!f||f.import_status!=='ACCEPTED')throw new Error('CASE_SETUP_INVALID');
    f.import_status='NEEDS_REVIEW';m.processing_summary.accepted--;
    m.processing_summary.needs_review++;
  });
}
function tamper(d,name) {
  fs.appendFileSync(path.join(d,name),Buffer.from('\nUNVERIFIED_APPEND\n','utf8'));
}
const expectation=(status,question,setup,periods=null,error=null)=>Object.freeze({status,question,setup,periods,error});
const cases=Object.freeze([
  {id:'control-mixed-approved',e:expectation('ANSWERED',MIXED,()=>{},[7,2])},
  {id:'conflict-return-extra-doc',e:expectation('POSSIBLE_CONFLICT',RETURNS,d=>addDocument(d,'return-conflict','[SYNTHETIC]\n상품 수령 후 14일 이내 반품 신청 가능.\n'),[7,14])},
  {id:'conflict-shipping-extra-doc',e:expectation('POSSIBLE_CONFLICT',SHIPPING,d=>addDocument(d,'shipping-conflict','[SYNTHETIC]\n배송 준비는 결제 후 5영업일 이내 시작됩니다.\n'),[2,5])},
  {id:'conflict-return-single-line',e:expectation('POSSIBLE_CONFLICT',RETURNS,d=>replaceText(d,'returns_policy.txt','[SYNTHETIC]\n반품 신청은 7일 이내 가능하거나 14일 이내 가능합니다.\n'),[7,14])},
  {id:'conflict-shipping-single-line',e:expectation('POSSIBLE_CONFLICT',SHIPPING,d=>replaceText(d,'shipping_policy.txt','[SYNTHETIC]\n배송 준비는 2영업일 이내 또는 5영업일 이내 시작됩니다.\n'),[2,5])},
  {id:'conflict-below-top-ten',e:expectation('POSSIBLE_CONFLICT',RETURNS,d=>{
    for(let i=0;i<12;i++)addDocument(d,'return-filler-'+i,'[SYNTHETIC]\n반품 신청 가능 기간은 7일 이내 입니다.\n');
    addDocument(d,'return-hidden-conflict','[SYNTHETIC]\n반품 신청 가능 기간은 30일 이내 입니다.\n');
  },[7,30])},
  {id:'insufficient-return-unapproved',e:expectation('INSUFFICIENT_EVIDENCE',RETURNS,d=>setUnapproved(d,'returns_policy.txt'))},
  {id:'insufficient-shipping-unapproved',e:expectation('INSUFFICIENT_EVIDENCE',SHIPPING,d=>setUnapproved(d,'shipping_policy.txt'))},
  {id:'insufficient-return-no-period',e:expectation('INSUFFICIENT_EVIDENCE',RETURNS,d=>replaceText(d,'returns_policy.txt','[SYNTHETIC]\n반품 문의는 고객센터에서 확인하세요.\n'))},
  {id:'insufficient-shipping-no-period',e:expectation('INSUFFICIENT_EVIDENCE',SHIPPING,d=>replaceText(d,'shipping_policy.txt','[SYNTHETIC]\n배송 준비 일정은 담당자에게 문의하세요.\n'))},
  {id:'mixed-no-partial-return-missing',e:expectation('INSUFFICIENT_EVIDENCE',MIXED,d=>setUnapproved(d,'returns_policy.txt'))},
  {id:'mixed-no-partial-shipping-conflict',e:expectation('POSSIBLE_CONFLICT',MIXED,d=>addDocument(d,'ship-mixed-conflict','[SYNTHETIC]\n배송 준비는 결제 후 9영업일 이내 시작됩니다.\n'),[2,9])},
  {id:'tampered-accepted-txt',e:expectation('REJECTED_INVALID',RETURNS,d=>tamper(d,'returns_policy.txt'),null,/sha256|size/)},
  {id:'tampered-accepted-sales',e:expectation('REJECTED_INVALID',SALES,d=>tamper(d,'sales.csv'),null,/sha256|size/)},
  {id:'tampered-manifest-sha',e:expectation('REJECTED_INVALID',SHIPPING,d=>mutateManifest(d,m=>{m.files.find(x=>x.relative_path==='shipping_policy.txt').sha256='0'.repeat(64);}),null,/sha256/)},
  {id:'manifest-traversal',e:expectation('REJECTED_INVALID',SALES,d=>mutateManifest(d,m=>{m.files[2].relative_path='../outside.txt';}),null,/traversal/)},
  {id:'manifest-broken-document-ref',e:expectation('REJECTED_INVALID',RETURNS,d=>mutateManifest(d,m=>{m.documents[0].file_id='file-missing';}),null,/reference broken/)},
  {id:'manifest-counter-forgery',e:expectation('REJECTED_INVALID',SALES,d=>mutateManifest(d,m=>{m.processing_summary.accepted=2;}),null,/summary/)},
  {id:'manifest-duplicate-document-id',e:expectation('REJECTED_INVALID',SHIPPING,d=>mutateManifest(d,m=>{m.documents[1].document_id=m.documents[0].document_id;}),null,/duplicate/)},
  {id:'manifest-broken-json',e:expectation('REJECTED_INVALID',RETURNS,d=>fs.writeFileSync(manifestFile(d),'{"schema_version":', 'utf8'),null,/invalid JSON/)}
]);

function checkResponse(value,e) {
  if(e.status==='ANSWERED') {
    return value?.status==='ANSWERED'&&value.kind==='SQL_DOCUMENT'&&
      value.metric_evidence?.revenue_krw==='157000'&&value.metric_evidence?.orders===6&&
      Array.isArray(value.document_evidence)&&
      JSON.stringify(value.document_evidence.map(x=>x.period))===JSON.stringify(e.periods)&&
      typeof value.answer==='string'&&value.answer.length>0;
  }
  if(!value||value.status!==e.status||value.answer!==null||
    value.metric_evidence!==undefined||value.document_evidence!==undefined)
    return false;
  if(e.status==='POSSIBLE_CONFLICT') {
    const values=[...new Set((value.review_evidence??[]).map(x=>x.period))].sort((a,b)=>a-b);
    return JSON.stringify(values)===JSON.stringify([...e.periods].sort((a,b)=>a-b))&&
      value.review_evidence?.every(x=>Number.isInteger(x.line)&&x.line>=1&&
        typeof x.file_id==='string'&&typeof x.quote==='string');
  }
  return e.status==='INSUFFICIENT_EVIDENCE'&&
    typeof value.reason==='string'&&value.reason.length>0;
}
/** Safe structured results. Never include text, file paths, raw errors or private data. */
export function evaluateNegativeEvidence(sourceRoot) {
  if(typeof sourceRoot!=='string'||!sourceRoot.trim())throw new Error('SYNTHETIC_ROOT_REQUIRED');
  const seed=loadPackage(sourceRoot);
  if(seed.manifest.project_id!==ROOT_PROJECT||
    seed.manifest.files.find(f=>f.relative_path==='sales.csv')?.sha256!==SALES_SHA)
    throw new Error('NON_CANONICAL_SYNTHETIC_SOURCE');
  const results=[];
  for(const c of cases) {
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p52-negative-'));
    let actual='SETUP_ERROR',passed=false;
    try {
      const d=path.join(temp,'fixture');
      fs.cpSync(sourceRoot,d,{recursive:true,errorOnExist:true,force:false});
      c.e.setup(d);
      try {
        const output=routeQuestion(d,c.e.question);
        actual=typeof output?.status==='string'?output.status:'INVALID_RESPONSE';
        passed=checkResponse(output,c.e);
      } catch(e) {
        actual='REJECTED_INVALID';
        passed=c.e.status==='REJECTED_INVALID'&&
          c.e.error.test(String(e?.message??''));
      }
    } catch {
      actual='SETUP_ERROR';passed=false;
    } finally {
      fs.rmSync(temp,{recursive:true,force:true});
    }
    results.push(Object.freeze({id:c.id,expected:c.e.status,actual,passed}));
  }
  const pass=results.filter(x=>x.passed).length;
  return Object.freeze({schema_version:'RAG_P52_NEGATIVE_EVIDENCE_REPORT_V0',
    synthetic_fixture_only:true,total:results.length,pass,fail:results.length-pass,
    skipped:0,customer_accuracy_verified:false,
    readiness:pass===results.length?'SYNTHETIC_NEGATIVE_GATE_PASS':'SYNTHETIC_NEGATIVE_GATE_FAIL',
    results});
}
