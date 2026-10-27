/** P5.27. Local-only opt-in TXT/MD attachment to an already verified AX package.
 * Produces a disposable derived package for the existing localhost dashboard.
 * No recursive user directory scanning, rights attestation, remote upload,
 * data-schema auto approval, source edits or persistent customer storage.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadPackage,safeRelativePath} from './validate.mjs';

const MAX_FILES=4, MAX_FILE_BYTES=256*1024, MAX_LINES=500;
const utf8=new TextDecoder('utf-8',{fatal:true,ignoreBOM:false});
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function refuse(code){
 throw Object.assign(new Error('Local text preview refused'),{code:'LOCAL_TEXT_'+code});
}
function checkedText(file){
 if(typeof file!=='string'||!path.isAbsolute(file))refuse('ABSOLUTE_FILE_REQUIRED');
 if(!/\.(txt|md)$/i.test(path.extname(file)))refuse('UNSUPPORTED_FORMAT');
 const st=fs.lstatSync(file);
 if(st.isSymbolicLink()||!st.isFile()||st.size<1||st.size>MAX_FILE_BYTES)
   refuse('INVALID_FILE');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
   const initial=fs.fstatSync(fd);
   if(!initial.isFile()||initial.size!==st.size||initial.ino!==st.ino||
      initial.dev!==st.dev)refuse('FILE_CHANGED');
   const bytes=fs.readFileSync(fd);
   const after=fs.fstatSync(fd),present=fs.lstatSync(file);
   if(bytes.length!==st.size||after.size!==st.size||after.mtimeMs!==initial.mtimeMs||
      after.ino!==initial.ino||after.dev!==initial.dev||
      present.isSymbolicLink()||present.size!==st.size||
      present.mtimeMs!==initial.mtimeMs||present.ino!==initial.ino||
      present.dev!==initial.dev)refuse('FILE_CHANGED');
   let content;
   try{content=utf8.decode(bytes);}
   catch{refuse('INVALID_UTF8');}
   if(!content.trim()||content.includes('\u0000')||
      /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content))
     refuse('UNSAFE_TEXT');
   const lines=content.replace(/\r\n/g,'\n').split('\n');
   if(lines.length>MAX_LINES||lines.some(line=>line.length>4096))
     refuse('TEXT_BUDGET_EXCEEDED');
   // Store validated original text bytes so SHA and one-based line citations match.
   return {bytes,sha256:digest(bytes),suffix:path.extname(file).toLowerCase(),
     lines:lines.length};
 }finally{fs.closeSync(fd);}
}
export function openLocalTextPreview(standardRoot,files){
 if(typeof standardRoot!=='string'||!path.isAbsolute(standardRoot))
   refuse('PACKAGE_ABSOLUTE_REQUIRED');
 if(!Array.isArray(files)||files.length<1||files.length>MAX_FILES)
   refuse('FILE_COUNT');
 if(new Set(files).size!==files.length)refuse('DUPLICATE_INPUT');
 const packageRoot=fs.realpathSync(standardRoot);
 const pkg=loadPackage(packageRoot);
 if(pkg.manifest.files.length+files.length>100||
    pkg.manifest.files.some(f=>f.import_status!=='ACCEPTED')||
    pkg.manifest.datasets.some(d=>d.columns.some(c=>c.review_status!=='APPROVED'))||
    pkg.manifest.documents.length<1)refuse('PACKAGE_NOT_READY');
 // All inputs must pass validation before allocating any temporary output.
 const originals=files.map(checkedText);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-local-text-'));
 let cleared=false;
 const cleanup=()=>{if(!cleared){cleared=true;fs.rmSync(root,{recursive:true,force:true});}};
 try{
   for(const desc of pkg.manifest.files){
     const seg=safeRelativePath(desc.relative_path),source=path.join(packageRoot,...seg);
     // Reject symlinks in each source path segment, not only the final leaf.
     let cur=packageRoot;
     for(const piece of seg){
       cur=path.join(cur,piece);
       if(fs.lstatSync(cur).isSymbolicLink())refuse('PACKAGE_CHANGED');
     }
     const stat=fs.lstatSync(source);
     if(!stat.isFile()||stat.size!==desc.size_bytes)refuse('PACKAGE_CHANGED');
     const dest=path.join(root,...seg);
     fs.mkdirSync(path.dirname(dest),{recursive:true});
     fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL);
     if(digest(fs.readFileSync(dest))!==desc.sha256)refuse('PACKAGE_CHANGED');
   }
   const manifest=structuredClone(pkg.manifest);
   const ids=[];
   for(const [i,item] of originals.entries()){
     // Verify selected originals haven't been changed during source package copy.
     const now=checkedText(files[i]);
     if(now.sha256!==item.sha256||now.bytes.length!==item.bytes.length)
       refuse('INPUT_CHANGED');
     const tag=crypto.randomBytes(12).toString('hex'),name='local-preview-'+tag+item.suffix;
     const fileId='file-local-'+tag,documentId='document-local-'+tag;
     fs.writeFileSync(path.join(root,name),item.bytes,{flag:'wx',mode:0o600});
     manifest.files.push({file_id:fileId,relative_path:name,kind:'document',
       sha256:item.sha256,size_bytes:item.bytes.length,import_status:'ACCEPTED'});
     manifest.documents.push({document_id:documentId,file_id:fileId,language:'und',
       source_title:'User-selected '+item.suffix.toUpperCase().slice(1)+' preview '+(i+1),
       page_info:'Source lines (local unreviewed preview)',index_status:'NOT_INDEXED'});
     manifest.processing_summary.accepted++;
     ids.push(documentId);
   }
   fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',
     {flag:'wx',mode:0o600});
   const after=loadPackage(root);
   if(after.manifest.documents.length!==pkg.manifest.documents.length+files.length)
     refuse('DERIVED_PACKAGE_INVALID');
   return Object.freeze({root,cleanup,document_ids:Object.freeze(ids),
     added_documents:files.length,local_only:true,original_preserved:true,
     customer_data_certified:false,source_rights_verified:false,
     smax_native_approved:false});
 }catch(error){cleanup();throw error;}
}
