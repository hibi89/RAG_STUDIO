import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {openLocalTextPreview} from '../src/local-text-workspace.mjs';
import {loadPackage} from '../src/validate.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {routeQuestion} from '../src/evidence-router.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const base=path.join(repo,'fixtures/ax_multi_doc_v0');
function selected(t,content,ext='.txt'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p527-input-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'private-example'+ext);
 fs.writeFileSync(file,content);
 return file;
}
test('P5.27 chosen UTF-8 TXT is locally searchable with exact source line and unchanged revenue',t=>{
 const file=selected(t,'새 장비 수리 접수는 화요일 오후 2시까지 받습니다.\n');
 const bytes=fs.readFileSync(file),originalSales=fs.readFileSync(path.join(base,'sales.csv'));
 const workspace=openLocalTextPreview(base,[file]);t.after(()=>workspace.cleanup());
 assert.equal(workspace.added_documents,1);
 assert.equal(workspace.source_rights_verified,false);
 assert.equal(workspace.smax_native_approved,false);
 const pkg=loadPackage(workspace.root);
 assert.equal(pkg.manifest.documents.length,3);
 assert.equal(pkg.manifest.processing_summary.accepted,4);
 const r=searchDocuments(workspace.root,'장비 수리 접수 화요일');
 assert.equal(r.status,'FOUND');
 const evidence=r.evidence.find(x=>x.document_id===workspace.document_ids[0]);
 assert.ok(evidence);assert.equal(evidence.line,1);
 assert.match(evidence.quote,/화요일 오후 2시/);
 assert.equal(routeQuestion(workspace.root,'총 매출 알려줘').metric_evidence.revenue_krw,'157000');
 assert.deepEqual(fs.readFileSync(file),bytes);
 assert.deepEqual(fs.readFileSync(path.join(base,'sales.csv')),originalSales);
 workspace.cleanup();workspace.cleanup();
 assert.equal(fs.existsSync(workspace.root),false);
});
test('P5.27 multiple explicitly selected MD/TXT files preserve separate citations',t=>{
 const a=selected(t,'# 수리 정책\n기기 교체는 월요일 가능합니다.','.md');
 const b=selected(t,'보증 수리는 수요일 접수합니다.','.txt');
 const w=openLocalTextPreview(base,[a,b]);t.after(()=>w.cleanup());
 assert.equal(w.added_documents,2);
 assert.equal(new Set(w.document_ids).size,2);
 const r=searchDocuments(w.root,'보증 수리 수요일',{limit:10});
 assert.ok(r.evidence.some(e=>e.document_id===w.document_ids[1]&&e.quote.includes('수요일')));
 const pkg=loadPackage(w.root);
 assert.equal(pkg.manifest.documents.length,4);
 assert.ok(pkg.manifest.documents.every(d=>!d.source_title.includes('private-example')));
});
test('P5.27 malicious controls, invalid UTF-8, malformed extensions and huge lines fail closed',t=>{
 for(const [data,ext] of [
  [Buffer.from([0xff,0xfe]),'.txt'],['hi\u0000world','.md'],['\u0007alert','.txt'],
  ['a'.repeat(4097),'.txt'],['x\n'.repeat(500),'.txt'],
  ['secret','.exe'],['   ','.md']
 ]){
  const file=selected(t,data,ext);
  assert.throws(()=>openLocalTextPreview(base,[file]),/Local text preview refused/);
 }
});
test('P5.27 limits to 4 files, enforces explicit distinct inputs and ready base package',t=>{
 const file=selected(t,'hello source.');
 assert.throws(()=>openLocalTextPreview(base,[]),/Local text preview refused/);
 assert.throws(()=>openLocalTextPreview(base,Array(5).fill(file)),/Local text preview refused/);
 assert.throws(()=>openLocalTextPreview(base,[file,file]),/Local text preview refused/);
 assert.throws(()=>openLocalTextPreview('relative',[file]),/Local text preview refused/);
});
test('P5.27 symlink input forbidden and no derived workspace created',t=>{
 const file=selected(t,'target');
 const alias=file+'.md';
 try{fs.symlinkSync(file,alias);}catch(e){t.skip('Symlink unsupported: '+e.code);return;}
 assert.throws(()=>openLocalTextPreview(base,[alias]),/Local text preview refused/);
});
test('P5.27 tampered original AX CSV aborts without approving a derived project',t=>{
 const file=selected(t,'local policy');
 const copy=fs.mkdtempSync(path.join(os.tmpdir(),'p527-base-'));
 t.after(()=>fs.rmSync(copy,{recursive:true,force:true}));
 fs.cpSync(base,copy,{recursive:true});
 fs.appendFileSync(path.join(copy,'sales.csv'),'tamper');
 assert.throws(()=>openLocalTextPreview(copy,[file]),/sha256|mismatch/);
});
test('P5.27 CLI rejected inputs never leak private source path',t=>{
 const file=selected(t,'abc','.exe');
 const processResult=spawnSync(process.execPath,['src/local-text-cli.mjs',base,file],{
  cwd:repo,encoding:'utf8',timeout:10000});
 assert.equal(processResult.status,1);
 assert.match(processResult.stderr,/LOCAL_TEXT_PREVIEW_BLOCKED/);
 assert.doesNotMatch(processResult.stdout+processResult.stderr,/private-example|p527-input-/);
});
test('P5.27 actual authenticated localhost HTTP returns selected local cited TXT with no unauthenticated leak',async t=>{
 const file=selected(t,'수리 전용 접수 코드는 ZX527이며, 오후 두 시 마감입니다.\n');
 const child=spawn(process.execPath,['src/local-text-cli.mjs',base,file],{
   cwd:repo,env:{...process.env,RAG_DASHBOARD_PORT:'0'},
   stdio:['ignore','pipe','pipe']});
 t.after(async()=>{
  if(child.exitCode===null){child.kill('SIGINT');await Promise.race([
    new Promise(done=>child.once('exit',done)),
    new Promise(done=>setTimeout(()=>{child.kill('SIGKILL');done();},1800))
  ]);}
 });
 const link=await new Promise((resolve,reject)=>{
  let printed='';
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('P527_START_TIMEOUT'));},12000);
  const handler=data=>{
   printed+=data.toString('utf8');
   if(printed.length>8192){clearTimeout(timer);reject(Error('P527_OUTPUT_UNBOUNDED'));return;}
   const match=printed.match(/http:\/\/127\.0\.0\.1:\d+\/#session=[A-Za-z0-9_-]{43}/);
   if(match){clearTimeout(timer);child.stdout.off('data',handler);resolve(match[0]);}
  };
  child.stdout.on('data',handler);
  child.once('exit',()=>{clearTimeout(timer);reject(Error('P527_CHILD_EARLY_EXIT'));});
 });
 const url=new URL(link);
 assert.equal((await fetch(url.origin+'/api/overview')).status,401);
 const auth={Authorization:'Bearer '+url.hash.slice('#session='.length)};
 const req=await fetch(url.origin+'/api/search',{
  method:'POST',headers:{...auth,'Content-Type':'application/json'},
  body:JSON.stringify({question:'수리 전용 접수 코드는 무엇인가?'})
 });
 assert.equal(req.status,200);
 const result=await req.json();
 assert.equal(result.status,'FOUND');
 assert.ok(result.evidence.some(x=>x.quote.includes('ZX527')&&x.line===1));
 assert.doesNotMatch(JSON.stringify(result),/private-example|p527-input-/);
});
