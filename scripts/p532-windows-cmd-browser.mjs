/** P5.32: execute actual Windows CMD launcher and browser with synthetic fixtures.
 * Report contains fixed IDs only. Never log ephemeral token, URL, raw CSV, or paths.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const browserChannel=process.env.RAG_P532_BROWSER;
const origin='http://127.0.0.1:8765';
const fixtureRoot=path.join(root,'fixtures','ax_multi_doc_v0');
const names=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
const previous=names.map(n=>fs.readFileSync(path.join(fixtureRoot,n)));
const csv=Buffer.from('sku,quantity,date\nSYNTHETIC-PRIVATE-A,2,2026-10-25\nSYNTHETIC-PRIVATE-B,3,2026-10-26\n');
const summary={schema:'RAG_P532_WINDOWS_BROWSER_V1',browser:browserChannel||'UNSET',
  real_browser_executed:false,actual_cmd_executed:false,synthetic_only:true,
  verified_on_user_pc:false,installer_verified:false,
  status:'NOT_RUN',passed:0,failed:0,checks:[]};
const verify=async(id,fn)=>{
 try{await fn();summary.passed++;summary.checks.push({id,status:'PASS'});}
 catch{summary.failed++;summary.checks.push({id,status:'FAIL'});throw Error(id);}
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const health=()=>fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)});
let child,browser,context,output='',cmdExited=false;
try{
 if(process.platform!=='win32'||!['msedge','chrome'].includes(browserChannel)){
  summary.status='PREREQUISITE_MISSING';process.exitCode=2;
 }else{
  await verify('cmd-refuses-command-line-customer-file',async()=>{
   const r=spawnSync('cmd.exe',['/d','/c','RUN_SYNTHETIC_WINDOWS.cmd','unapproved.csv'],
    {cwd:root,encoding:'utf8',stdio:'pipe',timeout:10000,windowsHide:true});
   assert.equal(r.status,2);
  });
  child=spawn('cmd.exe',['/d','/c','RUN_SYNTHETIC_WINDOWS.cmd'],
   {cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,RAG_DASHBOARD_PORT:'9999'}});
  if(!child.pid)throw Error('CMD_START_FAILED');
  summary.actual_cmd_executed=true;
  child.once('exit',()=>{cmdExited=true;});
  for(const stream of [child.stdout,child.stderr]){
   stream.on('data',b=>{
    if(output.length<8192)output+=b.toString('latin1').slice(0,8192-output.length);
   });
  }
  let launch;
  await verify('cmd-starts-real-loopback-synthetic-server',async()=>{
   for(let i=0;i<120;i++){
    const found=output.match(/http:\/\/127\.0\.0\.1:8765\/#session=[A-Za-z0-9_-]{43}/);
    if(found){
     launch=found[0];
     try{if((await health()).status===200)break;}catch{}
    }
    if(cmdExited)throw Error('CMD_EXITED');
    await sleep(150);
   }
   assert.ok(launch);
   assert.equal(new URL(launch).origin,origin);
   assert.equal((await health()).status,200);
   assert.equal(cmdExited,false);
  });
  await verify('unauthenticated-kpi-api-refused',async()=>{
   const res=await fetch(origin+'/api/overview');
   assert.equal(res.status,401);
  });
  let chromium;
  try{({chromium}=await import('playwright'));}
  catch{summary.status='BROWSER_DRIVER_MISSING';process.exitCode=2;}
  if(chromium){
   try{browser=await chromium.launch({channel:browserChannel,headless:true});}
   catch{summary.status='BROWSER_BINARY_MISSING';process.exitCode=2;}
  }
  if(browser){
   summary.real_browser_executed=true;
   context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
   let foreign=0,scriptErrors=0,posted=0;
   context.on('page',page=>{
    page.on('pageerror',()=>scriptErrors++);
    page.on('request',req=>{
     if(req.method()==='POST'&&req.url().startsWith(origin+'/api/csv-review'))posted++;
    });
   });
   await context.route('**/*',async route=>{
    let dest;
    try{dest=new URL(route.request().url());}
    catch{foreign++;await route.abort();return;}
    if(dest.origin!==origin){foreign++;await route.abort();return;}
    await route.continue();
   });
   const anonymous=await context.newPage();
   await verify('real-browser-anonymous-cannot-read-kpis',async()=>{
    await anonymous.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await anonymous.locator('#health').getByText('세션 연결 필요').waitFor();
    assert.doesNotMatch(await anonymous.locator('#revenue').innerText(),/157,000/);
   });
   const page=await context.newPage();
   await verify('real-browser-uses-cmd-session-and-verified-kpis',async()=>{
    await page.goto(launch,{waitUntil:'domcontentloaded'});
    await page.locator('#health').getByText('검증된 로컬 데이터').waitFor({timeout:12000});
    assert.equal(new URL(page.url()).hash,'');
    assert.match(await page.locator('#revenue').innerText(),/157,000/);
    assert.equal(await page.locator('#orders').innerText(),'6건');
    assert.equal(await page.locator('#units').innerText(),'10개');
   });
   await verify('real-browser-csv-selection-and-unapproved-types',async()=>{
    await page.locator('#csvReviewFile').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:csv});
    await page.locator('#csvReviewButton').click();
    await page.locator('#csvReviewResult strong').getByText(/NEEDS_REVIEW/).waitFor();
    const text=await page.locator('#csvReviewResult').innerText();
    assert.match(text,/TEXT/);assert.match(text,/INTEGER/);assert.match(text,/DATE/);
    assert.match(text,/승인·데이터 반입 없음/);
    assert.doesNotMatch(text,/SYNTHETIC-PRIVATE-[AB]/);
    assert.equal(await page.locator('#csvReviewResult tbody tr').count(),3);
    assert.equal(posted,1);
   });
   await verify('real-browser-html-injection-is-inert-text',async()=>{
    const hostile=Buffer.from('"<img src=x onerror=alert(1)>",qty\nSYNTHETIC-PRIVATE-C,3\n');
    await page.locator('#csvReviewFile').setInputFiles({name:'hostile.csv',mimeType:'text/csv',buffer:hostile});
    await page.locator('#csvReviewButton').click();
    await page.locator('#csvReviewResult strong').getByText(/NEEDS_REVIEW/).waitFor();
    assert.equal(await page.locator('#csvReviewResult img').count(),0);
    assert.match(await page.locator('#csvReviewResult').innerText(),/<img src=x onerror=alert\(1\)>/);
    assert.equal(posted,2);
   });
   await verify('real-browser-invalid-csv-fails-closed',async()=>{
    await page.locator('#csvReviewFile').setInputFiles({name:'broken.csv',mimeType:'text/csv',
      buffer:Buffer.from('secret,qty\n"UNFINISHED,2\n')});
    await page.locator('#csvReviewButton').click();
    await page.locator('#csvReviewResult').getByText(/CSV를 검토하지 못했습니다/).waitFor();
    assert.doesNotMatch(await page.locator('#csvReviewResult').innerText(),/UNFINISHED/);
    assert.equal(posted,3);
   });
   await verify('real-browser-oversize-csv-blocked-before-request',async()=>{
    const before=posted;
    await page.locator('#csvReviewFile').setInputFiles({name:'oversize.csv',mimeType:'text/csv',
      buffer:Buffer.alloc(1024*1024+1,65)});
    await page.locator('#csvReviewButton').click();
    await page.locator('#csvReviewResult').getByText(/1MiB 이하/).waitFor();
    assert.equal(posted,before);
   });
   await verify('real-browser-mobile-kpis-and-no-external-errors',async()=>{
    await page.setViewportSize({width:390,height:844});
    await page.locator('#csvReviewFile').setInputFiles({name:'mobile.csv',mimeType:'text/csv',buffer:csv});
    await page.locator('#csvReviewButton').click();
    await page.locator('#csvReviewResult strong').getByText(/NEEDS_REVIEW/).waitFor();
    assert.equal(posted,4);
    assert.match(await page.locator('#revenue').innerText(),/157,000/);
    assert.equal(foreign,0);assert.equal(scriptErrors,0);
   });
   summary.status='PASS';
  }
  await verify('canonical-fixture-bytes-unchanged',async()=>{
   for(let i=0;i<names.length;i++)assert.deepEqual(fs.readFileSync(path.join(fixtureRoot,names[i])),previous[i]);
  });
 }
}catch{
 if(summary.status==='NOT_RUN')summary.status='FAIL';
 if(summary.failed===0){summary.failed++;summary.checks.push({id:'UNEXPECTED_ERROR',status:'FAIL'});}
 process.exitCode=1;
}finally{
 if(context)await context.close().catch(()=>{});
 if(browser)await browser.close().catch(()=>{});
 if(child?.pid){
  const killed=spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],
   {stdio:'ignore',windowsHide:true,timeout:15000});
  child.stdout?.destroy();child.stderr?.destroy();
  let closed=false;
  for(let i=0;i<30;i++){
   try{await health();}catch{closed=true;break;}
   await sleep(150);
  }
  if(!closed||killed.error){summary.status='CLEANUP_FAILED';summary.failed++;process.exitCode=1;}
 }
 output='';
 process.stdout.write(JSON.stringify(summary,null,2)+'\n');
}
