/** P5.51: local CSV provisional metrics + unapproved TXT/MD citation, NOT AX import. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {previewLocalMappedSales} from './prep-mapped-sales.mjs';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const refuse=()=>{throw Object.assign(new Error('RAG_PREP_MIXED_PREVIEW_BLOCKED'),{code:'RAG_PREP_MIXED_PREVIEW_BLOCKED'});};
function readDocument(name){
 if(typeof name!=='string'||!path.isAbsolute(name)||!['.txt','.md'].includes(path.extname(name).toLowerCase()))refuse();
 let fd;
 try{
  const before=fs.lstatSync(name);
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size<1||before.size>256*1024)refuse();
  fd=fs.openSync(name,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  const opened=fs.fstatSync(fd);
  if(!opened.isFile()||opened.nlink!==1||opened.ino!==before.ino||opened.dev!==before.dev||opened.size!==before.size||opened.mtimeMs!==before.mtimeMs)refuse();
  const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd),now=fs.lstatSync(name);
  if(bytes.length!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ino!==before.ino||
      now.isSymbolicLink()||now.nlink!==1||now.ino!==before.ino||now.dev!==before.dev||now.size!==before.size||now.mtimeMs!==before.mtimeMs)refuse();
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(!text.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text))refuse();
  const lines=text.replace(/\r\n/g,'\n').split('\n');
  if(lines.length>500||lines.some(line=>line.length>4096))refuse();
  return Object.freeze({sha256:sha(bytes),size_bytes:bytes.length,lines});
 }catch{refuse();}finally{if(fd!==undefined)fs.closeSync(fd);}
}
function findPolicyEvidence(lines){
 const result=[],days=new Set();
 for(let i=0;i<lines.length;i++){
  const quote=lines[i].trim();
  if(!/(?:반품|환불)/u.test(quote)||!/(?:신청|가능|기간|이내|제한)/u.test(quote))continue;
  if(quote.length>1024)continue;
  const periods=[...quote.matchAll(/(\d{1,3})\s*일\s*이내/gu)].map(x=>Number(x[1]));
  periods.forEach(x=>days.add(x));
  if(result.length<10)result.push(Object.freeze({source_line:i+1,quote,kind:'UNAPPROVED_SOURCE_EXCERPT'}));
 }
 return {result,conflict:days.size>1};
}
export function previewLocalSalesAndPolicy(csvPath,draftPath,documentPath,question){
 if(typeof question!=='string'||question.length<1||question.length>200)refuse();
 if(!/매출|판매\s*금액/u.test(question)||!/(?:반품|환불)/u.test(question))
  return Object.freeze({status:'NOT_SUPPORTED',answer:null,reason:'FIXED_SALES_AND_REFUND_ONLY',
    ax_package_created:false,sqlite_imported:false,document_indexed:false,remote_upload:false});
 const sales=previewLocalMappedSales(csvPath,draftPath);
 const doc=readDocument(documentPath);
 const evidence=findPolicyEvidence(doc.lines);
 // Re-attest CSV even after reading the second source; a stale observation is unusable.
 const rechecked=previewLocalMappedSales(csvPath,draftPath);
 if(rechecked.source_sha256!==sales.source_sha256||rechecked.source_size_bytes!==sales.source_size_bytes||
    JSON.stringify(rechecked.metrics)!==JSON.stringify(sales.metrics))refuse();
 const status=evidence.conflict?'POSSIBLE_CONFLICT':evidence.result.length?'PREVIEW_WITH_CITATIONS':'INSUFFICIENT_DOCUMENT_EVIDENCE';
 return Object.freeze({contract:'RAG_PREP_MIXED_PREVIEW_V1',status,approval:'NOT_GRANTED',
   source_sha256:sales.source_sha256,source_rows:sales.source_rows,
   metric_evidence:Object.freeze({metrics:sales.metrics,source_lines:sales.source_evidence,
      source_evidence_truncated:sales.evidence_truncated}),
   document_evidence:Object.freeze({sha256:doc.sha256,size_bytes:doc.size_bytes,
     source_lines:evidence.result,source_evidence_truncated:evidence.result.length===10}),
   answer:null,reason:status==='PREVIEW_WITH_CITATIONS'?'SOURCES_FOR_HUMAN_REVIEW_ONLY':status,
   blockers:Object.freeze([...sales.blockers,'DOCUMENT_RIGHTS_UNVERIFIED','UNAPPROVED_TEXT_NOT_INDEXED']),
   customer_data_approved:false,source_rights_verified:false,smax_native_approved:false,
   ax_package_created:false,sqlite_imported:false,document_indexed:false,
   remote_upload:false,source_modified:false});
}
