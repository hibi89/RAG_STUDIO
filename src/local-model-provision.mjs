/** P5.25 offline opt-in manifest preparation for separately supplied Xenova E5.
 * This module cannot download, modify source model weights or approve their license.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {verifyLocalModelFolder,verifyPublishedXenovaManifest,
  XENOVA_E5_ID,XENOVA_E5_REVISION,XENOVA_PUBLISHED_BLOBS} from './local-model-preflight.mjs';

const SOURCE='https://huggingface.co/Xenova/multilingual-e5-small';
const MANIFEST='rag_model_manifest.json';
const FILES=new Set(['config.json','tokenizer.json','tokenizer_config.json',
 'special_tokens_map.json','quant_config.json','sentencepiece.bpe.model',
 'sentence_bert_config.json','onnx/model_quantized.onnx']);
const REQUIRED=new Set(['config.json','tokenizer.json','onnx/model_quantized.onnx']);
const MAX_BYTES=800*1024*1024;
function reject(reason){throw Error('P525_'+reason);}
const sha256=p=>{
 const h=crypto.createHash('sha256'),fd=fs.openSync(p,'r'),buffer=Buffer.allocUnsafe(1024*1024);
 let offset=0;
 try{
  for(;;){
   const n=fs.readSync(fd,buffer,0,buffer.length,offset);
   if(n===0)break;
   h.update(buffer.subarray(0,n));offset+=n;
  }
 }finally{fs.closeSync(fd);}
 return h.digest('hex');
};
export function makeCandidateManifest(records){
 if(!Array.isArray(records)||records.length<3||records.length>8)
   reject('INVALID_FILE_COUNT');
 const ids=new Set();
 for(const r of records){
  if(!r||!FILES.has(r.name)||ids.has(r.name)||
    !Number.isSafeInteger(r.size)||r.size<1||
    typeof r.sha256!=='string'||!/^[0-9a-f]{64}$/.test(r.sha256))
    reject('INVALID_FILE_ENTRY');
  ids.add(r.name);
 }
 for(const need of REQUIRED)if(!ids.has(need))reject('MISSING_REQUIRED_ASSETS');
 const sorted=[...records].sort((a,b)=>a.name.localeCompare(b.name,'en'));
 const manifest={model_id:XENOVA_E5_ID,license:'mit',dimension:384,dtype:'q8',
  artifact_source:SOURCE,revision:XENOVA_E5_REVISION,files:sorted};
 // Independently pinned core model/tokenizer/SentencePiece hashes prevent
 // arbitrary local bytes from being labelled as the trusted candidate.
 verifyPublishedXenovaManifest(manifest,{requireRevision:true});
 return manifest;
}
export function inspectOfflineModelFolder(dir){
 if(typeof dir!=='string'||!path.isAbsolute(dir))reject('ABSOLUTE_DIRECTORY_REQUIRED');
 // Do not follow a symlinked model directory/owner parent.
 if(fs.lstatSync(dir).isSymbolicLink()||fs.lstatSync(path.dirname(dir)).isSymbolicLink())
   reject('SYMLINK_ROOT_FORBIDDEN');
 const root=fs.realpathSync(dir);
 if(path.basename(root)!=='multilingual-e5-small'||
   path.basename(path.dirname(root))!=='Xenova')reject('MODEL_PATH_MISMATCH');
 const dest=path.join(root,MANIFEST);
 if(fs.existsSync(dest))reject('MANIFEST_EXISTS_DO_NOT_OVERWRITE');
 let total=0;
 const records=[];
 const visit=(dir,rel='')=>{
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
   const name=rel?rel+'/'+e.name:e.name;
   if(e.isSymbolicLink())reject('SYMLINK_FILE_FORBIDDEN');
   if(e.isDirectory()){
    if(name!=='onnx')reject('UNDECLARED_DIRECTORY');
    visit(path.join(dir,e.name),name);
   }else{
    if(!e.isFile()||!FILES.has(name))reject('UNDECLARED_FILE');
    const file=path.join(dir,e.name),stat=fs.statSync(file);
    if(stat.size<1||stat.size>MAX_BYTES-total)reject('EXCESSIVE_MODEL_BYTES');
    total+=stat.size;
    records.push({name,size:stat.size,sha256:sha256(file)});
   }
  }
 };
 visit(root);
 const manifest=makeCandidateManifest(records);
 return {manifest,status:'LOCAL_FILES_MATCH_PINNED_CORE_HASHES_NOT_LICENSE_CERTIFIED',
   total_bytes:total,verified_files:records.length,physical_ram_bytes:os.totalmem()};
}
export function prepareOfflineModelManifest(dir,{write=false}={}){
 if(typeof write!=='boolean')reject('WRITE_FLAG_INVALID');
 const scanned=inspectOfflineModelFolder(dir);
 if(!write)return {status:'DRY_RUN_NO_FILES_WRITTEN',verified_files:scanned.verified_files,
   total_bytes:scanned.total_bytes,physical_ram_bytes:scanned.physical_ram_bytes,
   revision:XENOVA_E5_REVISION,license_approved:false,trained_model_executed:false};
 const dst=path.join(fs.realpathSync(dir),MANIFEST);
 const payload=JSON.stringify(scanned.manifest,null,2)+'\n';
 let created=false;
 try{
  // Exclusivity and 0600 mode; refuses any pre-existing operator manifest.
  fs.writeFileSync(dst,payload,{encoding:'utf8',flag:'wx',mode:0o600});
  created=true;
  // Rehash all files after write; refuse asset swaps between scan and write.
  verifyLocalModelFolder(dir,{modelProfile:'xenova-q8',pinnedRevision:true});
 }catch{
  if(created){
   // Delete only our own unchanged file; preserve user edits/race modifications.
   try{if(fs.readFileSync(dst,'utf8')===payload)fs.unlinkSync(dst);}catch{}
  }
  reject('POSTWRITE_PREFLIGHT_FAILED_OR_RACE');
 }
 return {status:'MANIFEST_WRITTEN_LOCAL_ONLY',
   verified_files:scanned.verified_files,total_bytes:scanned.total_bytes,
   license_approved:false,trained_model_executed:false};
}
