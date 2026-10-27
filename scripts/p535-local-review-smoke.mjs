/** Verify actual opted-in CLI and Windows CMD read three temp local inputs.
 * No customer data: public synthetic fixtures copied to disposable local files.
 * Report fixed statuses only; never print source or path, username or values.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const fromPortable=process.env.RAG_P535_FROM_PORTABLE==='1';
const cwd=fromPortable?path.join(root,'dist','rag-studio-mvp'):root;
const windows=process.platform==='win32';
const status={contract:'RAG_P535_LOCAL_REVIEW_SMOKE_V1',platform:process.platform,
 portable:fromPortable,synthetic_fixture_only:true,
 genuine_user_customer_input_tested:false,passed:0,failed:0,checks:[],result:'NOT_RUN'};
let dir;
async function check(name,fn){
 try{await fn();status.passed++;status.checks.push({name,status:'PASS'});}
 catch{status.failed++;status.checks.push({name,status:'FAIL'});throw Error(name);}
}
try{
 dir=fs.mkdtempSync(path.join(os.tmpdir(),'rag-review535-'));
 const files=[
  ['fixtures/smax_p42/synthetic_v1.json','source-v1.json'],
  ['fixtures/ax_multi_doc_v0/sales.csv','source.csv'],
  ['fixtures/ax_multi_doc_v0/returns_policy.txt','policy.txt']
 ];
 const names=files.map(([src,dest])=>{
  const target=path.join(dir,dest);
  fs.copyFileSync(path.join(root,src),target,fs.constants.COPYFILE_EXCL);
  return target;
 });
 const baseline=names.map(p=>fs.readFileSync(p));
 const run=(isCmd=false,paths=names)=>{
  const cmd=isCmd?'cmd.exe':process.execPath;
  const args=isCmd?['/d','/c','RUN_LOCAL_SMAX_REVIEW.cmd',...paths]:['src/local-smax-review-cli.mjs',...paths];
  return spawnSync(cmd,args,{cwd,timeout:12000,encoding:'utf8',windowsHide:true,stdio:'pipe'});
 };
 await check('live-local-three-source-cli-always-hold',async()=>{
  const res=run();
  if(res.status!==0)throw Error('CLI_DENIED');
  const j=JSON.parse(res.stdout);
  if(j.status!=='REVIEW_HOLD'||j.sales_preview_status!=='CALCULATED_PREVIEW_NOT_APPROVED'||
     j.source_rows!==6||j.provisional_revenue_krw!=='157000'||
     j.provisional_units!=='10'||!j.document?.sha256||!j.document.line_count||
     j.ax_package_created!==false||j.sqlite_imported!==false||
     j.customer_data_approved!==false||j.remote_upload!==false)throw Error('UNEXPECTED_CONTRACT');
  if(/source-v1\.json|source\.csv|policy\.txt|O-1001|반품 신청/u.test(res.stdout+res.stderr))
   throw Error('PATH_OR_CELL_EXPOSED');
 });
 await check('source-originals-preserved-with-no-side-effects',async()=>{
  for(let i=0;i<names.length;i++)
   if(!fs.readFileSync(names[i]).equals(baseline[i]))throw Error('ORIGINAL_MODIFIED');
  if(fs.readdirSync(dir).length!==3)throw Error('OUTPUT_CREATED');
 });
 await check('mismatched-source-returns-generic-denial',async()=>{
  const copied=Buffer.from(baseline[1]);copied[copied.indexOf(Buffer.from('30000'))]^=1;
  fs.writeFileSync(names[1],copied);
  const res=run();
  if(res.status!==1||!/LOCAL_SMAX_REVIEW_BLOCKED/u.test(res.stderr))throw Error('NOT_FAIL_CLOSED');
  if(/source-v1\.json|source\.csv|policy\.txt|O-1001/u.test(res.stderr+res.stdout))
   throw Error('INPUT_LEAK');
  fs.writeFileSync(names[1],baseline[1]);
 });
 if(windows)await check('real-windows-cmd-local-review-only',async()=>{
  const res=run(true);
  if(res.status!==0)throw Error('WINDOWS_CMD_DENIED');
  const lines=res.stdout.trim().split(/\r?\n/u);
  if(fromPortable&&!lines.some(line=>line.includes('PORTABLE_MVP_INTEGRITY_PASS')))
   throw Error('PORTABLE_INTEGRITY_OUTPUT_MISSING');
  const j=JSON.parse(lines.at(-1));
  if(j.status!=='REVIEW_HOLD'||j.sqlite_imported!==false||j.provisional_revenue_krw!=='157000')
   throw Error('CMD_IMPORT_WAS_NOT_BLOCKED');
 });
 if(fromPortable)await check('portable-manifest-verifies-staged-sources',async()=>{
  const res=spawnSync(process.execPath,['scripts/p533-verify-portable.mjs'],{
   cwd,timeout:8000,encoding:'utf8'});
  if(res.status!==0||!res.stdout.includes('PORTABLE_MVP_INTEGRITY_PASS'))throw Error('PORTABLE_TAMPERED');
 });
 status.result='PASS';
}catch{status.result='FAIL';process.exitCode=1;if(!status.failed){status.failed++;status.checks.push({name:'UNEXPECTED_ERROR',status:'FAIL'});}}
finally{if(dir)fs.rmSync(dir,{recursive:true,force:true});process.stdout.write(JSON.stringify(status,null,2)+'\n');}
