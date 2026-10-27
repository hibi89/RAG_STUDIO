/** P5.22 bounded, read-only local model asset preflight; a manifest is operator
 * declared checksums, NOT cryptographic proof of upstream provenance/license.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {fail} from './validate.mjs';

const ID='intfloat/multilingual-e5-small';
export const XENOVA_E5_ID='Xenova/multilingual-e5-small';
const XENOVA_SOURCE='https://huggingface.co/Xenova/multilingual-e5-small';
// Exact public Git-LFS/Xet SHA-256 and byte sizes, independently recorded from
// Hugging Face file history (not self-declared hashes in a customer manifest).
// These locks are artifact integrity references, NOT a commercial license approval.
export const XENOVA_PUBLISHED_BLOBS=Object.freeze({
 'onnx/model_quantized.onnx':Object.freeze({
   sha256:'f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193',
   size:118308185}),
 'tokenizer.json':Object.freeze({
   sha256:'0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39',
   size:17082730}),
 'sentencepiece.bpe.model':Object.freeze({
   sha256:'cfc8146abe2a0488e9e2a0c56de7952f7c11ab059eca145a0a727afce0db2865',
   size:5069051})
});
export function verifyPublishedXenovaManifest(m){
 if(!m||typeof m!=='object'||Array.isArray(m)||
    m.model_id!==XENOVA_E5_ID||m.artifact_source!==XENOVA_SOURCE||
    m.license!=='mit'||m.dimension!==384||m.dtype!=='q8'||
    !Array.isArray(m.files))fail('dense model: published profile mismatch');
 const entries=new Map();
 for(const d of m.files){
   if(!d||typeof d.name!=='string'||entries.has(d.name))
     fail('dense model: published profile duplicate/invalid artifact');
   entries.set(d.name,d);
 }
 for(const mandatory of ['tokenizer.json','onnx/model_quantized.onnx']){
   if(!entries.has(mandatory))fail('dense model: published artifact missing');
 }
 for(const [name,reference] of Object.entries(XENOVA_PUBLISHED_BLOBS)){
   const d=entries.get(name);
   if(d&&(d.sha256!==reference.sha256||d.size!==reference.size))
     fail('dense model: published SHA/size mismatch');
 }
 // This only validates manifest claims until filesystem SHA checks finish.
 return {status:'PUBLISHED_HASH_REFERENCE_MATCHES_MANIFEST_ONLY',
   source:XENOVA_SOURCE,core_files_checked:2,
   legal_redistribution:'NOT_REVIEWED',trained_inference:'NOT_RUN'};
}
const MAX_MODEL_BYTES=800*1024*1024,MIN_RAM_BYTES=4*1024**3;
const names=new Set([
 'config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json',
 'sentence_bert_config.json','sentencepiece.bpe.model','quant_config.json','onnx/model_quantized.onnx',
 'onnx/model.onnx','onnx/model_q8.onnx'
]);
const validHash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function verifiedPath(root,relative){
 if(!names.has(relative))fail('dense model: unsupported model filename');
 const parts=relative.split('/');
 let current=root;
 for(const part of parts){
   current=path.join(current,part);
   if(fs.lstatSync(current).isSymbolicLink())fail('dense model: symlink forbidden');
 }
 if(!fs.statSync(current).isFile())fail('dense model: file required');
 return current;
}
export function verifyLocalModelFolder(dir,{ramBytes=os.totalmem(),modelProfile='legacy'}={}){
 if(!['legacy','xenova-q8'].includes(modelProfile))fail('dense model: unsupported profile');
 if(typeof dir!=='string'||!path.isAbsolute(dir))fail('dense model: absolute local directory required');
 const root=fs.realpathSync(dir);
 if(!fs.statSync(root).isDirectory())fail('dense model: directory required');
 if(modelProfile==='xenova-q8'&&
    (path.basename(root)!=='multilingual-e5-small'||path.basename(path.dirname(root))!=='Xenova'))
   fail('dense model: published model directory mismatch');
 const descriptor=path.join(root,'rag_model_manifest.json');
 if(fs.lstatSync(descriptor).isSymbolicLink()||fs.statSync(descriptor).size>16384)
   fail('dense model: manifest invalid');
 let m;
 try{m=JSON.parse(fs.readFileSync(descriptor,'utf8'));}
 catch{fail('dense model: manifest JSON invalid');}
 const keys=Object.keys(m);
 if(keys.length!==6||keys.some(k=>!['model_id','license','dimension','dtype','artifact_source','files'].includes(k))||
    m.model_id!==(modelProfile==='xenova-q8'?XENOVA_E5_ID:ID)||m.license!=='mit'||m.dimension!==384||m.dtype!=='q8'||
    typeof m.artifact_source!=='string'||!/^https:\/\/huggingface\.co\/[\w./-]+$/.test(m.artifact_source)||
    !Array.isArray(m.files)||m.files.length<3||m.files.length>8)
   fail('dense model: manifest schema unsupported');
 if(modelProfile==='xenova-q8')verifyPublishedXenovaManifest(m);
 if(!Number.isSafeInteger(ramBytes)||ramBytes<MIN_RAM_BYTES)
   fail('dense model: insufficient reported physical RAM');
 const provided=new Set();let total=0;
 for(const d of m.files){
   if(!d||typeof d!=='object'||Array.isArray(d)||
      Object.keys(d).length!==3||typeof d.name!=='string'||
      !validHash(d.sha256)||!Number.isSafeInteger(d.size)||d.size<1||
      provided.has(d.name))fail('dense model: invalid file entry');
   provided.add(d.name);
   const item=verifiedPath(root,d.name);
   const st=fs.statSync(item);
   if(st.size!==d.size||st.size>MAX_MODEL_BYTES-total)
     fail('dense model: size/budget mismatch');
   total+=st.size;
   // Streamed checksums avoid reading 100s of MB of model weights into heap.
   const h=crypto.createHash('sha256'),fd=fs.openSync(item,'r');
   try{
     const buffer=Buffer.allocUnsafe(1024*1024);let offset=0,read=0;
     while((read=fs.readSync(fd,buffer,0,buffer.length,offset))>0){
       h.update(buffer.subarray(0,read));offset+=read;
     }
   }finally{fs.closeSync(fd);}
   if(h.digest('hex')!==d.sha256)fail('dense model: SHA mismatch');
 }
 if(!provided.has('config.json')||!provided.has('tokenizer.json')||
    ![...provided].some(n=>n.startsWith('onnx/')&&n.endsWith('.onnx')))
   fail('dense model: missing model/tokenizer/weights');
 // Transformers.js may read additional local tokenizer config files. Reject all
 // undeclared items and symlinks, so asset integrity covers the full model tree.
 const allowed=new Set([...provided,'rag_model_manifest.json']);
 function scan(dir,relative='',depth=0){
   if(depth>2)fail('dense model: folder depth exceeded');
   for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
     const rel=relative?relative+'/'+entry.name:entry.name;
     if(entry.isSymbolicLink())fail('dense model: undeclared symlink');
     if(entry.isDirectory()){if(rel!=='onnx')fail('dense model: unapproved directory');scan(path.join(dir,entry.name),rel,depth+1);}
     else if(!entry.isFile()||!allowed.has(rel))fail('dense model: undeclared artifact');
   }
 }
 scan(root);
 return {status:modelProfile==='xenova-q8'?
   'LOCAL_ASSETS_CHECKED_PUBLISHED_CORE_HASHES_NOT_FULLY_AUTHENTICATED':
   'LOCAL_ASSETS_INTEGRITY_CHECKED_NOT_AUTHENTICATED',
   model_id:m.model_id,dimension:384,dtype:'q8',verified_files:provided.size,total_bytes:total,
   runtime:'OPTIONAL_NOT_VALIDATED',origin_license:'OPERATOR_DECLARED_NOT_LEGAL_REVIEW'};
}
