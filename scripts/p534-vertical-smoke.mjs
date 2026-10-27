/** Actual P5.34 CLI process -> loopback bearer -> verified SQLite/document answer.
 * Runs in repository root OR separately built offline portable folder. Reports
 * only fixed check IDs, no token, private URL or raw synthetic rows.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const copied=process.env.RAG_P534_FROM_PORTABLE==='1';
const cwd=copied?path.join(root,'dist','rag-studio-mvp'):root;
const win=process.platform==='win32';
const checks=[];
let child,privateOutput='',base=null,token=null,exited=false,errors=0;
const report={schema:'RAG_P534_REAL_VERTICAL_SMOKE_V1',platform:process.platform,
 from_portable_bundle:copied,real_process_executed:false,synthetic_only:true,
 actual_customer_source_tested:false,authenticated_review_claimed:false,
 status:'NOT_RUN',passed:0,failed:0,checks};
const verify=async(id,fn)=>{
 try{await fn();report.passed++;checks.push({id,status:'PASS'});}
 catch{report.failed++;checks.push({id,status:'FAIL'});throw Error(id);}
};
const nap=ms=>new Promise(r=>setTimeout(r,ms));
try{
 if(copied)await verify('portable-directory-verified',async()=>{
  const r=spawnSync(process.execPath,['scripts/p533-verify-portable.mjs'],{
   cwd,stdio:'pipe',timeout:8000,encoding:'utf8'});
  if(r.status!==0)throw Error('INVALID_PORTABLE');
 });
 const cmd=win?'cmd.exe':process.execPath;
 const args=win?['/d','/c','RUN_SMAX_SYNTHETIC_MVP.cmd']:['scripts/p534-smax-vertical-cli.mjs'];
 const env={...process.env,RAG_DASHBOARD_PORT:win?'9999':'0'};
 child=spawn(cmd,args,{cwd,windowsHide:true,env,stdio:['ignore','pipe','pipe']});
 if(!child.pid)throw Error('CANNOT_START');
 report.real_process_executed=true;
 child.once('exit',()=>{exited=true;});
 for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{
  if(privateOutput.length<10000)privateOutput+=bytes.toString('latin1').slice(0,10000-privateOutput.length);
 });
 await verify('smax-cli-starts-private-local-dashboard',async()=>{
  for(let i=0;i<120;i++){
   const found=privateOutput.match(/http:\/\/127\.0\.0\.1:\d+\/#session=([A-Za-z0-9_-]{43})/);
   if(found){
    const u=new URL(found[0]);base=u.origin;token=found[1];
    try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(550)});if(r.status===200)break;}catch{}
   }
   if(exited)throw Error('CLI_EXIT');
   await nap(120);
  }
  if(!base||!token)throw Error('MISSING_LOCAL_SESSION');
  if(win&&base!=='http://127.0.0.1:8765')throw Error('WINDOWS_FIXED_PORT_NOT_RESPECTED');
  if((await fetch(base+'/api/health')).status!==200)throw Error('NO_HEALTH');
 });
 await verify('smax-unauthed-overview-refused',async()=>{
  const r=await fetch(base+'/api/overview');if(r.status!==401)throw Error('UNAUTH_ACCEPTED');
 });
 await verify('smax-verified-sql-revenue-and-lineage',async()=>{
  const r=await fetch(base+'/api/overview',{headers:{Authorization:'Bearer '+token}});
  if(r.status!==200)throw Error('OVERVIEW_FAILED');
  const d=await r.json();
  if(d.dataset.orders!==6||d.dataset.revenue_krw!=='157000'||
     d.dataset.units!=='10'||d.dataset.source_rows.length!==6||
     !d.documents.some(x=>x.document_id==='document-returns'))throw Error('INCONSISTENT_BASELINE');
 });
 await verify('smax-mixed-sql-document-answer-has-original-line',async()=>{
  const r=await fetch(base+'/api/query',{method:'POST',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
    Origin:base},body:JSON.stringify({question:'매출과 반품 신청 기간은?'})});
  if(r.status!==200)throw Error('QUERY_FAILED');
  const ans=await r.json();
  if(ans.status!=='ANSWERED'||ans.kind!=='SQL_DOCUMENT'||
     ans.metric_evidence?.orders!==6||ans.metric_evidence?.revenue_krw!=='157000'||
     ans.metric_evidence?.row_evidence?.length!==6||
     !ans.document_evidence?.some(x=>x.line>0&&x.file_id==='file-policy'))
    throw Error('EVIDENCE_MISSING');
 });
 await verify('smax-browser-html-served-without-external-network',async()=>{
  const r=await fetch(base+'/');
  if(r.status!==200)throw Error('UI_NOT_SERVED');
  const html=await r.text();
  if(!html.includes('csvReviewFile'))throw Error('MVP_UI_ABSENT');
 });
 report.status='PASS';
}catch{report.status='FAIL';process.exitCode=1;if(!report.failed){report.failed++;checks.push({id:'UNEXPECTED_ERROR',status:'FAIL'});}}
finally{
 if(child?.pid){
  if(win)spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:12000});
  else child.kill('SIGTERM');
  let closed=false;
  for(let i=0;i<35;i++){
   if(!base){closed=true;break;}
   try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(400)});}
   catch{closed=true;break;}
   await nap(120);
  }
  if(!closed){report.status='CLEANUP_FAILED';report.failed++;process.exitCode=1;}
 }
 privateOutput='';token=null;
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
