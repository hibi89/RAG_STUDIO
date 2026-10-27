/** P5.37 real process proof: interactive local-only paths to a HOLD plan.
 * Operates exclusively on three copies of public synthetic fixtures.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const portable=process.env.RAG_P537_FROM_PORTABLE==='1';
const cwd=portable?path.join(root,'dist','rag-studio-mvp'):root;
const windows=process.platform==='win32';
const report={contract:'RAG_P537_INTERACTIVE_SMOKE_V1',platform:process.platform,
 portable,synthetic_only:true,customer_data_tested:false,checks:[],passed:0,failed:0,status:'NOT_RUN'};
const pass=async(name,fn)=>{
 try{await fn();report.passed++;report.checks.push({name,result:'PASS'});}
 catch{report.failed++;report.checks.push({name,result:'FAIL'});throw Error(name);}
};
let dir;
try{
 dir=fs.mkdtempSync(path.join(os.tmpdir(),'p537-live-'));
 const files=[
  ['fixtures/smax_p42/synthetic_v1.json','SECRET_v1.json'],
  ['fixtures/ax_multi_doc_v0/sales.csv','SECRET_source.csv'],
  ['fixtures/ax_multi_doc_v0/returns_policy.txt','SECRET_policy.txt']
 ].map(([src,dest])=>{
  const to=path.join(dir,dest);fs.copyFileSync(path.join(root,src),to);return to;
 });
 const original=files.map(f=>fs.readFileSync(f));
 const launch=(selected=files)=>{
  const cmd=windows?'cmd.exe':process.execPath;
  const args=windows?['/d','/c','RUN_LOCAL_SMAX_APPROVAL_PLAN.cmd']:['src/local-smax-approval-wizard.mjs'];
  return spawnSync(cmd,args,{cwd,input:selected.join('\n')+'\n',encoding:'utf8',
    timeout:16000,windowsHide:true,stdio:'pipe'});
 };
 await pass('real-selected-files-stay-unapproved',async()=>{
  const r=launch(files.map(p=>'"'+p+'"'));
  if(r.status!==0)throw Error('WIZARD_FAILED');
  const out=r.stdout.trim().split(/\r?\n/u);
  const answer=JSON.parse(out.at(-1));
  if(answer.contract!=='RAG_LOCAL_SMAX_APPROVAL_PLAN_V1'||answer.status!=='REVIEW_HOLD'||
     answer.review_items?.length!==10||answer.promotion_status!=='NOT_AUTHORIZED_FOR_AX_PROMOTION'||
     answer.sqlite_imported!==false||answer.ax_package_created!==false)throw Error('UNSAFE_PROMOTION');
  if(/SECRET_v1|SECRET_source|SECRET_policy|O-1001|157000|반품 신청/u.test(r.stdout+r.stderr))
   throw Error('RAW_INPUT_EXPOSED');
 });
 await pass('original-three-source-bytes-unchanged',async()=>{
  if(files.some((p,i)=>!fs.readFileSync(p).equals(original[i])))throw Error('ORIGINAL_MODIFIED');
  if(fs.readdirSync(dir).length!==3)throw Error('EXTRA_OUTPUT');
 });
 await pass('source-hash-mismatch-blocks',async()=>{
  fs.appendFileSync(files[1],'tampered');
  const r=launch();
  if(r.status===0||/RAG_LOCAL_SMAX_APPROVAL_PLAN_V1/u.test(r.stdout))throw Error('TAMPER_ACCEPTED');
  if(/SECRET_v1|SECRET_source|SECRET_policy|O-1001|반품 신청/u.test(r.stdout+r.stderr))
   throw Error('RAW_INPUT_EXPOSED');
 });
 if(portable)await pass('portable-contents-verified',async()=>{
  const r=spawnSync(process.execPath,['scripts/p533-verify-portable.mjs'],{
    cwd,timeout:8000,encoding:'utf8',windowsHide:true});
  if(r.status!==0||!r.stdout.includes('PORTABLE_MVP_INTEGRITY_PASS'))
   throw Error('PORTABLE_MANIFEST_BROKEN');
 });
 report.status='PASS';
}catch{report.status='FAIL';process.exitCode=1;if(!report.failed){report.failed++;report.checks.push({name:'UNEXPECTED',result:'FAIL'});}}
finally{
 if(dir)fs.rmSync(dir,{recursive:true,force:true});
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
