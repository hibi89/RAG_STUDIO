import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const origin=path.join(repo,'fixtures/ax_multi_doc_v0');
function anotherProject(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p515-'));
 fs.cpSync(origin,root,{recursive:true});
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const csv=path.join(root,'sales.csv'),manifest=path.join(root,'manifest.json');
 const data=fs.readFileSync(csv,'utf8').replace('O-1002,N-02,1,24000,24000','O-1002,N-02,1,25000,25000');
 assert.ok(data.includes('1,25000,25000'));
 fs.writeFileSync(csv,data);
 const meta=JSON.parse(fs.readFileSync(manifest,'utf8'));
 meta.project_id='synthetic-shop-002';
 const entry=meta.files.find(f=>f.relative_path==='sales.csv');
 entry.sha256=crypto.createHash('sha256').update(data).digest('hex');
 entry.size_bytes=Buffer.byteLength(data);
 fs.writeFileSync(manifest,JSON.stringify(meta,null,2));
 return root;
}
async function start(t,extra){
 const server=createDashboardServer({packageRoot:origin,projectRoots:[origin,extra]});
 const url=await listenDashboard(server,0);
 t.after(()=>new Promise(done=>server.close(done)));
 const secret=dashboardLaunchUrl(server).split('#session=')[1];
 const auth={Authorization:'Bearer '+secret};
 const list=await (await fetch(url+'/api/projects',{headers:auth})).json();
 return {url,auth,list,server};
}
const choose=(s,key,options={})=>fetch(s.url+'/api/projects/select',{
 method:'POST',headers:{...s.auth,'Content-Type':'application/json',...options.headers},
 body:options.body??JSON.stringify({project_key:key})
});
test('P5.15 lists only two explicit validated projects with opaque keys, never paths',async t=>{
 const other=anotherProject(t),s=await start(t,other);
 assert.equal(s.list.status,'EXPLICIT_LOCAL_PROJECTS_ONLY');
 assert.equal(s.list.projects.length,2);
 assert.deepEqual(s.list.projects.map(x=>x.project_id),['synthetic-shop-001','synthetic-shop-002']);
 assert.match(s.list.selected,/^[a-f0-9]{32}$/);
 assert.notEqual(s.list.projects[0].project_key,s.list.projects[1].project_key);
 assert.doesNotMatch(JSON.stringify(s.list),/\/tmp|\/home|sales\.csv|rag-p515-/);
});
test('P5.15 real project switch changes overview to new independently verified SKU/revenue',async t=>{
 const other=anotherProject(t),s=await start(t,other);
 const first=await (await fetch(s.url+'/api/overview',{headers:s.auth})).json();
 assert.equal(first.project_id,'synthetic-shop-001');
 assert.equal(first.dataset.revenue_krw,'157000');
 const key=s.list.projects[1].project_key;
 const response=await choose(s,key);
 assert.equal(response.status,200);
 const changed=await response.json();
 assert.equal(changed.status,'PROJECT_SELECTED');
 assert.equal(changed.selected,key);
 assert.equal(changed.overview.project_id,'synthetic-shop-002');
 assert.equal(changed.overview.dataset.revenue_krw,'158000');
 const live=await (await fetch(s.url+'/api/overview',{headers:s.auth})).json();
 assert.equal(live.dataset.revenue_krw,'158000');
 assert.equal(live.dataset.sku_totals.find(x=>x.sku==='N-02').revenue_krw,'73000');
 assert.equal((await (await fetch(s.url+'/api/projects',{headers:s.auth})).json()).selected,key);
 const back=await choose(s,s.list.projects[0].project_key);
 assert.equal(back.status,200);
 assert.equal((await back.json()).overview.dataset.revenue_krw,'157000');
});
test('P5.15 switching changes fixed SQLite and document question together',async t=>{
 const other=anotherProject(t),s=await start(t,other);
 const key=s.list.projects[1].project_key;
 assert.equal((await choose(s,key)).status,200);
 const response=await fetch(s.url+'/api/query',{method:'POST',headers:{...s.auth,'Content-Type':'application/json'},
 body:JSON.stringify({question:'총 매출과 반품 기간, 배송 준비 기간은?'})});
 assert.equal(response.status,200);
 const q=await response.json();
 assert.equal(q.status,'ANSWERED');
 assert.equal(q.metric_evidence.revenue_krw,'158000');
 assert.deepEqual(q.document_evidence.map(x=>x.period),[7,2]);
});
test('P5.15 unknown or spoofed local filesystem path is never selected',async t=>{
 const other=anotherProject(t),s=await start(t,other);
 const forged=await choose(s,'f'.repeat(32));
 assert.equal(forged.status,404);
 assert.equal((await forged.json()).error,'PROJECT_NOT_ALLOWLISTED');
 const pathTry=await choose(s,'',{body:JSON.stringify({path:other})});
 assert.equal(pathTry.status,400);
 assert.equal((await pathTry.json()).error,'INVALID_PROJECT_CHOICE');
 const intact=await (await fetch(s.url+'/api/overview',{headers:s.auth})).json();
 assert.equal(intact.project_id,'synthetic-shop-001');
 assert.doesNotMatch(JSON.stringify(await (await fetch(s.url+'/api/projects',{headers:s.auth})).json()),/rag-p515-/);
});
test('P5.15 unauthorized project listing and switching fail closed',async t=>{
 const other=anotherProject(t),s=await start(t,other);
 const list=await fetch(s.url+'/api/projects');
 assert.equal(list.status,401);
 const bad=await fetch(s.url+'/api/projects/select',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({project_key:s.list.projects[1].project_key})});
 assert.equal(bad.status,401);
 const originSpoof=await choose(s,s.list.projects[1].project_key,{headers:{Origin:'https://attacker.test'}});
 assert.equal(originSpoof.status,403);
 assert.equal((await (await fetch(s.url+'/api/overview',{headers:s.auth})).json()).project_id,'synthetic-shop-001');
});
test('P5.15 changed file after startup cannot be switched into, current project remains intact',async t=>{
 const other=anotherProject(t),s=await start(t,other);
 fs.appendFileSync(path.join(other,'shipping_policy.txt'),'tampered');
 const response=await choose(s,s.list.projects[1].project_key);
 assert.equal(response.status,422);
 assert.deepEqual(await response.json(),{error:'PROJECT_UNVERIFIED'});
 const current=await (await fetch(s.url+'/api/overview',{headers:s.auth})).json();
 assert.equal(current.project_id,'synthetic-shop-001');
});
test('P5.15 invalid or duplicate startup projects fail before server listen',t=>{
 const other=anotherProject(t);
 for(const roots of [[origin,origin],[],[origin,'does-not-exist'],Array.from({length:9},()=>origin)]){
   assert.throws(()=>createDashboardServer({packageRoot:origin,projectRoots:roots}));
 }
 assert.throws(()=>createDashboardServer({packageRoot:other,projectRoots:[origin,other]}));
});
test('P5.15 one-project legacy dashboard works and exposes only itself',async t=>{
 const server=createDashboardServer({packageRoot:origin});
 const url=await listenDashboard(server,0);
 t.after(()=>new Promise(done=>server.close(done)));
 const token=dashboardLaunchUrl(server).split('#session=')[1];
 const res=await fetch(url+'/api/projects',{headers:{Authorization:'Bearer '+token}});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.projects.length,1);
 assert.equal(data.projects[0].project_id,'synthetic-shop-001');
});
test('P5.15 project selection request is strict and bounded',async t=>{
 const other=anotherProject(t),s=await start(t,other);
 for(const [body,expected] of [
   ['{"project_key":',400],
   [JSON.stringify({project_key:s.list.projects[1].project_key,admin:true}),400],
   ['{}'.repeat(200),413],
   [JSON.stringify({project_key:s.list.projects[1].project_key}),415]
 ]){
   const res=await choose(s,'',{body,headers:expected===415?{'Content-Type':'text/plain'}:{}});
   assert.equal(res.status,expected);
 }
});
test('P5.15 workspace CLI starts with two explicitly selected synthetic projects',async t=>{
 const other=anotherProject(t);
 const child=spawn(process.execPath,['src/workspace-cli.mjs',origin,other],{cwd:repo,
  env:{...process.env,RAG_DASHBOARD_PORT:'0'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{
  if(child.exitCode===null){child.kill('SIGINT');await Promise.race([
    new Promise(done=>child.once('exit',done)),
    new Promise(done=>setTimeout(()=>{child.kill('SIGKILL');done();},1500))]);}
 });
 const address=await new Promise((resolve,reject)=>{
   let printed='';
   const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('WORKSPACE_START_TIMEOUT'));},10000);
   const output=piece=>{
     printed+=piece.toString();
     const match=printed.match(/http:\/\/127\.0\.0\.1:\d+\/#session=[A-Za-z0-9_-]{43}/);
     if(match){clearTimeout(timer);child.stdout.off('data',output);resolve(match[0]);}
   };
   child.stdout.on('data',output);
   child.once('exit',()=>{clearTimeout(timer);reject(Error('EARLY_CLI_EXIT'));});
 });
 const uri=new URL(address),auth={Authorization:'Bearer '+uri.hash.slice('#session='.length)};
 const data=await (await fetch(uri.origin+'/api/projects',{headers:auth})).json();
 assert.equal(data.projects.length,2);
 const res=await fetch(uri.origin+'/api/projects/select',{method:'POST',headers:{...auth,'Content-Type':'application/json'},
   body:JSON.stringify({project_key:data.projects[1].project_key})});
 assert.equal(res.status,200);
 assert.equal((await res.json()).overview.dataset.revenue_krw,'158000');
});
test('P5.15 invalid CLI arguments do not leak explicit user paths',()=>{
 const secretPath='/not-real-private-user-project-9274';
 const r=spawnSync(process.execPath,['src/workspace-cli.mjs',secretPath],{
  cwd:repo,encoding:'utf8',timeout:5000});
 assert.equal(r.status,1);
 assert.match(r.stderr,/RAG_WORKSPACE_BLOCKED: PROJECT_INVALID/);
 assert.equal((r.stdout+r.stderr).includes(secretPath),false);
});
