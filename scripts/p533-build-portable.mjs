/** P5.33 offline portable *synthetic-only* MVP export; does not install dependencies.
 * Generate a fresh output directory. Never overwrite prior data or bundle real files.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const fixed=[
 'package.json','RUN_SYNTHETIC_WINDOWS.cmd','RUN_MVP_WINDOWS.cmd',
 'scripts/windows-preflight.mjs','scripts/p533-verify-portable.mjs',
 'ui/app.css','ui/app.js','ui/index.html','ui/provenance.js',
 'fixtures/ax_multi_doc_v0/manifest.json','fixtures/ax_multi_doc_v0/sales.csv',
 'fixtures/ax_multi_doc_v0/returns_policy.txt',
 'fixtures/ax_multi_doc_v0/shipping_policy.txt',
 'packaging/P533_MVP_README.txt'
];
const max=2*1024*1024;
function hash(data){return crypto.createHash('sha256').update(data).digest('hex');}
function verifySource(file){
 const segments=file.split('/');
 let p=ROOT;
 for(const segment of segments){
  p=path.join(p,segment);
  const st=fs.lstatSync(p);
  if(st.isSymbolicLink())throw Error('UNSAFE_SOURCE_LINK');
 }
 const st=fs.lstatSync(p);
 if(!st.isFile()||st.size<1||st.size>max)throw Error('UNSAFE_SOURCE_FILE');
 return fs.readFileSync(p);
}
export function buildPortableMvp(target){
 if(typeof target!=='string'||!path.isAbsolute(target)||fs.existsSync(target))throw Error('DESTINATION_NOT_FRESH');
 const parent=path.dirname(target);
 if(!fs.statSync(parent).isDirectory()||fs.lstatSync(parent).isSymbolicLink())throw Error('UNSAFE_PARENT');
 // All src modules are already PUBLIC source, copied as inert text; only the
 // known dashboard CLI and its imports are executed in this synthetic build.
 const src=fs.readdirSync(path.join(ROOT,'src')).filter(n=>/^[a-z0-9-]+\.mjs$/u.test(n)).sort().map(n=>'src/'+n);
 const files=[...fixed,...src].sort();
 const data=files.map(relative=>({relative,bytes:verifySource(relative)}));
 if(data.length>80)throw Error('FILE_BUDGET_EXCEEDED');
 fs.mkdirSync(target,{mode:0o700});
 try{
  const manifest=[];
  for(const {relative,bytes} of data){
   const dest=path.join(target,...relative.split('/'));
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,bytes,{flag:'wx',mode:0o600});
   manifest.push({relative_path:relative,bytes:bytes.length,sha256:hash(bytes)});
  }
  const output={contract:'RAG_PORTABLE_SYNTHETIC_MVP_V1',
   source_kind:'PUBLIC_FIXED_SYNTHETIC_ONLY',not_signed:true,
   customer_data_approved:false,external_network_required:false,
   file_count:manifest.length,files:manifest};
  fs.writeFileSync(path.join(target,'portable-manifest.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});
  return {status:'BUNDLE_CREATED',contract:output.contract,
   file_count:manifest.length,synthetic_only:true,no_dependencies_installed:true};
 }catch(e){fs.rmSync(target,{recursive:true,force:true});throw e;}
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 try{
  if(process.argv.length!==2)throw Error('ARGUMENTS_FORBIDDEN');
  const dir=path.join(ROOT,'dist');
  if(!fs.existsSync(dir))fs.mkdirSync(dir,{mode:0o700});
  const result=buildPortableMvp(path.join(dir,'rag-studio-mvp'));
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch{process.stderr.write('PORTABLE_MVP_BUILD_BLOCKED: use fresh output; never overwrite\n');process.exitCode=1;}
}
