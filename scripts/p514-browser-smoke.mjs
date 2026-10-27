/** P5.14 actual Chrome file-input smoke using public synthetic sources only.
 * No customer sources, screenshots, network uploads or token logging.
 * ChromeDriver runner setup can be unreliable; keep distinct from native tests.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';

const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const json=fileURLToPath(new URL('../fixtures/smax_p42/synthetic_v1.json',import.meta.url));
const csv=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/sales.csv',import.meta.url));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const driverPort=9516,driverHost='http://127.0.0.1:'+driverPort;
async function driver(url,method='GET',body){
 const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:{},
   body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 const response=await r.json();
 if(!r.ok||response.value?.error)throw new Error('CHROMEDRIVER_REQUEST_FAILED');
 return response.value;
}
async function until(fn,code){
 for(let i=0;i<70;i++){
   try{if(await fn())return;}catch{}
   await sleep(180);
 }
 throw new Error(code);
}
const server=createDashboardServer({packageRoot:root});
const address=await listenDashboard(server,0);
const binary=process.env.CHROMEDRIVER_BIN??(process.env.CHROMEWEBDRIVER?process.env.CHROMEWEBDRIVER+'/chromedriver':'chromedriver');
const child=spawn(binary,['--port='+driverPort,'--allowed-ips=127.0.0.1'],{stdio:'ignore'});
let id;
try{
 await until(async()=>(await fetch(driverHost+'/status',{signal:AbortSignal.timeout(1000)})).ok,'CHROMEDRIVER_NOT_READY');
 const session=await driver(driverHost+'/session','POST',{
   capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':{
     args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1280,900']}}}
 });
 id=session.sessionId;
 assert.ok(id);
 const api=driverHost+'/session/'+id;
 const execute=async script=>driver(api+'/execute/sync','POST',{script,args:[]});
 const choose=async(selector,filename)=>{
   const node=await driver(api+'/element','POST',{using:'css selector',value:selector});
   const id=node['element-6066-11e4-a52e-4f735466cecf'];
   assert.ok(id);
   await driver(api+'/element/'+id+'/value','POST',{text:filename});
 };
 await driver(api+'/url','POST',{url:dashboardLaunchUrl(server)});
 await until(async()=>await execute("return document.getElementById('health')?.textContent==='검증된 로컬 데이터'"),'DASHBOARD_NOT_READY');
 await choose('#smaxJson',json);
 await choose('#smaxCsv',csv);
 await execute("document.getElementById('smaxForm').requestSubmit();return true");
 await until(async()=>await execute("return document.getElementById('smaxResult')?.textContent.includes('157,000원')"),'SMAX_RESULT_NOT_RENDERED');
 const snapshot=await execute("return {status:document.getElementById('smaxResult').textContent.includes('CALCULATED_PREVIEW_NOT_APPROVED'),sku:document.getElementById('smaxResult').textContent.includes('N-01'),preserved:document.getElementById('revenue').textContent==='157,000원',hash:location.hash}");
 assert.equal(snapshot.status,true);
 assert.equal(snapshot.sku,true);
 assert.equal(snapshot.preserved,true);
 assert.equal(snapshot.hash,'');
 const denied=await fetch(address+'/api/smax-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal(denied.status,401);
 console.log('P5.14 CHROMIUM UI: 6 checks PASS; selected JSON+CSV, 157000, SKU, approval warning, unchanged dashboard, cleared URL token and 401');
}finally{
 if(id){try{await driver(driverHost+'/session/'+id,'DELETE');}catch{}}
 child.kill('SIGTERM');
 await new Promise(done=>server.close(done));
}
