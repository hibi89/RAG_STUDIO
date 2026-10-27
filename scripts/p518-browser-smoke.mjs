/** P5.18 real Chromium: select a single verified source, search, add second, compare. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const server=createDashboardServer({packageRoot:root});
await listenDashboard(server,0);
const driverPort=9528,base='http://127.0.0.1:'+driverPort;
const binary=process.env.CHROMEDRIVER_BIN??(process.env.CHROMEWEBDRIVER?process.env.CHROMEWEBDRIVER+'/chromedriver':'chromedriver');
const child=spawn(binary,['--port='+driverPort,'--allowed-ips=127.0.0.1'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function call(url,method='GET',body){
 const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:{},
 body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(url.endsWith('/session')?45000:15000)});
 const data=await r.json();if(!r.ok||data.value?.error)throw Error('CHROMEDRIVER_REQUEST_FAILED');
 return data.value;
}
async function until(fn){
 for(let i=0;i<70;i++){
  try{if(await fn())return;}catch{}
  await sleep(160);
 }
 throw Error('CHROME_KNOWLEDGE_TIMEOUT');
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
 await until(async()=>await exec("return document.querySelectorAll('#documentCards .doc-select input').length===2"));
 const init=await exec("return {count:document.querySelectorAll('#documentCards .doc-select input').length,hash:location.hash,metric:document.getElementById('revenue').textContent}");
 assert.equal(init.count,2);assert.equal(init.hash,'');assert.equal(init.metric,'157,000원');
 await exec("document.querySelectorAll('#documentCards .doc-select input')[0].click();document.getElementById('knowledgeQuestion').value='반품 신청 기간';document.getElementById('knowledgeSearch').click();return true");
 await until(async()=>await exec("return document.getElementById('knowledgeResult').textContent.includes('FOUND')"));
 const searched=await exec("return {text:document.getElementById('knowledgeResult').textContent,count:document.getElementById('knowledgeCount').textContent}");
 assert.match(searched.text,/반품/);assert.match(searched.text,/document-returns|합성 반품/);
 assert.match(searched.count,/1개/);
 await exec("document.querySelectorAll('#documentCards .doc-select input')[1].click();document.getElementById('knowledgeCompare').click();return true");
 await until(async()=>await exec("return document.getElementById('knowledgeResult').textContent.includes('COMPARISON_READY')"));
 const compared=await exec("return {text:document.getElementById('knowledgeResult').textContent,count:document.getElementById('knowledgeCount').textContent,metric:document.getElementById('revenue').textContent}");
 assert.match(compared.count,/2개/);
 assert.match(compared.text,/7 calendar_days/);
 assert.match(compared.text,/2 business_days/);
 assert.equal(compared.metric,'157,000원');
 console.log('P5.18 REAL CHROMIUM KNOWLEDGE BASE: 11 checks PASS');
}finally{
 if(session){try{await call(base+'/session/'+session,'DELETE');}catch{}}
 child.kill('SIGTERM');
 await new Promise(done=>server.close(done));
}
