/** P5.53: explicitly opted-in, new-directory review-only bundle; no raw source copy. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {previewLocalMappedSales} from './prep-mapped-sales.mjs';
import {previewLocalSalesAndPolicy} from './prep-mixed-preview.mjs';
import {verifyReviewBundle} from './review-bundle-verify.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=fileURLToPath(new URL('../',import.meta.url));
const assets=['ui/prep-owner.html','ui/prep-owner.js','ui/prep-owner.css',
 'src/prep-owner-local-server.mjs','src/prep-owner-serve-cli.mjs','src/review-bundle-verify.mjs'];
const windows='@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\nwhere node >nul 2>nul || (echo Node 22 required& exit /b 1)\r\nnode "src\\review-bundle-verify.mjs" || exit /b 1\r\nnode "src\\prep-owner-serve-cli.mjs"\r\n';
const unix='#!/bin/sh\nset -eu\ncd "$(dirname "$0")"\nnode src/review-bundle-verify.mjs\nexec node src/prep-owner-serve-cli.mjs\n';
const fail=()=>{throw Object.assign(new Error('RAG_PREP_BUNDLE_BLOCKED'),{code:'RAG_PREP_BUNDLE_BLOCKED'});};
function checkParent(file){
 if(typeof file!=='string'||!path.isAbsolute(file)||file===path.parse(file).root||path.resolve(file)!==file)fail();
 let current=path.parse(file).root;
 const components=path.relative(current,path.dirname(file)).split(path.sep);
 for(const comp of components){if(!comp||comp==='.'||comp==='..')continue;
   current=path.join(current,comp);const st=fs.lstatSync(current);
   if(!st.isDirectory()||st.isSymbolicLink())fail();
 }
 if(fs.existsSync(file))fail();
}
export function createLocalReviewBundle(csvPath,draftPath,documentPath,outputDir,question='매출과 반품 신청 기간은?'){
 const sales=previewLocalMappedSales(csvPath,draftPath);
 const mixed=previewLocalSalesAndPolicy(csvPath,draftPath,documentPath,question);
 if(!mixed||mixed.contract!=='RAG_PREP_MIXED_PREVIEW_V1'||mixed.source_sha256!==sales.source_sha256||mixed.answer!==null)fail();
 // Existing source and docs must still be byte-pinned at the precise bundle operation.
 const salesAgain=previewLocalMappedSales(csvPath,draftPath);
 if(salesAgain.source_sha256!==sales.source_sha256||JSON.stringify(salesAgain.metrics)!==JSON.stringify(sales.metrics))fail();
 checkParent(outputDir);
 let created=false;
 try{
  fs.mkdirSync(outputDir,{recursive:false,mode:0o700});created=true;
  fs.mkdirSync(path.join(outputDir,'src'),{mode:0o700});fs.mkdirSync(path.join(outputDir,'ui'),{mode:0o700});
  const content=new Map();
  for(const name of assets)content.set(name,fs.readFileSync(path.join(base,name)));
  content.set('sales-review.json',Buffer.from(JSON.stringify(sales)+'\n','utf8'));
  content.set('mixed-review.json',Buffer.from(JSON.stringify(mixed)+'\n','utf8'));
  content.set('RUN_LOCAL_REVIEW_WINDOWS.cmd',Buffer.from(windows,'utf8'));
  content.set('RUN_LOCAL_REVIEW_UNIX.sh',Buffer.from(unix,'utf8'));
  const manifest={contract:'RAG_PREP_REVIEW_BUNDLE_V1',status:'REVIEW_HOLD',
    source_sha256:sales.source_sha256,approval:'NOT_GRANTED',
    ax_package_created:false,sqlite_imported:false,remote_upload:false,
    files:[]};
  for(const [name,bytes] of content){const filename=path.join(outputDir,name);
   fs.writeFileSync(filename,bytes,{flag:'wx',mode:0o600});
   manifest.files.push({relative_path:name,size_bytes:bytes.length,sha256:sha(bytes)});
  }
  fs.chmodSync(path.join(outputDir,'RUN_LOCAL_REVIEW_UNIX.sh'),0o700);
  fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
  const verified=verifyReviewBundle(outputDir);
  if(verified.status!=='RAG_REVIEW_BUNDLE_INTEGRITY_PASS')fail();
  return Object.freeze({status:'REVIEW_BUNDLE_CREATED_NOT_APPROVED',
    source_sha256:sales.source_sha256,files:manifest.files.length,
    approval:'NOT_GRANTED',ax_package_created:false,sqlite_imported:false,
    customer_data_approved:false,remote_upload:false,source_modified:false});
 }catch{if(created)fs.rmSync(outputDir,{recursive:true,force:true});fail();}
}
