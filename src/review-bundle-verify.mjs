/** P5.53 review-only portable package integrity check (not a signature or approval). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const SHA=b=>crypto.createHash('sha256').update(b).digest('hex');
const EXPECTED=Object.freeze(['ui/prep-owner.html','ui/prep-owner.js','ui/prep-owner.css',
 'src/prep-owner-local-server.mjs','src/prep-owner-serve-cli.mjs','src/review-bundle-verify.mjs',
 'sales-review.json','mixed-review.json','RUN_LOCAL_REVIEW_WINDOWS.cmd','RUN_LOCAL_REVIEW_UNIX.sh']);
const fail=()=>{throw Object.assign(new Error('RAG_REVIEW_BUNDLE_INVALID'),{code:'RAG_REVIEW_BUNDLE_INVALID'});};
function checkedRoot(root){
 if(typeof root!=='string'||!path.isAbsolute(root))fail();
 const st=fs.lstatSync(root);if(st.isSymbolicLink()||!st.isDirectory())fail();
 return root;
}
export function verifyReviewBundle(root){
 try{
  checkedRoot(root);
  const folders=['src','ui'];
  for(const folder of folders){const st=fs.lstatSync(path.join(root,folder));if(!st.isDirectory()||st.isSymbolicLink())fail();}
  const manifestPath=path.join(root,'manifest.json');const st=fs.lstatSync(manifestPath);
  if(!st.isFile()||st.isSymbolicLink()||st.size>32768||st.size<2)fail();
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(!manifest||manifest.contract!=='RAG_PREP_REVIEW_BUNDLE_V1'||manifest.status!=='REVIEW_HOLD'||
     manifest.approval!=='NOT_GRANTED'||manifest.ax_package_created!==false||manifest.sqlite_imported!==false||
     manifest.remote_upload!==false||!/^[a-f0-9]{64}$/u.test(manifest.source_sha256)||
     !Array.isArray(manifest.files)||manifest.files.length!==EXPECTED.length)fail();
  if(JSON.stringify(manifest.files.map(x=>x.relative_path).sort())!==JSON.stringify([...EXPECTED].sort()))fail();
  for(const f of manifest.files){
   if(!f||typeof f.relative_path!=='string'||!/^[a-f0-9]{64}$/u.test(f.sha256)||
      !Number.isSafeInteger(f.size_bytes)||f.size_bytes<1||f.size_bytes>300000)fail();
   const pathName=path.join(root,f.relative_path),leaf=fs.lstatSync(pathName);
   if(!leaf.isFile()||leaf.isSymbolicLink()||leaf.nlink!==1||leaf.size!==f.size_bytes)fail();
   const bytes=fs.readFileSync(pathName);
   if(bytes.length!==f.size_bytes||SHA(bytes)!==f.sha256)fail();
  }
  const sales=JSON.parse(fs.readFileSync(path.join(root,'sales-review.json'),'utf8'));
  const mixed=JSON.parse(fs.readFileSync(path.join(root,'mixed-review.json'),'utf8'));
  if(sales.contract!=='RAG_PREP_SALES_PREVIEW_V1'||sales.status!=='REVIEW_HOLD'||
     mixed.contract!=='RAG_PREP_MIXED_PREVIEW_V1'||mixed.approval!=='NOT_GRANTED'||
     mixed.answer!==null||sales.source_sha256!==manifest.source_sha256||
     mixed.source_sha256!==manifest.source_sha256||sales.ax_package_created!==false||
     mixed.ax_package_created!==false||sales.sqlite_imported!==false||mixed.sqlite_imported!==false)fail();
  // Whitelist every bundled path, including exact directories. Unexpected files are rejected.
  const children=fs.readdirSync(root).sort();
  if(JSON.stringify(children)!==JSON.stringify(['RUN_LOCAL_REVIEW_UNIX.sh','RUN_LOCAL_REVIEW_WINDOWS.cmd','manifest.json','mixed-review.json','sales-review.json','src','ui'].sort()))fail();
  if(JSON.stringify(fs.readdirSync(path.join(root,'src')).sort())!==JSON.stringify(['prep-owner-local-server.mjs','prep-owner-serve-cli.mjs','review-bundle-verify.mjs'].sort()))fail();
  if(JSON.stringify(fs.readdirSync(path.join(root,'ui')).sort())!==JSON.stringify(['prep-owner.html','prep-owner.js','prep-owner.css'].sort()))fail();
  return Object.freeze({status:'RAG_REVIEW_BUNDLE_INTEGRITY_PASS',contract:manifest.contract,
   source_sha256:manifest.source_sha256,files:manifest.files.length,
   approval:'NOT_GRANTED',customer_data_approved:false,ax_package_created:false});
 }catch{fail();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==2)fail();const root=fileURLToPath(new URL('../',import.meta.url));
   process.stdout.write(JSON.stringify(verifyReviewBundle(root))+'\n');}
 catch{process.stderr.write('RAG_REVIEW_BUNDLE_INVALID\n');process.exitCode=1;}
}
