/** P5.22 bounded, read-only local model asset preflight; a manifest is operator
 * declared checksums, NOT cryptographic proof of upstream provenance/license.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {fail} from './validate.mjs';

const ID='intfloat/multilingual-e5-small';
const MAX_MODEL_BYTES=800*1024*1024,MIN_RAM_BYTES=4*1024**3;
const names=new Set([
 'config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json',
 'sentence_bert_config.json','onnx/model_quantized.onnx',
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
export function verifyLocalModelFolder(dir,{ramBytes=os.totalmem()}={}){
 if(typeof dir!=='string'||!path.isAbsolute(dir))fail('dense model: absolute local directory required');
 const root=fs.realpathSync(dir);
 if(!fs.statSync(root).isDirectory())fail('dense model: directory required');
 const descriptor=path.join(root,'rag_model_manifest.json');
 if(fs.lstatSync(descriptor).isSymbolicLink()||fs.statSync(descriptor).size>16384)
   fail('dense model: manifest invalid');
 let m;
 try{m=JSON.parse(fs.readFileSync(descriptor,'utf8'));}
 catch{fail('dense model: manifest JSON invalid');}
 const keys=Object.keys(m);
 if(keys.length!==6||keys.some(k=>!['model_id','license','dimension','dtype','artifact_source','files'].includes(k))||
    m.model_id!==ID||m.license!=='mit'||m.dimension!==384||m.dtype!=='q8'||
    typeof m.artifact_source!=='string'||!/^https:\/\/huggingface\.co\/[\w./-]+$/.test(m.artifact_source)||
    !Array.isArray(m.files)||m.files.length<3||m.files.length>8)
   fail('dense model: manifest schema unsupported');
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
 return {status:'LOCAL_ASSETS_INTEGRITY_CHECKED_NOT_AUTHENTICATED',
   model_id:ID,dimension:384,dtype:'q8',verified_files:provided.size,total_bytes:total,
   runtime:'OPTIONAL_NOT_VALIDATED',origin_license:'OPERATOR_DECLARED_NOT_LEGAL_REVIEW'};
}
