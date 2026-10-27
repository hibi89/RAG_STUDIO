/**
 * P5.12: explicitly selected local PDF/DOCX + already verified AX folder
 * -> a temporary, *non-persistent* derived AX package searchable by existing UI.
 * Original document and source package are never modified.
 * NOT a general purpose SMAX producer or a customer data approval service.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadPackage,safeRelativePath} from './validate.mjs';
import {extractLocalDocument} from './native-document-extract.mjs';

const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function reject(code){throw Object.assign(new Error('Local document preview cannot start'),{code:'NATIVE_IMPORT_'+code});}
function localBytes(documentPath){
 if(typeof documentPath!=='string'||!documentPath.trim())reject('FILE_REQUIRED');
 const ext=path.extname(documentPath).toLowerCase();
 if(ext!=='.pdf'&&ext!=='.docx')reject('UNSUPPORTED_SUFFIX');
 const stat=fs.lstatSync(documentPath);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<16||stat.size>2*1024*1024)reject('INVALID_FILE');
 const fd=fs.openSync(documentPath,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
   const b=fs.readFileSync(fd);
   if(b.length!==stat.size)reject('FILE_CHANGED');
   return {bytes:b,kind:ext.slice(1)};
 }finally{fs.closeSync(fd);}
}
export async function openNativeDocumentPreview(standardRoot,documentPath){
 if(typeof standardRoot!=='string'||!standardRoot.trim())reject('PACKAGE_REQUIRED');
 const original=fs.realpathSync(standardRoot);
 const pkg=loadPackage(original);
 if(pkg.manifest.files.some(f=>f.import_status!=='ACCEPTED')||
    pkg.manifest.datasets.some(d=>d.columns.some(c=>c.review_status!=='APPROVED'))||
    pkg.manifest.documents.length<1)reject('UNREADY_PACKAGE');
 const input=localBytes(documentPath);
 const result=await extractLocalDocument(input.bytes,input.kind);
 let root;
 try{
   root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p512-preview-'));
   // Copy ONLY files referenced in the verified manifest, never arbitrary folder contents.
   for(const desc of pkg.manifest.files){
     const segments=safeRelativePath(desc.relative_path);
     const dest=path.join(root,...segments);
     fs.mkdirSync(path.dirname(dest),{recursive:true});
     const source=path.join(original,...segments);
     const stat=fs.lstatSync(source);
     if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==desc.size_bytes)reject('PACKAGE_CHANGED');
     fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL);
     if(hash(fs.readFileSync(dest))!==desc.sha256)reject('PACKAGE_CHANGED');
   }
   const manifest=structuredClone(pkg.manifest);
   const id=crypto.randomBytes(8).toString('hex');
   const filename='native-preview-'+id+'.txt';
   const bytes=Buffer.from(result.text,'utf8');
   fs.writeFileSync(path.join(root,filename),bytes,{flag:'wx',mode:0o600});
   const fileId='file-native-'+id;
   manifest.files.push({file_id:fileId,relative_path:filename,kind:'document',
     sha256:hash(bytes),size_bytes:bytes.length,import_status:'ACCEPTED'});
   manifest.documents.push({document_id:'document-native-'+id,file_id:fileId,language:'und',
     source_title:'Local '+result.kind.toUpperCase()+' text preview',
     page_info:result.kind==='pdf'?'PDF page source markers in derived text':
       'DOCX paragraph markers, no verified page numbers',index_status:'NOT_INDEXED'});
   manifest.processing_summary.accepted++;
   fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
   const checked=loadPackage(root);
   if(checked.manifest.documents.length!==pkg.manifest.documents.length+1)reject('DERIVED_PACKAGE_INVALID');
   let cleaned=false;
   const cleanup=()=>{if(!cleaned){cleaned=true;fs.rmSync(root,{recursive:true,force:true});}};
   return Object.freeze({root,cleanup,kind:result.kind,citation_unit:result.citation_unit,units:result.units,
     derived_file_id:fileId,local_only:true,original_preserved:true,
     customer_data_certified:false,source_rights_verified:false,ocr_performed:false});
 }catch(err){
   if(root)fs.rmSync(root,{recursive:true,force:true});
   throw err;
 }
}
