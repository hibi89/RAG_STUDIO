/** P5.43: deliver a usable Windows native-document picker as an unsigned,
 * synthetic-only portable folder with already-installed, pinned OSS packages.
 * This DOES NOT install Node, sign a binary, ingest customer datasets or auto-update.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const MAX_FILES=25000,MAX_BYTES=256*1024*1024;
const STATIC=[
 'package.json','package-lock.json','RUN_NATIVE_DOCUMENT_PICKER_WINDOWS.cmd','verify_local.ps1',
 'scripts/p542-native-file-picker.ps1','scripts/p543-verify-native-portable.mjs',
 'ui/app.js','ui/app.css','ui/provenance.js','ui/index.html',
 'fixtures/ax_multi_doc_v0/manifest.json','fixtures/ax_multi_doc_v0/sales.csv',
 'fixtures/ax_multi_doc_v0/returns_policy.txt','fixtures/ax_multi_doc_v0/shipping_policy.txt',
 'packaging/P543_NATIVE_PORTABLE_README.txt'
];
const hex=b=>crypto.createHash('sha256').update(b).digest('hex');
const forbid=message=>{throw Object.assign(Error('NATIVE_PORTABLE_BUILD_BLOCKED'),{code:message});};
function listFiles(base,rel,output){
 const absolute=path.join(base,...rel.split('/'));
 const st=fs.lstatSync(absolute);
 if(st.isSymbolicLink())forbid('SYMLINK_SOURCE');
 if(st.isDirectory()){
  for(const item of fs.readdirSync(absolute,{withFileTypes:true})){
   if(item.name==='.bin'&&rel==='node_modules')continue; // npm shims are unnecessary on runtime
   if(item.name==='.'||item.name==='..'||/[\\/\u0000]/u.test(item.name))forbid('UNSAFE_NAME');
   listFiles(base,rel+'/'+item.name,output);
  }
 }else if(st.isFile()){
  if(!/^[a-zA-Z0-9@_.+~ ()!,;=\[\]#$&'-]+(?:\/[a-zA-Z0-9@_.+~ ()!,;=\[\]#$&'-]+)*$/u.test(rel))
   forbid('UNSAFE_FILENAME');
  output.push(rel);
 }else forbid('NON_FILE_SOURCE');
}
export function buildNativePortable(destination){
 if(typeof destination!=='string'||!path.isAbsolute(destination)||fs.existsSync(destination))
  forbid('FRESH_ABSOLUTE_DESTINATION_REQUIRED');
 const parent=path.dirname(destination);
 const st=fs.lstatSync(parent);
 if(!st.isDirectory()||st.isSymbolicLink())forbid('INVALID_DESTINATION_PARENT');
 const all=[...STATIC];
 listFiles(ROOT,'src',all);
 listFiles(ROOT,'node_modules',all);
 const uniq=new Set(all);
 if(uniq.size!==all.length||all.length<STATIC.length+10||all.length>MAX_FILES)
  forbid('FILE_COUNT_INVALID');
 const files=[];let sum=0;
 // Validate every source, size budget and SHAs BEFORE creating a destination.
 for(const relative_path of all.sort()){
  let cursor=ROOT;
  for(const part of relative_path.split('/')){
   cursor=path.join(cursor,part);
   if(fs.lstatSync(cursor).isSymbolicLink())forbid('SOURCE_SYMLINK');
  }
  const stat=fs.statSync(cursor);
  if(!stat.isFile()||stat.size<1||stat.size>MAX_BYTES)forbid('INVALID_SOURCE_SIZE');
  sum+=stat.size;
  if(sum>MAX_BYTES)forbid('TOTAL_BUDGET');
  const bytes=fs.readFileSync(cursor);
  if(bytes.length!==stat.size)forbid('CHANGED_SOURCE');
  files.push({relative_path,bytes:bytes.length,sha256:hex(bytes)});
 }
 fs.mkdirSync(destination,{recursive:false,mode:0o700});
 try{
  for(const item of files){
   const src=path.join(ROOT,...item.relative_path.split('/'));
   const dst=path.join(destination,...item.relative_path.split('/'));
   fs.mkdirSync(path.dirname(dst),{recursive:true});
   fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL);
   if(hex(fs.readFileSync(dst))!==item.sha256)forbid('COPIED_SOURCE_CHANGED');
  }
  const manifest={contract:'RAG_NATIVE_PORTABLE_SYNTHETIC_V1',
   source_kind:'PUBLIC_SYNTHETIC_AX_PLUS_LOCAL_UNAPPROVED_NATIVE_PREVIEW',
   signed:false,node_runtime_bundled:false,customer_data_approved:false,
   external_api_required:false,
   file_count:files.length,total_bytes:sum,files};
  fs.writeFileSync(path.join(destination,'native-portable-manifest.json'),
    JSON.stringify(manifest)+'\n',{flag:'wx',mode:0o600});
  return Object.freeze({status:'NATIVE_PORTABLE_CREATED',file_count:files.length,
   total_bytes:sum,signed:false,node_runtime_bundled:false,customer_data_approved:false});
 }catch(error){fs.rmSync(destination,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)forbid('DESTINATION_ARGUMENT_REQUIRED');
  process.stdout.write(JSON.stringify(buildNativePortable(path.resolve(process.argv[2])))+'\n');
 }catch(e){process.stderr.write('NATIVE_PORTABLE_BUILD_BLOCKED: '+(e?.code??'INVALID_SOURCE')+'\n');process.exitCode=2;}
}
