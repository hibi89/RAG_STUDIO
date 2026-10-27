/** P5.35: explicit LOCAL JSON + original CSV + TXT/MD read-only review HOLD.
 * Untrusted SMAX V1 is never upgraded to AX ACCEPTED or inserted into SQLite.
 * Safe local output: counts/hashes/provisional totals, not source paths/rows/text.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {previewSmaxSales} from './smax-sales-preview.mjs';

const SHA=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const FILE_LIMITS=Object.freeze({json:4*1024*1024,csv:2*1024*1024,document:256*1024});
const fail=()=>{throw Object.assign(Error('LOCAL_SMAX_REVIEW_BLOCKED'),{code:'LOCAL_SMAX_REVIEW_BLOCKED'});};
function readSource(file,kind){
 if(typeof file!=='string'||!file.trim()||!path.isAbsolute(file))fail();
 const ext=path.extname(file).toLowerCase();
 if(kind==='json'&&ext!=='.json'||kind==='csv'&&ext!=='.csv'||
    kind==='document'&&!['.txt','.md'].includes(ext))fail();
 const absolute=path.resolve(file);
 // Walk every path component, not merely the leaf: no directory reparse/symlink.
 const segments=path.relative(path.parse(absolute).root,absolute).split(path.sep);
 let cursor=path.parse(absolute).root;
 try{
  for(const part of segments){
   if(!part||part==='.'||part==='..')fail();
   cursor=path.join(cursor,part);
   if(fs.lstatSync(cursor).isSymbolicLink())fail();
  }
  const before=fs.lstatSync(absolute);
  if(!before.isFile()||before.size<1||before.size>FILE_LIMITS[kind])fail();
  const fd=fs.openSync(absolute,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try{
   const opened=fs.fstatSync(fd);
   if(!opened.isFile()||opened.size!==before.size||opened.ino!==before.ino||
      opened.dev!==before.dev||opened.mtimeMs!==before.mtimeMs)fail();
   const bytes=fs.readFileSync(fd);
   const after=fs.fstatSync(fd),present=fs.lstatSync(absolute);
   if(bytes.length!==before.size||after.size!==before.size||
      after.mtimeMs!==opened.mtimeMs||after.ino!==opened.ino||
      after.dev!==opened.dev||present.isSymbolicLink()||!present.isFile()||
      present.size!==before.size||present.mtimeMs!==opened.mtimeMs||
      present.ino!==opened.ino||present.dev!==opened.dev)fail();
   return {bytes,sha256:SHA(bytes),size_bytes:bytes.length,
     identity:String(opened.dev)+':'+String(opened.ino)};
  }finally{fs.closeSync(fd);}
 }catch{fail();}
}
function checkDocument(bytes){
 let text;
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes);}
 catch{fail();}
 if(!text.trim()||text.includes('\u0000')||
    /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text))fail();
 const lines=text.replace(/\r\n/g,'\n').split('\n');
 if(lines.length>500||lines.some(x=>x.length>4096))fail();
 return {line_count:lines.length};
}
const decodeJson=bytes=>{
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{fail();}
};
/** This is not an authenticated approval or an importer, even for clean input. */
export function stageLocalSmaxReview({jsonPath,csvPath,documentPath}={}){
 const paths=[jsonPath,csvPath,documentPath];
 if(paths.some(p=>typeof p!=='string'||!path.isAbsolute(p))||
    new Set(paths.map(p=>process.platform==='win32'?path.resolve(p).toLowerCase():path.resolve(p))).size!==3)fail();
 const first=[
  readSource(jsonPath,'json'),readSource(csvPath,'csv'),
  readSource(documentPath,'document')
 ];
 if(new Set(first.map(x=>x.identity)).size!==3)fail(); // no hardlink aliases
 const doc=checkDocument(first[2].bytes);
 const pkg=decodeJson(first[0].bytes);
 let preview;
 try{preview=previewSmaxSales(pkg,first[1].bytes);}
 catch{fail();}
 if(preview.status!=='CALCULATED_PREVIEW_NOT_APPROVED'&&preview.status!=='REVIEW_HOLD')fail();
 // Reopen and read every original after all parsing; unchanged bytes only.
 const second=[
  readSource(jsonPath,'json'),readSource(csvPath,'csv'),
  readSource(documentPath,'document')
 ];
 for(let i=0;i<3;i++){
  if(first[i].identity!==second[i].identity||
     first[i].size_bytes!==second[i].size_bytes||
     first[i].sha256!==second[i].sha256||
     !first[i].bytes.equals(second[i].bytes))fail();
 }
 // Totals are a *provisional local preview* or null on REVIEW_HOLD;
 // they cannot be joined to a customer-approved SQL data source.
 return Object.freeze({
  contract:'RAG_LOCAL_SMAX_REVIEW_HOLD_V1',status:'REVIEW_HOLD',
  source_provenance:'ORIGINAL_CSV_DIGEST_VERIFIED',
  source_sha256:first[1].sha256,source_rows:preview.source_rows,
  mapped_columns:5,rows_needing_review:preview.review_rows,
  sales_preview_status:preview.status,
  provisional_orders:preview.orders,
  provisional_units:preview.units,
  provisional_revenue_krw:preview.revenue_krw,
  document:Object.freeze({status:'UNAPPROVED_TEXT_PREVIEW',kind:path.extname(documentPath).toLowerCase(),
    sha256:first[2].sha256,size_bytes:first[2].size_bytes,line_count:doc.line_count}),
  ax_package_created:false,sqlite_imported:false,document_indexed:false,
  authenticated_reviewer:false,source_rights_verified:false,
  smax_native_approved:false,
  customer_data_approved:false,remote_upload:false,source_files_modified:false
 });
}
