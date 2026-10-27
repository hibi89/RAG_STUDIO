/** Offline, read-only preflight for the P3 synthetic dashboard. Never echoes paths,
 * source contents, raw validation exceptions, or environment variables. */
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REQUIRED_NODE=[22,16,0];
export function nodeMeetsMinimum(version){
  if(typeof version!=='string'||!/^\d+\.\d+\.\d+$/.test(version))return false;
  const parts=version.split('.').map(Number);
  for(let i=0;i<3;i++){
    if(parts[i]>REQUIRED_NODE[i])return true;
    if(parts[i]<REQUIRED_NODE[i])return false;
  }
  return true;
}
export function checkRuntime({nodeVersion=process.versions.node,platform=process.platform,arch=process.arch,totalMemoryBytes=os.totalmem()}={}){
  const nodeOk=nodeMeetsMinimum(nodeVersion);
  return {
    status:nodeOk?'SUPPORTED_NODE':'UNSUPPORTED_NODE',
    node_version:nodeVersion,
    minimum_node:'22.16.0',
    platform,
    arch,
    memory_gib:Number.isFinite(totalMemoryBytes)&&totalMemoryBytes>=0?Math.round(totalMemoryBytes/1073741824*10)/10:null,
    notices:['RAM/CPU capacity for local models is not evaluated','Windows installation and real browser rendering are not evaluated']
  };
}
export function summarizeVerifiedPackage(pkg){
  if(!pkg||!pkg.manifest||!Array.isArray(pkg.manifest.files)||!Array.isArray(pkg.manifest.datasets)||!Array.isArray(pkg.manifest.documents)||!Array.isArray(pkg.manifest.review_items))throw new Error('invalid verified package');
  const m=pkg.manifest;
  return {
    status:'CONTRACT_VALIDATED',
    schema_version:m.schema_version,
    files:m.files.length,
    accepted_files:m.files.filter(f=>f.import_status==='ACCEPTED').length,
    needs_review_files:m.files.filter(f=>f.import_status==='NEEDS_REVIEW').length,
    rejected_files:m.files.filter(f=>f.import_status==='REJECTED').length,
    datasets:m.datasets.length,
    documents:m.documents.length,
    unresolved_review_items:m.review_items.filter(r=>r.status==='OPEN').length,
    notice:'Manifest/content validation is not a dashboard, search, Windows or product release test'
  };
}
/** Verify via existing RAG Studio contract checker. Injection permits isolated tests. */
export async function checkPackage(packageRoot,verifier){
  try{
    if(typeof packageRoot!=='string'||!packageRoot.trim())return {status:'PACKAGE_INVALID',code:'PATH_REQUIRED'};
    const verify=verifier??(await import('./validate.mjs')).loadPackage;
    const pkg=await verify(packageRoot);
    return summarizeVerifiedPackage(pkg);
  }catch{
    // Validation exceptions can contain source names and local paths; do not echo.
    return {status:'PACKAGE_INVALID',code:'CONTRACT_OR_FILE_CHECK_FAILED'};
  }
}
export async function runDoctor(packageRoot,options={}){
  const runtime=checkRuntime(options.runtime);
  if(runtime.status!=='SUPPORTED_NODE')return {status:'BLOCKED',runtime,package:{status:'NOT_CHECKED'}};
  const checked=await checkPackage(packageRoot,options.verifier);
  return {status:checked.status==='CONTRACT_VALIDATED'?'PREFLIGHT_OK':'BLOCKED',runtime,package:checked};
}
function isDirectRun(){
  if(!process.argv[1])return false;
  return path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
}
if(isDirectRun()){
  const defaultRoot=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
  const result=await runDoctor(process.argv[2]??defaultRoot);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(result.status!=='PREFLIGHT_OK')process.exitCode=1;
}
