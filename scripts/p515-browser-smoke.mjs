/** P5.15 actual Chromium project-dropdown click, synthetic local source only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const home=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p515-browser-'));
fs.cpSync(home,tmp,{recursive:true});
const csv=path.join(tmp,'sales.csv'),manifest=path.join(tmp,'manifest.json');
const data=fs.readFileSync(csv,'utf8').replace('O-1002,N-02,1,24000,24000','O-1002,N-02,1,25000,25000');
fs.writeFileSync(csv,data);
const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
m.project_id='synthetic-shop-002';
const sale=m.files.find(f=>f.relative_path==='sales.csv');
sale.sha256=crypto.createHash('sha256').update(data).digest('hex');
sale.size_bytes=Buffer.byteLength(data);
fs.writeFileSync(manifest,JSON.stringify(m));
const server=createDashboardServer({packageRoot:home,projectRoots:[home,tmp]});
const url=await listenDashboard(server,0);
const driverPort=9517,base='http://127.0.0.1:'+driverPort;
const binary=process.env.CHROMEDRIVER_BIN??(process.env.CHROMEWEBDRIVER?process.env.CHROMEWEBDRIVER+'/chromedriver':'chromedriver');
const child=spawn(binary,['--port='+driverPort,'--allowed-ips=127.0.0.1'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function call(url,method='GET',body){
 const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:{},
 body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const data=await r.json();if(!r.ok||data.value?.error)throw Error('CHROMEDRIVER_REQUEST_FAILED');
 return data.value;
}
async function until(fn){
 for(let i=0;i<70;i++){
  try{if(await fn())return;}catch{}
  await sleep(160);
 }
 throw Error('CHROME_SMOKE_TIMEOUT');
}
let session;
try{
 await until(async()=>(await fetch(base+'/status',{signal:AbortSignal.timeout(1200)})).ok);
 const opened=await call(base+'/session','POST',{capabilities:{alwaysMatch:{
 browserName:'chrome','goog:chromeOptions':{args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1280,900']}}}});
 session=opened.sessionId;
 assert.ok(session);
 const endpoint=base+'/session/'+session;
 const exec=script=>call(endpoint+'/execute/sync','POST',{script,args:[]});
 await call(endpoint+'/url','POST',{url:dashboardLaunchUrl(server)});
 await until(async()=>await exec("return document.getElementById('projectSelect')?.options.length===2"));
 const first=await exec("return {revenue:document.getElementById('revenue').textContent,disabled:document.getElementById('projectSwitch').disabled,hash:location.hash}");
 assert.equal(first.revenue,'157,000원');assert.equal(first.disabled,false);assert.equal(first.hash,'');
 await exec("const s=document.getElementById('projectSelect');s.selectedIndex=1;document.getElementById('projectSwitch').click();return true");
 await until(async()=>await exec("return document.getElementById('revenue').textContent==='158,000원'"));
 const final=await exec("return {project:document.getElementById('projectId').textContent,metric:document.getElementById('revenue').textContent,status:document.getElementById('projectStatus').textContent,answer:document.getElementById('answerPane').textContent}");
 assert.match(final.project,/synthetic-shop-002/);
 assert.equal(final.metric,'158,000원');
 assert.match(final.status,/변경 완료/);
 assert.match(final.answer,/프로젝트가 변경/);
 console.log('P5.15 CHROMIUM PROJECT CHOOSER: 7 checks PASS (2 options, no token leak, switch 158000 and cleared answer)');
}finally{
 if(session){try{await call(base+'/session/'+session,'DELETE');}catch{}}
 child.kill('SIGTERM');
 await new Promise(done=>server.close(done));
 fs.rmSync(tmp,{recursive:true,force:true});
}
