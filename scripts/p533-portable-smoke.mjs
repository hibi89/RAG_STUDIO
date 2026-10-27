/** Synthetic-only E2E of an ACTUAL copied MVP folder. No auth URL logging. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyPortableMvp} from './p533-verify-portable.mjs';
const cwd=fileURLToPath(new URL('../dist/rag-studio-mvp/',import.meta.url));
const windows=process.platform==='win32';
let child,output='',session=null,base=null,stopped=false;
const report={contract:'RAG_PORTABLE_MVP_SMOKE_V1',windows_cmd_executed:false,
  synthetic_only:true,customer_data_tested:false,
  status:'NOT_RUN',checks:[],passed:0,failed:0};
const check=async(id,fn)=>{try{await fn();report.passed++;report.checks.push({id,status:'PASS'});}
 catch{report.failed++;report.checks.push({id,status:'FAIL'});throw Error(id);}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 await check('portable-hash-manifest-valid',async()=>{
  assert.equal(verifyPortableMvp(cwd).status,'PORTABLE_MVP_INTEGRITY_PASS');
 });
 if(windows)await check('mvp-cmd-refuses-arguments',async()=>{
  const x=spawnSync('cmd.exe',['/d','/c','RUN_MVP_WINDOWS.cmd','unapproved.csv'],{
   cwd,windowsHide:true,stdio:'pipe',timeout:5000});
  assert.equal(x.status,2);
 });
 const cmd=windows?'cmd.exe':process.execPath;
 const args=windows?['/d','/c','RUN_MVP_WINDOWS.cmd']:['src/dashboard-cli.mjs','fixtures/ax_multi_doc_v0'];
 child=spawn(cmd,args,{cwd,stdio:['ignore','pipe','pipe'],
  windowsHide:true,env:{...process.env,RAG_DASHBOARD_PORT:windows?'9999':'0'}});
 if(!child.pid)throw Error('CHILD_START_BLOCKED');
 report.windows_cmd_executed=windows;
 child.once('exit',()=>{stopped=true;});
 for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{
  if(output.length<10000)output+=bytes.toString('latin1').slice(0,10000-output.length);
 });
 await check('portable-app-starts-real-local-server',async()=>{
  for(let i=0;i<100;i++){
   const match=output.match(/http:\/\/127\.0\.0\.1:\d+\/#session=[A-Za-z0-9_-]{43}/);
   if(match){session=match[0];base=new URL(session).origin;
    try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)})).status===200)break;}catch{}}
   if(stopped)throw Error('EARLY_EXIT');
   await sleep(120);
  }
  assert.ok(session);
  assert.equal(new URL(session).hostname,'127.0.0.1');
  if(windows)assert.equal(new URL(session).port,'8765');
  assert.equal((await fetch(base+'/api/health')).status,200);
 });
 await check('portable-rejects-unauthenticated-verified-data',async()=>{
  assert.equal((await fetch(base+'/api/overview')).status,401);
 });
 const token=new URL(session).hash.slice('#session='.length);
 await check('portable-serves-exact-sales-and-document-baseline',async()=>{
  const res=await fetch(base+'/api/overview',{headers:{Authorization:'Bearer '+token}});
  assert.equal(res.status,200);
  const obj=await res.json();
  assert.equal(obj.dataset.revenue_krw,157000);
  assert.equal(obj.dataset.orders,6);
  assert.equal(obj.dataset.units,10);
  assert.equal(obj.documents.length,2);
 });
 await check('portable-serves-real-browser-assets',async()=>{
  const r=await fetch(base+'/');
  assert.equal(r.status,200);
  const html=await r.text();
  assert.match(html,/csvReviewFile/);
  assert.match(html,/revenue/);
 });
 report.status='PASS';
}catch{report.status='FAIL';process.exitCode=1;if(report.failed===0){report.failed++;report.checks.push({id:'UNEXPECTED_ERROR',status:'FAIL'});}}
finally{
 if(child?.pid){
  if(windows){spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true,timeout:10000});}
  else child.kill('SIGTERM');
  let terminated=false;
  for(let i=0;i<35;i++){
   if(!base){terminated=true;break;}
   try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(400)});}
   catch{terminated=true;break;}
   await sleep(120);
  }
  if(!terminated){report.status='CLEANUP_FAILED';report.failed++;process.exitCode=1;}
 }
 output='';session=null;
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
