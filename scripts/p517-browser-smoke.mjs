/** P5.17 real Chrome: first cited question -> follow-up -> resolved source on same local project. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const server=createDashboardServer({packageRoot:root});
await listenDashboard(server,0);
const driverPort=9527,base='http://127.0.0.1:'+driverPort;
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
 throw Error('CHROME_FOLLOWUP_TIMEOUT');
}
let session;
try{
 await until(async()=>(await fetch(base+'/status',{signal:AbortSignal.timeout(1200)})).ok);
 const opened=await call(base+'/session','POST',{capabilities:{alwaysMatch:{
 browserName:'chrome','goog:chromeOptions':{args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1280,900']}}}});
 session=opened.sessionId;assert.ok(session);
 const endpoint=base+'/session/'+session;
 const exec=script=>call(endpoint+'/execute/sync','POST',{script,args:[]});
 await call(endpoint+'/url','POST',{url:dashboardLaunchUrl(server)});
 await until(async()=>await exec("return document.getElementById('projectSelect')?.options.length===1"));
 const before=await exec("return {hash:location.hash,ready:document.getElementById('followupButton').disabled,metric:document.getElementById('revenue').textContent}");
 assert.equal(before.hash,'');assert.equal(before.ready,true);assert.equal(before.metric,'157,000원');
 await exec("document.getElementById('question').value='반품 기간은?';document.getElementById('askButton').click();return true");
 await until(async()=>await exec("return !document.getElementById('followupButton').disabled"));
 const first=await exec("return document.getElementById('answerPane').textContent");
 assert.match(first,/ANSWERED/);assert.match(first,/7일/);
 await exec("document.getElementById('question').value='그건 며칠이야?';document.getElementById('followupButton').click();return true");
 await until(async()=>await exec("return document.getElementById('answerPane').textContent.includes('근거 재검증 후속 질문')"));
 const second=await exec("return {answer:document.getElementById('answerPane').textContent,enabled:!document.getElementById('followupButton').disabled,metric:document.getElementById('revenue').textContent}");
 assert.match(second.answer,/7일/);assert.match(second.answer,/document-returns/);
 assert.equal(second.enabled,true);assert.equal(second.metric,'157,000원');
 console.log('P5.17 ACTUAL CHROMIUM FOLLOWUP: 10 checks PASS');
}finally{
 if(session){try{await call(base+'/session/'+session,'DELETE');}catch{}}
 child.kill('SIGTERM');
 await new Promise(done=>server.close(done));
}
