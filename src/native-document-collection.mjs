/** P5.40: explicit 2-4 mixed PDF/DOCX documents in one local RAG dashboard.
 * Existing P5.12 single-document API remains unchanged.
 * Untrusted original bytes remain outside the derived, disposable AX package.
 * 'ACCEPTED' in this *temporary preview manifest* verifies extracted TXT
 * integrity only; it does NOT certify legal source rights or customer data.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadPackage,safeRelativePath} from './validate.mjs';
import {extractLocalDocument} from './native-document-extract.mjs';

const MAX_INPUTS=4,MAX_FILE=2*1024*1024;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const reject=code=>{throw Object.assign(Error('Local native document collection refused'),{
 code:'NATIVE_COLLECTION_'+code
});};
/** Recheck the entire path, the open descriptor, and the on-disk name.
 * All exceptions have a constant public code, not a private file path.
 */
function checkedInput(name){
 if(typeof name!=='string'||!path.isAbsolute(name))reject('ABSOLUTE_PATH_REQUIRED');
 const kind=path.extname(name).toLowerCase().slice(1);
 if(!['pdf','docx'].includes(kind))reject('UNSUPPORTED_FILE_KIND');
 try{
  const full=path.resolve(name),root=path.parse(full).root;
  const segments=path.relative(root,full).split(path.sep);
  if(!segments.length||segments.some(x=>!x||x==='.'||x==='..'))reject('INVALID_INPUT');
  let cursor=root;
  for(const component of segments){
   cursor=path.join(cursor,component);
   if(fs.lstatSync(cursor).isSymbolicLink())reject('SYMLINK_BLOCKED');
  }
  const before=fs.lstatSync(full);
  if(!before.isFile()||before.size<16||before.size>MAX_FILE)reject('FILE_BUDGET');
  const fd=fs.openSync(full,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try{
   const opened=fs.fstatSync(fd);
   if(!opened.isFile()||opened.size!==before.size||
     opened.dev!==before.dev||opened.ino!==before.ino||
     opened.mtimeMs!==before.mtimeMs)reject('FILE_CHANGED');
   const bytes=fs.readFileSync(fd);
   const after=fs.fstatSync(fd),present=fs.lstatSync(full);
   if(bytes.length!==before.size||
     after.size!==before.size||after.dev!==before.dev||
     after.ino!==before.ino||after.mtimeMs!==before.mtimeMs||
     present.isSymbolicLink()||!present.isFile()||
     present.size!==before.size||present.dev!==before.dev||
     present.ino!==before.ino||present.mtimeMs!==before.mtimeMs)
      reject('FILE_CHANGED');
   return {bytes,kind,sha256:sha(bytes),
     identity:String(opened.dev)+':'+String(opened.ino)};
  }finally{fs.closeSync(fd);}
 }catch{reject('INVALID_OR_CHANGED_INPUT');}
}
function validatePackage(root){
 const pkg=loadPackage(root);
 if(pkg.manifest.files.some(f=>f.import_status!=='ACCEPTED')||
    pkg.manifest.datasets.some(d=>d.columns.some(c=>c.review_status!=='APPROVED'))||
    pkg.manifest.documents.length<1)reject('UNREADY_PACKAGE');
 return pkg;
}
export async function openNativeDocumentCollectionPreview(standardRoot,documentPaths){
 if(typeof standardRoot!=='string'||!standardRoot.trim())reject('PACKAGE_REQUIRED');
 if(!Array.isArray(documentPaths)||documentPaths.length<2||
    documentPaths.length>MAX_INPUTS)reject('FILE_COUNT');
 const paths=documentPaths.map(p=>{
  if(typeof p!=='string'||!path.isAbsolute(p))reject('ABSOLUTE_PATH_REQUIRED');
  return path.resolve(p);
 });
 const selected=paths.map(p=>process.platform==='win32'?p.toLowerCase():p);
 if(new Set(selected).size!==selected.length)reject('DUPLICATE_SELECTION');
 const original=fs.realpathSync(standardRoot);
 const pkg=validatePackage(original);
 if(pkg.manifest.files.length+paths.length>100)reject('PACKAGE_FILE_BUDGET');
 // Validate and parse every selected document before creating a writable folder.
 const input=paths.map(checkedInput);
 if(new Set(input.map(x=>x.identity)).size!==input.length)reject('ALIAS_SELECTION');
 const extracted=[];
 for(const x of input)extracted.push(await extractLocalDocument(x.bytes,x.kind));
 // Detect replacement or edit while native parsing was running.
 for(let i=0;i<paths.length;i++){
  const latest=checkedInput(paths[i]);
  if(latest.identity!==input[i].identity||latest.sha256!==input[i].sha256||
     !latest.bytes.equals(input[i].bytes))reject('INPUT_CHANGED_DURING_PARSE');
 }
 let root;
 try{
  root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p540-native-'));
  // Copy only declared, SHA-verified package sources, not arbitrary directory files.
  for(const desc of pkg.manifest.files){
   const segments=safeRelativePath(desc.relative_path);
   let cursor=original;
   for(const segment of segments){
    cursor=path.join(cursor,segment);
    if(fs.lstatSync(cursor).isSymbolicLink())reject('PACKAGE_CHANGED');
   }
   const st=fs.lstatSync(cursor);
   if(!st.isFile()||st.size!==desc.size_bytes)reject('PACKAGE_CHANGED');
   const dest=path.join(root,...segments);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.copyFileSync(cursor,dest,fs.constants.COPYFILE_EXCL);
   if(sha(fs.readFileSync(dest))!==desc.sha256)reject('PACKAGE_CHANGED');
  }
  const manifest=structuredClone(pkg.manifest),documents=[];
  for(let index=0;index<extracted.length;index++){
   const item=extracted[index],tag=crypto.randomBytes(12).toString('hex');
   const filename='native-collection-'+tag+'.txt';
   const fileId='file-native-'+tag,documentId='document-native-'+tag;
   const text=Buffer.from(item.text,'utf8');
   if(text.length<1||text.length>MAX_FILE)reject('EXTRACTED_TEXT_BUDGET');
   fs.writeFileSync(path.join(root,filename),text,{flag:'wx',mode:0o600});
   manifest.files.push({file_id:fileId,relative_path:filename,kind:'document',
     sha256:sha(text),size_bytes:text.length,import_status:'ACCEPTED'});
   manifest.documents.push({document_id:documentId,file_id:fileId,language:'und',
     source_title:'Local '+item.kind.toUpperCase()+' text preview '+(index+1),
     page_info:item.kind==='pdf'?'Extractor PDF page prefixes in derived TXT':
       'Extractor DOCX paragraph prefixes, no page numbers',
     index_status:'NOT_INDEXED'});
   manifest.processing_summary.accepted++;
   documents.push(Object.freeze({document_id:documentId,file_id:fileId,kind:item.kind,
     citation_unit:item.citation_unit,units:item.units,lines:item.lines}));
  }
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',
    {flag:'wx',mode:0o600});
  const verified=validatePackage(root);
  if(verified.manifest.documents.length!==pkg.manifest.documents.length+documents.length)
    reject('DERIVED_PACKAGE_INVALID');
  let cleaned=false;
  const cleanup=()=>{
   if(!cleaned){cleaned=true;fs.rmSync(root,{recursive:true,force:true});}
  };
  return Object.freeze({root,cleanup,kind:'mixed_native_preview',
   documents:Object.freeze(documents),
   document_ids:Object.freeze(documents.map(x=>x.document_id)),
   added_documents:documents.length,local_only:true,original_preserved:true,
   customer_data_certified:false,source_rights_verified:false,
   reviewer_identity_verified:false,ocr_performed:false,
   smax_native_approved:false,remote_upload:false});
 }catch(e){
  if(root)fs.rmSync(root,{recursive:true,force:true});
  throw e;
 }
}
