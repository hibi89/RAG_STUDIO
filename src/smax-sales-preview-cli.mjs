/** CLI for local SMAX V1 JSON + exact original CSV -> non-approved sales preview. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {previewSmaxSales} from './smax-sales-preview.mjs';

function readBounded(filename,extension,limit){
 if(typeof filename!=='string'||path.extname(filename).toLowerCase()!==extension)throw Error('INVALID_PATH');
 const p=path.resolve(filename),before=fs.lstatSync(p);
 if(!before.isFile()||before.isSymbolicLink()||before.size<1||before.size>limit)throw Error('INVALID_FILE');
 const fd=fs.openSync(p,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
 try{
   const now=fs.fstatSync(fd);
   if(!now.isFile()||now.size!==before.size||now.dev!==before.dev||now.ino!==before.ino)throw Error('CHANGED_FILE');
   const bytes=fs.readFileSync(fd);
   if(bytes.length!==now.size)throw Error('CHANGED_FILE');
   return bytes;
 }finally{fs.closeSync(fd);}
}
export function runSmaxPreview(argv=process.argv.slice(2)){
 if(argv.length!==2||argv.some(x=>typeof x!=='string'||!x.trim()))throw Error('ARGUMENTS_REQUIRED');
 if(path.resolve(argv[0])===path.resolve(argv[1]))throw Error('SAME_SOURCE');
 const json=readBounded(argv[0],'.json',4*1024*1024),csv=readBounded(argv[1],'.csv',2*1024*1024);
 const decoder=new TextDecoder('utf-8',{fatal:true});
 const pkg=JSON.parse(decoder.decode(json));
 return previewSmaxSales(pkg,csv);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
   // The caller is operating locally; source names, file contents and order IDs
   // are deliberately omitted. SKUs/totals may be sensitive and remain in terminal.
   console.log(JSON.stringify(runSmaxPreview()));
 }catch{
   console.error('SMAX_SALES_PREVIEW_BLOCKED: invalid/unapproved source, mapping, arithmetic or file');
   console.error('Usage: npm run preview:smax -- <smax-v1.json> <exact-original-source.csv>');
   process.exitCode=1;
 }
}
