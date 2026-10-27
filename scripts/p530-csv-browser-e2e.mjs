/** Real Chromium P5.30 regression against public synthetic CSV only.
 * Output reports test IDs and counts, never session token/source records.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';

const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const names=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
const before=names.map(n=>fs.readFileSync(path.join(root,n)));
const csv=Buffer.from('sku,quantity,date\nROW-PRIVATE-SYNTHETIC-1,2,2026-10-25\nROW-PRIVATE-SYNTHETIC-2,3,2026-10-26\n');
const report={contract:'rag.p530.browser.v1',status:'NOT_RUN',real_browser_executed:false,
 synthetic_only:true,windows_physical_verified:false,passed:0,failed:0,checks:[]};
const check=async(id,callback)=>{
 try{await callback();report.passed++;report.checks.push({id,status:'PASS'});}
 catch{report.failed++;report.checks.push({id,status:'FAIL'});throw Error(id);}
};
let server,context,browser;
try{
 let chromium;
 try{({chromium}=await import('playwright'));}
 catch{report.status='BROWSER_PREREQUISITE_MISSING';process.exitCode=2;}
 if(chromium){
  try{browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});}
  catch{report.status='BROWSER_UNAVAILABLE';process.exitCode=2;}
 }
 if(browser){
  report.real_browser_executed=true;
  server=createDashboardServer({packageRoot:root});
  const origin=await listenDashboard(server,0),launch=dashboardLaunchUrl(server);
  context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
  let external=0,errors=0,csvPosts=0;
  context.on('page',p=>{
   p.on('pageerror',()=>errors++);
   p.on('request',r=>{
    if(r.method()==='POST'&&r.url().startsWith(origin+'/api/csv-review'))csvPosts++;
   });
  });
  await context.route('**/*',async route=>{
   let u;
   try{u=new URL(route.request().url());}
   catch{external++;await route.abort();return;}
   if(u.origin!==origin){external++;await route.abort();return;}
   await route.continue();
  });
  const anonymous=await context.newPage();
  await check('anonymous-no-kpi',async()=>{
   await anonymous.goto(origin+'/',{waitUntil:'domcontentloaded'});
   await anonymous.locator('#health').getByText('세션 연결 필요').waitFor();
   assert.doesNotMatch(await anonymous.locator('#revenue').innerText(),/157,000/);
  });
  const page=await context.newPage();
  await check('authorized-dashboard-kpis',async()=>{
   await page.goto(launch,{waitUntil:'domcontentloaded'});
   await page.locator('#health').getByText('검증된 로컬 데이터').waitFor();
   assert.equal(new URL(page.url()).hash,'');
   assert.match(await page.locator('#revenue').innerText(),/157,000/);
   assert.equal(await page.locator('#orders').innerText(),'6');
   assert.equal(await page.locator('#units').innerText(),'10');
  });
  await check('real-csv-file-input-and-review',async()=>{
   await page.locator('#csvReviewFile').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:csv});
   await page.locator('#csvReviewButton').click();
   await page.locator('#csvReviewResult strong').getByText(/NEEDS_REVIEW/).waitFor();
   const text=await page.locator('#csvReviewResult').innerText();
   assert.match(text,/TEXT/);assert.match(text,/INTEGER/);assert.match(text,/DATE/);
   assert.match(text,/승인·데이터 반입 없음/);
   assert.doesNotMatch(text,/ROW-PRIVATE-SYNTHETIC-[12]/);
   assert.equal(await page.locator('#csvReviewResult tbody tr').count(),3);
   assert.equal(csvPosts,1);
  });
  await check('malicious-header-escaped-as-text',async()=>{
   const hostile=Buffer.from('"<img src=x onerror=alert(1)>",qty\nSYNTHETIC-SECRET,3\n');
   await page.locator('#csvReviewFile').setInputFiles({name:'hostile.csv',mimeType:'text/csv',buffer:hostile});
   await page.locator('#csvReviewButton').click();
   await page.locator('#csvReviewResult strong').getByText(/NEEDS_REVIEW/).waitFor();
   assert.equal(await page.locator('#csvReviewResult img').count(),0);
   assert.match(await page.locator('#csvReviewResult').innerText(),/<img src=x onerror=alert\(1\)>/);
   assert.equal(csvPosts,2);
  });
  await check('malformed-quote-does-not-leak-raw-cells',async()=>{
   await page.locator('#csvReviewFile').setInputFiles({
    name:'broken.csv',mimeType:'text/csv',buffer:Buffer.from('secret,qty\n"UNFINISHED,2\n')});
   await page.locator('#csvReviewButton').click();
   await page.locator('#csvReviewResult').getByText(/CSV를 검토하지 못했습니다/).waitFor();
   assert.doesNotMatch(await page.locator('#csvReviewResult').innerText(),/UNFINISHED/);
   assert.equal(csvPosts,3);
  });
  await check('oversize-refused-before-http',async()=>{
   const count=csvPosts;
   await page.locator('#csvReviewFile').setInputFiles({
    name:'large.csv',mimeType:'text/csv',buffer:Buffer.alloc(1024*1024+1,65)});
   await page.locator('#csvReviewButton').click();
   await page.locator('#csvReviewResult').getByText(/1MiB 이하/).waitFor();
   assert.equal(csvPosts,count);
  });
  await check('baseline-unchanged-and-unauthorized-api-denied',async()=>{
   assert.match(await page.locator('#revenue').innerText(),/157,000/);
   assert.equal(await page.locator('#orders').innerText(),'6');
   const res=await fetch(origin+'/api/csv-review',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({source_csv_base64:csv.toString('base64')})});
   assert.equal(res.status,401);
  });
  await check('mobile-picker-and-no-runtime-or-external-errors',async()=>{
   await page.setViewportSize({width:390,height:844});
   await page.locator('#csvReviewFile').setInputFiles({name:'mobile.csv',mimeType:'text/csv',buffer:csv});
   await page.locator('#csvReviewButton').click();
   await page.locator('#csvReviewResult strong').getByText(/NEEDS_REVIEW/).waitFor();
   assert.equal(csvPosts,4);
   assert.equal(external,0);assert.equal(errors,0);
  });
  await check('fixture-bytes-unchanged',async()=>{
   for(let i=0;i<names.length;i++)assert.deepEqual(fs.readFileSync(path.join(root,names[i])),before[i]);
  });
  report.status='PASS';
 }
}catch{
 if(report.status==='NOT_RUN')report.status='FAIL';
 if(report.failed===0){report.failed++;report.checks.push({id:'UNEXPECTED_FAILURE',status:'FAIL'});}
 process.exitCode=1;
}finally{
 if(context)await context.close().catch(()=>{});
 if(browser)await browser.close().catch(()=>{});
 if(server?.listening)await new Promise(done=>{server.closeAllConnections();server.close(done);});
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
