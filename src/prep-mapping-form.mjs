/** P5.48: local, offline human-editable metadata-only PREP mapping form. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildRagPrepMappingPlan} from './prep-mapping-plan.mjs';
const fail=()=>{throw Object.assign(new Error('RAG_PREP_FORM_BLOCKED'),{code:'RAG_PREP_FORM_BLOCKED'});};
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const TYPES=['text','integer','decimal','date','boolean'];
const script=String.raw`
'use strict';
(()=>{
 const sha=document.querySelector('#source-sha').textContent;
 const rows=[...document.querySelectorAll('tr[data-source]')];
 const button=document.querySelector('#export');
 const notice=document.querySelector('#notice');
 button.addEventListener('click',()=>{
  const mappings=[];
  const usedKeys=new Set();
  for(const row of rows){
   const key=row.querySelector('input[data-key]').value.trim();
   const source=row.dataset.source;
   const type=row.querySelector('select[data-type]').value;
   const required=row.querySelector('input[data-required]').checked;
   if(!/^[a-z][a-z0-9_]{0,63}$/.test(key)||usedKeys.has(key)||!['text','integer','decimal','date','boolean'].includes(type)){
    notice.textContent='매핑 키는 고유한 소문자 영문/숫자/밑줄이어야 합니다. 모든 컬럼을 지정하세요.';
    return;
   }
   usedKeys.add(key);
   mappings.push({key,source,type,required});
  }
  const draft={contract:'RAG_PREP_MAPPING_DRAFT_V1',source_sha256:sha,requested_mapping:mappings};
  const blob=new Blob([JSON.stringify(draft,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='rag-prep-mapping-draft.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
  notice.textContent='초안 다운로드 완료. 승인이나 데이터 가져오기는 수행되지 않았습니다.';
 });
})();`;
const style=`:root{color-scheme:light;font:16px system-ui,sans-serif}body{margin:2rem auto;max-width:960px;padding:0 1rem;color:#182230}h1{font-size:1.6rem}table{border-collapse:collapse;width:100%;margin-top:1rem}th,td{border:1px solid #c9d1d9;padding:.65rem;text-align:left}th{background:#f1f5f9}input,select{font:inherit;padding:.4rem;max-width:12rem}button{font:inherit;padding:.7rem 1.1rem;background:#172554;color:#fff;border:0;border-radius:6px;cursor:pointer}#notice{min-height:1.5rem}code{overflow-wrap:anywhere}small{color:#48566a}`;
export function createRagPrepMappingForm(review){
 const plan=buildRagPrepMappingPlan(review);
 if(plan.status!=='REVIEW_HOLD'||plan.approval!=='NOT_GRANTED'||!Array.isArray(plan.proposed_columns))fail();
 const rows=plan.proposed_columns.map(c=>{
  const name=esc(c.source);
  const options=TYPES.map(t=>`<option value="${t}"${t===(c.inferred_type??'text')?' selected':''}>${t}</option>`).join('');
  return `<tr data-source="${name}"><td>${esc(c.column_index)}</td><td>${name}</td><td>${esc(c.inferred_type??'needs review')}</td><td><input data-key maxlength="64" aria-label="${name} target key" required pattern="[a-z][a-z0-9_]{0,63}"></td><td><select data-type aria-label="${name} type">${options}</select></td><td><input data-required type="checkbox" checked aria-label="${name} required"></td></tr>`;
 }).join('\n');
 const scriptHash=crypto.createHash('sha256').update(script,'utf8').digest('base64');
 // Embedded JS is constant, never interpolated with customer metadata.
 const csp=`default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
 return `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${esc(csp)}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RAG PREP local mapping review</title><style>${style}</style></head><body><h1>RAG Studio — 컬럼 매핑 초안</h1><p>로컬 검토 전용입니다. 데이터 읽기·승인·SQLite 가져오기·외부 전송을 실행하지 않습니다.</p><p>원본 SHA-256: <code id="source-sha">${plan.source_sha256}</code></p><small>원본 행은 이 HTML에 포함되지 않습니다. 열 이름은 업무 정보를 드러낼 수 있으므로 HTML/JSON 파일을 외부 공유하지 마세요.</small><table><thead><tr><th>#</th><th>CSV 원본열</th><th>추론 타입</th><th>매핑 키(직접 입력)</th><th>목표 타입</th><th>필수</th></tr></thead><tbody>${rows}</tbody></table><p><button id="export" type="button">매핑 JSON 초안 저장</button></p><p role="status" id="notice" aria-live="polite"></p><p><small>저장한 JSON을 CSV와 함께 prep-mapping-review-cli.mjs에서 다시 검증해야 합니다. 결과는 항상 REVIEW_HOLD/NOT_GRANTED입니다.</small></p><script>${script}</script></body></html>\n`;
}
export function writeRagPrepMappingForm(review,filename){
 if(typeof filename!=='string'||!path.isAbsolute(filename)||path.extname(filename).toLowerCase()!=='.html')fail();
 const html=createRagPrepMappingForm(review);
 if(Buffer.byteLength(html)>256*1024)fail();
 // Refuse overwrite, symlink traversal at final name, or exposing permissions by default.
 let fd;
 try{fd=fs.openSync(filename,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY,0o600);
 fs.writeFileSync(fd,html,{encoding:'utf8'});fs.fsyncSync(fd);
 }catch{fail();}finally{if(fd!==undefined)fs.closeSync(fd);}
 return {status:'FORM_CREATED_REVIEW_HOLD',file_created:true,source_sha256:review.source_sha256,
   ax_package_created:false,sqlite_imported:false,remote_upload:false,approved:false};
}
