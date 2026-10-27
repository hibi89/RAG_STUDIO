/** P5.43: SHA-256 self-check for accidental edits and symlink swaps.
 * Unsigned manifest is NOT trusted publisher attestation.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const HERE=fileURLToPath(new URL('../',import.meta.url));
const MAX_FILES=25000,MAX_BYTES=256*1024*1024;
const REQUIRED=[
 'package.json','package-lock.json','RUN_NATIVE_DOCUMENT_PICKER_WINDOWS.cmd',
 'src/native-document-picker-cli.mjs','src/native-document-collection.mjs',
 'src/native-document-extract.mjs','src/dashboard-server.mjs',
 'scripts/p542-native-file-picker.ps1','scripts/p543-verify-native-portable.mjs',
 'ui/index.html','ui/app.js','ui/provenance.js','ui/app.css',
 'fixtures/ax_multi_doc_v0/manifest.json','fixtures/ax_multi_doc_v0/sales.csv',
 'node_modules/pdfjs-dist/package.json','node_modules/mammoth/package.json',
 'packaging/P543_NATIVE_PORTABLE_README.txt'
];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
export function verifyNativePortable(root=HERE){
 try{
  if(typeof root!=='string'||!path.isAbsolute(root))throw Error('ROOT_REQUIRED');
  const mf=path.join(root,'native-portable-manifest.json');
  const mst=fs.lstatSync(mf);
  if(!mst.isFile()||mst.isSymbolicLink()||mst.size<10||mst.size>4*1024*1024)
   throw Error('MANIFEST_SIZE');
  const m=JSON.parse(fs.readFileSync(mf,'utf8'));
  if(m.contract!=='RAG_NATIVE_PORTABLE_SYNTHETIC_V1'||
     m.source_kind!=='PUBLIC_SYNTHETIC_AX_PLUS_LOCAL_UNAPPROVED_NATIVE_PREVIEW'||
     m.signed!==false||m.node_runtime_bundled!==false||
     m.customer_data_approved!==false||m.external_api_required!==false||
     !Array.isArray(m.files)||m.files.length<REQUIRED.length||
     m.files.length>MAX_FILES||m.file_count!==m.files.length||
     !Number.isSafeInteger(m.total_bytes)||m.total_bytes<1||m.total_bytes>MAX_BYTES)
    throw Error('MANIFEST_CONTRACT');
  const seen=new Set();let sum=0;
  for(const f of m.files){
   const name=f?.relative_path;
   if(typeof name!=='string'||name.includes('\\')||name.includes('..')||
     !/^[a-zA-Z0-9@_.+~ ()!,;=\[\]#$&'-]+(?:\/[a-zA-Z0-9@_.+~ ()!,;=\[\]#$&'-]+)*$/u.test(name)||
     seen.has(name)||!Number.isSafeInteger(f.bytes)||f.bytes<1||
     f.bytes>MAX_BYTES||!/^[a-f0-9]{64}$/u.test(f.sha256))
     throw Error('ENTRY_INVALID');
   seen.add(name);sum+=f.bytes;
   if(sum>MAX_BYTES)throw Error('SUM_BUDGET');
   let cursor=root;
   for(const part of name.split('/')){
    cursor=path.join(cursor,part);
    if(fs.lstatSync(cursor).isSymbolicLink())throw Error('UNTRUSTED_SYMLINK');
   }
   const st=fs.statSync(cursor);
   if(!st.isFile()||st.size!==f.bytes||digest(fs.readFileSync(cursor))!==f.sha256)
    throw Error('FILE_HASH_MISMATCH');
  }
  if(sum!==m.total_bytes||REQUIRED.some(x=>!seen.has(x)))
   throw Error('REQUIRED_OR_TOTAL_MISMATCH');
  return {status:'NATIVE_PORTABLE_INTEGRITY_PASS',file_count:seen.size,
   signed:false,node_runtime_bundled:false,customer_data_approved:false};
 }catch{
  return {status:'NATIVE_PORTABLE_INTEGRITY_BLOCKED',signed:false,
   node_runtime_bundled:false,customer_data_approved:false};
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv.length===3?path.resolve(process.argv[2]):process.argv.length===2?HERE:null;
 const result=verifyNativePortable(root);
 process.stdout.write(JSON.stringify(result)+'\n');
 if(result.status!=='NATIVE_PORTABLE_INTEGRITY_PASS')process.exitCode=2;
}
