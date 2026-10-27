/** P5.6 public synthetic only. Network probes bind local IPv4; no external requests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkWindowsDemoReadiness} from '../src/windows-readiness.mjs';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
function copySyntheticRepo(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p56-synthetic-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.cpSync(projectRoot,root,{recursive:true,force:true,filter:src=>path.basename(src)!=='.git'});
 return root;
}
async function occupyLoopback(t){
 const server=net.createServer();
 await new Promise((resolve,reject)=>{
   server.once('error',reject);
   server.listen(0,'127.0.0.1',()=>{
     server.off('error',reject);resolve();
   });
 });
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 return server.address().port;
}
test('P5.6 actual occupied local port blocks before a Windows-ready claim',async t=>{
 const port=await occupyLoopback(t);
 const result=await checkWindowsDemoReadiness({port});
 assert.equal(result.status,'BLOCKED_PORT_UNAVAILABLE');
 assert.equal(result.port_available,false);
 assert.equal(result.synthetic_package_validated,true);
 assert.equal(result.ready_for_customer_data,false);
 assert.equal(result.windows_browser_verified,false);
});
test('P5.6 missing UI asset blocks with no path/content leakage',async t=>{
 const root=copySyntheticRepo(t);
 fs.rmSync(path.join(root,'ui/app.js'));
 const result=await checkWindowsDemoReadiness({projectRoot:root});
 assert.equal(result.status,'BLOCKED_REQUIRED_FILES');
 assert.equal(result.required_files_present,result.required_files_total-1);
 assert.equal(result.port_available,null);
 const serialized=JSON.stringify(result);
 assert.equal(serialized.includes(root),false);
 assert.equal(serialized.includes('app.js'),false);
});
test('P5.6 symlinked required asset cannot pass file prerequisite validation',async t=>{
 const root=copySyntheticRepo(t);
 const p=path.join(root,'ui/app.js');
 const source=fs.readFileSync(p);
 fs.rmSync(p);
 try{fs.symlinkSync(path.join(projectRoot,'ui/app.js'),p);}
 catch(e){
   if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('symlink creation not available');return;}
   throw e;
 }
 const result=await checkWindowsDemoReadiness({projectRoot:root});
 assert.equal(result.status,'BLOCKED_REQUIRED_FILES');
 assert.equal(result.required_files_present,result.required_files_total-1);
 assert.ok(source.length>0);
});
test('P5.6 modified synthetic document with matching forged manifest hash remains blocked',async t=>{
 const root=copySyntheticRepo(t);
 const dir=path.join(root,'fixtures/ax_multi_doc_v0');
 const f=path.join(dir,'returns_policy.txt');
 fs.appendFileSync(f,'\nSYNTHETIC_MUTATION_ONLY\n');
 const mf=path.join(dir,'manifest.json');
 const manifest=JSON.parse(fs.readFileSync(mf,'utf8'));
 const item=manifest.files.find(x=>x.relative_path==='returns_policy.txt');
 item.sha256=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 item.size_bytes=fs.statSync(f).size;
 fs.writeFileSync(mf,JSON.stringify(manifest,null,2)+'\n');
 const report=await checkWindowsDemoReadiness({projectRoot:root});
 assert.equal(report.status,'BLOCKED_SYNTHETIC_SOURCE');
 assert.equal(report.synthetic_package_validated,false);
 assert.equal(report.port_available,null);
});
test('P5.6 actual dashboard CLI bind conflict fails closed without printing a session URL',async t=>{
 const port=await occupyLoopback(t);
 const processResult=spawnSync(process.execPath,['src/dashboard-cli.mjs','fixtures/ax_multi_doc_v0'],{
   cwd:projectRoot,env:{...process.env,RAG_DASHBOARD_PORT:String(port)},
   encoding:'utf8',timeout:10000
 });
 assert.equal(processResult.status,1);
 assert.match(processResult.stderr,/Dashboard startup blocked: loopback port already in use/);
 assert.doesNotMatch(processResult.stdout,/session=|http:\/\/127\.0\.0\.1/);
 assert.doesNotMatch(processResult.stderr,/fixtures\/|fixture\\/|session=/);
});
test('P5.6 invalid port cannot be treated as a successful Windows prerequisite',async()=>{
 for(const port of [0,65536,-1,NaN,'8765',null]){
   const r=await checkWindowsDemoReadiness({port});
   assert.equal(r.status,'BLOCKED_INVALID_PORT');
   assert.equal(r.ready_for_customer_data,false);
 }
});
test('P5.6 launcher pins expected port and never accepts path or custom port arguments',()=>{
 const cmd=fs.readFileSync(path.join(projectRoot,'RUN_SYNTHETIC_WINDOWS.cmd'),'utf8');
 assert.match(cmd,/if not "%~1"==""/);
 assert.match(cmd,/set "RAG_DASHBOARD_PORT=8765"/);
 assert.ok(cmd.indexOf('set "RAG_DASHBOARD_PORT=8765"')<cmd.indexOf('node "scripts\\windows-preflight.mjs"'));
 assert.match(cmd,/node "src\\dashboard-cli\.mjs" "fixtures\\ax_multi_doc_v0"/);
 assert.doesNotMatch(cmd,/%~2|%2|--input|--output|--packageRoot|curl|Invoke-WebRequest|npm install/i);
});
