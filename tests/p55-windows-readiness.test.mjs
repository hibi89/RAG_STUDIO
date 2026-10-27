import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkWindowsDemoReadiness} from '../src/windows-readiness.mjs';
import {createDashboardServer,listenDashboard} from '../src/dashboard-server.mjs';
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const fixture=path.join(projectRoot,'fixtures/ax_multi_doc_v0');
test('P5.5 static local prerequisites use canonical synthetic source and keep release gates false',async()=>{
 const report=await checkWindowsDemoReadiness();
 assert.equal(report.contract,'rag.windows-demo-preflight.v1');
 assert.equal(report.required_files_present,report.required_files_total);
 assert.equal(report.node_supported,true);
 assert.equal(report.synthetic_package_validated,true);
 assert.equal(report.status,process.platform==='win32'?'WINDOWS_DEMO_PREFLIGHT_PASS':'WINDOWS_HOST_NOT_TESTED');
 for(const key of ['network_download_required','admin_required','ready_for_customer_data',
   'windows_browser_verified','installer_verified'])assert.equal(report[key],false);
 assert.ok(!JSON.stringify(report).includes(projectRoot));
});
test('P5.5 unsupported Node is a hard block regardless of host platform',async()=>{
 const report=await checkWindowsDemoReadiness({nodeVersion:'22.15.99'});
 assert.equal(report.status,'BLOCKED_NODE');
 assert.equal(report.node_supported,false);
 assert.equal(report.ready_for_customer_data,false);
});
test('P5.5 missing/incorrect project root cannot pass prerequisite check',async()=>{
 for(const project of ['',path.join(os.tmpdir(),'rag-project-missing-1234')]){
  const result=await checkWindowsDemoReadiness({projectRoot:project});
  assert.ok(result.status.startsWith('BLOCKED_'));
  assert.notEqual(result.status,'WINDOWS_DEMO_PREFLIGHT_PASS');
 }
});
test('P5.5 even a coherently rewritten local manifest and CSV cannot impersonate canonical demo',async t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rag-win-static-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 fs.cpSync(projectRoot,tmp,{recursive:true,force:true,filter:src=>!path.basename(src).startsWith('.git')});
 const source=path.join(tmp,'fixtures/ax_multi_doc_v0/sales.csv');
 const bytes=Buffer.from(fs.readFileSync(source));
 bytes[bytes.length-3]=bytes[bytes.length-3]===49?50:49;
 fs.writeFileSync(source,bytes);
 const mf=path.join(tmp,'fixtures/ax_multi_doc_v0/manifest.json');
 const m=JSON.parse(fs.readFileSync(mf,'utf8'));
 const f=m.files.find(x=>x.relative_path==='sales.csv');
 f.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(mf,JSON.stringify(m,null,2)+'\n');
 const result=await checkWindowsDemoReadiness({projectRoot:tmp});
 assert.equal(result.status,'BLOCKED_SYNTHETIC_SOURCE');
 assert.equal(result.synthetic_package_validated,false);
});
test('P5.5 Windows batch launcher never downloads or installs and accepts no input file argument',()=>{
 const script=fs.readFileSync(path.join(projectRoot,'RUN_SYNTHETIC_WINDOWS.cmd'),'utf8');
 assert.match(script,/setlocal DisableDelayedExpansion/);
 assert.match(script,/if not "%~1"==""/);
 assert.match(script,/pushd "%~dp0"/);
 assert.match(script,/where node/);
 assert.match(script,/node "scripts\\windows-preflight\.mjs"/);
 assert.match(script,/node "src\\dashboard-cli\.mjs" "fixtures\\ax_multi_doc_v0"/);
 assert.doesNotMatch(script,/npm install|curl|Invoke-WebRequest|bitsadmin|start http|powershell|winget|choco|net use/i);
});
test('P5.5 native CLI exits nonzero when not running on actual Windows',()=>{
 const run=spawnSync(process.execPath,['scripts/windows-preflight.mjs'],{cwd:projectRoot,encoding:'utf8',timeout:10000});
 const out=JSON.parse(run.stdout);
 assert.equal(out.run_platform,process.platform);
 assert.equal(out.status,process.platform==='win32'?'WINDOWS_DEMO_PREFLIGHT_PASS':'WINDOWS_HOST_NOT_TESTED');
 assert.equal(run.status,process.platform==='win32'?0:1);
});
test('P5.5 trusted synthetic dashboard actually binds loopback and refuses unauthenticated requests',async t=>{
 const server=createDashboardServer({packageRoot:fixture});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const address=await listenDashboard(server,0);
 assert.match(address,/^http:\/\/127\.0\.0\.1:\d+$/);
 const health=await fetch(address+'/api/health');
 assert.equal(health.status,200);
 assert.equal((await health.json()).scope,'loopback_only');
 const denied=await fetch(address+'/api/overview');
 assert.equal(denied.status,401);
 const forged=await fetch(address+'/api/health',{headers:{host:'invalid.example'}});
 assert.equal(forged.status,403);
});
