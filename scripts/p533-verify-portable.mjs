/** P5.33 portable self-check. Detects accidental changes, NOT publisher signatures. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const HERE=fileURLToPath(new URL('../',import.meta.url));
const REQUIRED=['package.json','RUN_SYNTHETIC_WINDOWS.cmd','RUN_MVP_WINDOWS.cmd','RUN_SMAX_SYNTHETIC_MVP.cmd','RUN_LOCAL_SMAX_REVIEW.cmd',
 'scripts/windows-preflight.mjs','scripts/p533-verify-portable.mjs','scripts/p534-smax-vertical-cli.mjs',
 'src/dashboard-cli.mjs','src/dashboard-server.mjs','src/windows-readiness.mjs',
 'src/validate.mjs','ui/index.html','ui/app.js','ui/app.css','ui/provenance.js',
 'fixtures/smax_p42/synthetic_v1.json',
 'fixtures/ax_multi_doc_v0/manifest.json','fixtures/ax_multi_doc_v0/sales.csv',
 'fixtures/ax_multi_doc_v0/returns_policy.txt',
 'fixtures/ax_multi_doc_v0/shipping_policy.txt'];
export function verifyPortableMvp(root=HERE){
 try{
  const where=path.join(root,'portable-manifest.json'),st=fs.lstatSync(where);
  if(st.isSymbolicLink()||!st.isFile()||st.size<1||st.size>32*1024)throw Error('MANIFEST_INVALID');
  const manifest=JSON.parse(fs.readFileSync(where,'utf8'));
  if(manifest.contract!=='RAG_PORTABLE_SYNTHETIC_MVP_V1'||
     manifest.source_kind!=='PUBLIC_FIXED_SYNTHETIC_ONLY'||manifest.not_signed!==true||
     manifest.customer_data_approved!==false||manifest.external_network_required!==false||
     !Array.isArray(manifest.files)||manifest.files.length!==manifest.file_count||
     manifest.files.length<REQUIRED.length||manifest.files.length>80)throw Error('MANIFEST_INVALID');
  const names=new Set();
  for(const f of manifest.files){
   const name=f?.relative_path;
   if(typeof name!=='string'||!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/u.test(name)||
     name.includes('..')||names.has(name)||!Number.isInteger(f.bytes)||
     f.bytes<1||f.bytes>2*1024*1024||!/^[a-f0-9]{64}$/u.test(f.sha256))throw Error('ENTRY_INVALID');
   names.add(name);
   let p=root;
   for(const segment of name.split('/')){
    p=path.join(p,segment);
    const stat=fs.lstatSync(p);
    if(stat.isSymbolicLink())throw Error('SYMLINK');
   }
   const stat=fs.statSync(p);
   if(!stat.isFile()||stat.size!==f.bytes||
      crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==f.sha256)
    throw Error('HASH_MISMATCH');
  }
  if(REQUIRED.some(name=>!names.has(name)))throw Error('REQUIRED_MISSING');
  return {status:'PORTABLE_MVP_INTEGRITY_PASS',synthetic_only:true,
   files_verified:names.size,not_signed:true,customer_data_approved:false};
 }catch{return {status:'PORTABLE_MVP_INTEGRITY_BLOCKED',synthetic_only:true,
   not_signed:true,customer_data_approved:false};}
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const result=verifyPortableMvp();
 process.stdout.write(JSON.stringify(result)+'\n');
 if(result.status!=='PORTABLE_MVP_INTEGRITY_PASS')process.exitCode=1;
}
