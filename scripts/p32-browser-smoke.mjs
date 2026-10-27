/** Real Chromium+ChromeDriver smoke against the actual local synthetic server.
 * No npm dependencies, remote connections, uploads, screenshots, or token logs.
 * GitHub ubuntu-24.04 image supplies matching Chrome+ChromeDriver.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';

const fixture=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=9515;
const base='http://127.0.0.1:'+port;
async function request(url,method='GET',body){
  const response=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  const data=await response.json();
  if(!response.ok||data.value?.error)throw new Error('Browser driver request failed: '+(data.value?.error??response.status));
  return data.value;
}
async function waitUntil(predicate,label){
  for(let i=0;i<65;i++){
    try{const result=await predicate();if(result)return result;}catch{}
    await sleep(150);
  }
  throw new Error('Browser smoke timed out at '+label);
}
async function run(){
  const server=createDashboardServer({packageRoot:fixture});
  const url=await listenDashboard(server,0);
  // On GitHub-hosted Ubuntu 24.04, ChromeDriver executable is on PATH.
  const driver=spawn(process.env.CHROMEDRIVER_BIN??'chromedriver',['--port='+port,'--allowed-ips=127.0.0.1'],{stdio:'ignore'});
  let sessionId;
  try{
    await waitUntil(async()=>{const r=await fetch(base+'/status');return r.ok;},'driver startup');
    const session=await request(base+'/session','POST',{capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':{args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1280,900']}}}});
    sessionId=session.sessionId;
    assert.ok(sessionId,'ChromeDriver session required');
    const endpoint=base+'/session/'+sessionId;
    const exec=async(script)=>request(endpoint+'/execute/sync','POST',{script,args:[]});
    await request(endpoint+'/url','POST',{url:dashboardLaunchUrl(server)});
    await waitUntil(async()=>await exec("return document.querySelector('#health')?.textContent==='검증된 로컬 데이터'"),'authenticated overview');
    const initial=await exec("return {hash:location.hash,revenue:document.querySelector('#revenue')?.textContent,docs:document.querySelectorAll('#documentCards .doc').length,rows:document.querySelectorAll('#sourceRows tr').length,js:!!document.querySelector('#askForm')}");
    assert.equal(initial.hash,'');
    assert.equal(initial.revenue,'157,000원');
    assert.equal(initial.docs,2);
    assert.equal(initial.rows,6);
    assert.equal(initial.js,true);
    await exec("document.querySelector('#askForm').requestSubmit();return true");
    await waitUntil(async()=>await exec("return document.querySelectorAll('#answerPane button.citation-link').length>=8"),'citation buttons');
    const first=await exec("const b=document.querySelector('#answerPane button.citation-link');b.click();return {csv:document.querySelectorAll('#sourceRows tr.source-active').length,detail:document.querySelector('#citationDetail').textContent,focused:document.activeElement===document.querySelector('#sourceRows tr.source-active')}");
    assert.equal(first.csv,1);
    assert.equal(first.focused,true);
    assert.match(first.detail,/CSV .*행/);
    const second=await exec("const b=[...document.querySelectorAll('#answerPane button.citation-link')].find(x=>x.textContent.includes('문서'));b.click();return {docs:document.querySelectorAll('#documentCards .source-active').length,csv:document.querySelectorAll('#sourceRows tr.source-active').length,detail:document.querySelector('#citationDetail').textContent}");
    assert.equal(second.docs,1);
    assert.equal(second.csv,0);
    assert.match(second.detail,/문서/);
    await exec("document.querySelector('#askForm').requestSubmit();return true");
    const third=await exec("return document.querySelectorAll('.source-active').length");
    assert.equal(third,0);
    await request(endpoint+'/url','POST',{url:url+'/'});
    await waitUntil(async()=>await exec("return document.querySelector('#health')?.textContent==='세션 연결 필요'"),'no-token fail closed');
    const denied=await fetch(url+'/api/overview');
    assert.equal(denied.status,401);
    console.log('P3.2 CHROMIUM SMOKE: 10 checks PASS; real local server + actual DOM, auth, quote links and focus; Linux only');
  }finally{
    if(sessionId){try{await request(base+'/session/'+sessionId,'DELETE');}catch{}}
    driver.kill('SIGTERM');
    await new Promise(resolve=>server.close(resolve));
  }
}
await run();
