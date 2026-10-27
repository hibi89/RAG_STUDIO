/** P5.20 synthetic-only, reproducible, disk-local retrieval corpus.
 * The existing V0 contract bounds files to <=100, so maximum here is 96 docs + one dataset.
 * No customer data or copyrighted corpus and no external dependencies.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const reference=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const topics=['입고','검품','포장','운송','검수','자재','청소','정비','보관','납품','교정','품질'];
const codeFor=i=>'ZX'+String(i+1).padStart(4,'0');
const nameFor=i=>'document-scale-'+String(i+1).padStart(3,'0');
export function createSyntheticCorpus(documentCount,{lineCount=12}={}){
 if(!Number.isInteger(documentCount)||documentCount<2||documentCount>96||
   !Number.isInteger(lineCount)||lineCount<2||lineCount>50)
   throw Error('SYNTHETIC_CORPUS_LIMIT');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p520-'));
 try{
   fs.copyFileSync(path.join(reference,'sales.csv'),path.join(root,'sales.csv'));
   const manifest=JSON.parse(fs.readFileSync(path.join(reference,'manifest.json'),'utf8'));
   manifest.project_id='synthetic-scale-'+documentCount;
   manifest.files=manifest.files.filter(x=>x.kind==='dataset');
   manifest.documents=[];
   for(let i=0;i<documentCount;i++){
     const code=codeFor(i),topic=topics[i%topics.length],id=nameFor(i);
     const filename=id+'.txt';
     const lines=[
       '[SYNTHETIC BENCHMARK] 항목 '+code+' '+topic+' 작업 규정',
       '품번 '+code+' 관련 '+topic+' 검사 표준은 문서 검토자가 확인합니다.'
     ];
     for(let line=2;line<lineCount;line++)
       lines.push(topic+' 운영 기록 '+line+'단계: 준비 정리 조치 절차 확인. 테스트 시나리오 전용 자료.');
     const bytes=Buffer.from(lines.join('\n')+'\n','utf8');
     fs.writeFileSync(path.join(root,filename),bytes,{flag:'wx'});
     const fileId='file-scale-'+String(i+1).padStart(3,'0');
     manifest.files.push({file_id:fileId,relative_path:filename,kind:'document',
       sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
       size_bytes:bytes.length,import_status:'ACCEPTED'});
     manifest.documents.push({document_id:id,file_id:fileId,language:'ko',
       source_title:'합성 '+code+' '+topic,page_info:'lines:1-'+lineCount,
       index_status:'NOT_INDEXED'});
   }
   manifest.processing_summary={accepted:documentCount+1,needs_review:0,rejected:0,
     failed_file_ids:[],unsupported:[]};
   fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
   return {root,documentCount,lineCount,close:()=>fs.rmSync(root,{recursive:true,force:true})};
 }catch(e){fs.rmSync(root,{recursive:true,force:true});throw e;}
}
/** Independent labels come from generation metadata, never from either retriever's output. */
export function makeCases(documentCount){
 if(!Number.isInteger(documentCount)||documentCount<2||documentCount>96)
   throw Error('INVALID_DOCUMENT_COUNT');
 const cases=[];
 for(let family=0;family<4;family++)for(let i=0;i<30;i++){
   const index=(i*7+family*11)%documentCount;
   const code=codeFor(index),topic=topics[index%topics.length];
   const variant=[
     code+' '+topic+' 검사 표준',
     'ZX '+code.slice(2)+' '+topic+' 확인',
     'ZY'+code.slice(2)+' '+topic+' 점검',
     topic+' '+code+' 작업 규정'
   ][family]+(i>=documentCount?' 자세히':'');
   cases.push({question:variant,expected:nameFor(index),family:['exact','separator','typo','reordered'][family]});
 }
 // Hard negatives have no synthetic-code or topical terms and should not be "answered".
 const negatives=Array.from({length:12},(_,i)=>({
   question:['퀘이사 은하 우주','외계행성 블랙홀 성간','화산암 광물 퇴적','해마 산호 군락'][i%4]+
      ' '+['광학현상','천문관측','지구과학','행성학'][Math.floor(i/4)],
   expected:null,family:'out_of_scope'
 }));
 return [...cases,...negatives];
}
