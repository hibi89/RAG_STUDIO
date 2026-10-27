import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadPackage} from '../src/validate.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {routeQuestion} from '../src/evidence-router.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';

const project=fileURLToPath(new URL('../',import.meta.url));
const fixture=path.join(project,'fixtures/ax_multi_doc_v0');
const markdown='# 합성 운영 지침\n\n**배송 준비 시작:** 주문 확인 뒤 2영업일 이내 시작합니다.\n**반품 신청 가능 기간:** 수령 후 7일 이내입니다.\n## 장비 점검\n정비 부품은 사용 전 안전 점검이 필요합니다.\n';
function makeProject(t,{filename='guide.md',needsReview=false,disableTxtShipping=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p511-'));
  fs.cpSync(fixture,root,{recursive:true});
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const data=Buffer.from(markdown,'utf8');
  fs.writeFileSync(path.join(root,filename),data);
  const mpath=path.join(root,'manifest.json');
  const mf=JSON.parse(fs.readFileSync(mpath,'utf8'));
  mf.files.push({file_id:'file-markdown',relative_path:filename,kind:'document',
    sha256:crypto.createHash('sha256').update(data).digest('hex'),size_bytes:data.length,
    import_status:needsReview?'NEEDS_REVIEW':'ACCEPTED'});
  mf.documents.push({document_id:'document-markdown',file_id:'file-markdown',language:'ko',
    source_title:'합성 Markdown 업무 지침',page_info:'lines:1-6',index_status:'NOT_INDEXED'});
  mf.processing_summary[needsReview?'needs_review':'accepted']++;
  if(disableTxtShipping){
    const shipping=mf.files.find(x=>x.file_id==='file-shipping');
    shipping.import_status='NEEDS_REVIEW';
    mf.processing_summary.accepted--;
    mf.processing_summary.needs_review++;
  }
  fs.writeFileSync(mpath,JSON.stringify(mf,null,2)+'\n');
  return root;
}
test('P5.11 verified Markdown appears as a searchable document without altering TXT',t=>{
  const root=makeProject(t);
  const pkg=loadPackage(root);
  assert.equal(pkg.manifest.documents.length,3);
  const result=searchDocuments(root,'정비 부품 안전 점검',{limit:10});
  assert.equal(result.status,'FOUND');
  const evidence=result.evidence.find(e=>e.file_id==='file-markdown');
  assert.ok(evidence);
  assert.equal(evidence.line,6);
  assert.match(evidence.quote,/안전 점검/);
  assert.equal(result.search_mode,'bm25_line_ngrams');
});
test('P5.11 uppercase MD suffix is supported with exact source lines',t=>{
  const root=makeProject(t,{filename:'guide.MD'});
  const answer=searchDocuments(root,'정비 부품 안전 점검');
  assert.equal(answer.status,'FOUND');
  assert.equal(answer.evidence[0].document_id,'document-markdown');
  assert.equal(answer.evidence[0].line,6);
});
test('P5.11 mixed SQL + Markdown citations are returned from verified local package',t=>{
  const root=makeProject(t,{disableTxtShipping:true});
  const result=routeQuestion(root,'총 매출과 반품 기간, 배송 준비 기간은?');
  assert.equal(result.status,'ANSWERED');
  assert.equal(result.kind,'SQL_DOCUMENT');
  assert.equal(result.metric_evidence.revenue_krw,'157000');
  assert.ok(result.document_evidence.some(x=>x.document_id==='document-markdown'&&x.period===2));
  assert.ok(result.document_evidence.every(e=>Number.isSafeInteger(e.line)&&e.line>0));
});
test('P5.11 unapproved Markdown is never retrieved',t=>{
  const root=makeProject(t,{needsReview:true});
  const result=searchDocuments(root,'정비 부품 안전 점검',{limit:10});
  assert.ok(result.evidence.every(e=>e.file_id!=='file-markdown'));
});
test('P5.11 edited Markdown bytes fail SHA-256 integrity check',t=>{
  const root=makeProject(t);
  fs.appendFileSync(path.join(root,'guide.md'),'변조');
  assert.throws(()=>searchDocuments(root,'안전 점검'),/size|sha256/);
  assert.throws(()=>routeQuestion(root,'반품 기간'),/size|sha256/);
});
test('P5.11 source HTML in Markdown remains a quote, never executed',t=>{
  const root=makeProject(t);
  const target=path.join(root,'guide.md');
  const contents=fs.readFileSync(target,'utf8')+'\n<script>alert(1)</script> 점검 문구는 데이터입니다.\n';
  fs.writeFileSync(target,contents);
  const manifestPath=path.join(root,'manifest.json');
  const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const f=m.files.find(x=>x.file_id==='file-markdown');
  f.size_bytes=Buffer.byteLength(contents);f.sha256=crypto.createHash('sha256').update(contents).digest('hex');
  fs.writeFileSync(manifestPath,JSON.stringify(m));
  const result=searchDocuments(root,'점검 문구',{limit:10});
  assert.equal(result.status,'FOUND');
  assert.ok(result.evidence.some(e=>e.quote.includes('<script>alert(1)</script>')));
  const ui=fs.readFileSync(path.join(project,'ui/app.js'),'utf8');
  assert.doesNotMatch(ui,/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function\(/);
});
test('P5.11 local dashboard search works through authenticated HTTP',async t=>{
  const root=makeProject(t);
  const server=createDashboardServer({packageRoot:root});
  const address=await listenDashboard(server,0);
  t.after(()=>new Promise(done=>server.close(done)));
  const token=dashboardLaunchUrl(server).split('#session=')[1];
  const denied=await fetch(address+'/api/search',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({question:'안전 점검'})});
  assert.equal(denied.status,401);
  const res=await fetch(address+'/api/search',{method:'POST',headers:{Authorization:'Bearer '+token,
    'Content-Type':'application/json'},body:JSON.stringify({question:'정비 부품 안전 점검'})});
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.status,'FOUND');
  assert.ok(data.evidence.some(e=>e.document_id==='document-markdown'&&e.line===6));
});
test('P5.11 without local path the folder preview CLI fails closed',()=>{
  const out=spawnSync(process.execPath,['src/local-package-cli.mjs'],{cwd:project,encoding:'utf8',timeout:5000});
  assert.equal(out.status,1);
  assert.match(out.stderr,/LOCAL_FOLDER_PREVIEW_BLOCKED: INPUT_REQUIRED/);
  assert.doesNotMatch(out.stdout,/session=/);
});
test('P5.11 nonexistent path prints fixed error and no local path',()=>{
  const fake=path.join(os.tmpdir(),'RAG-SENSITIVE-NO-SUCH-FOLDER');
  const out=spawnSync(process.execPath,['src/local-package-cli.mjs',fake],{cwd:project,encoding:'utf8',timeout:5000});
  assert.equal(out.status,1);
  assert.match(out.stderr,/LOCAL_FOLDER_PREVIEW_BLOCKED: PACKAGE_OR_PORT_INVALID/);
  assert.equal((out.stdout+out.stderr).includes(fake),false);
});
test('P5.11 local folder preview executes as a real CLI against synthetic temp package',async t=>{
  const root=makeProject(t);
  const child=spawn(process.execPath,['src/local-package-cli.mjs',root],{
    cwd:project,env:{...process.env,RAG_DASHBOARD_PORT:'0'},stdio:['ignore','pipe','pipe']});
  const timeout=setTimeout(()=>child.kill('SIGKILL'),8000);
  t.after(async()=>{clearTimeout(timeout);if(child.exitCode===null){child.kill('SIGINT');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),
      new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},1000))]);}});
  const launch=await new Promise((resolve,reject)=>{
    let buffer='';
    const onData=chunk=>{
      buffer+=chunk.toString();
      if(buffer.length>8192){reject(Error('launch output too large'));return;}
      const match=buffer.match(/http:\/\/127\.0\.0\.1:\d+\/#session=[A-Za-z0-9_-]{43}/);
      if(match){child.stdout.off('data',onData);resolve(match[0]);}
    };
    child.stdout.on('data',onData);
    child.once('exit',()=>reject(Error('CLI closed before launch')));
  });
  const url=new URL(launch);
  assert.equal((await fetch(url.origin+'/api/overview')).status,401);
  const auth={Authorization:'Bearer '+url.hash.slice('#session='.length)};
  const overview=await fetch(url.origin+'/api/overview',{headers:auth});
  assert.equal(overview.status,200);
  assert.equal((await overview.json()).dataset.revenue_krw,'157000');
  const res=await fetch(url.origin+'/api/search',{method:'POST',
    headers:{...auth,'Content-Type':'application/json'},
    body:JSON.stringify({question:'정비 부품 안전 점검'})});
  assert.equal(res.status,200);
  assert.ok((await res.json()).evidence.some(x=>x.file_id==='file-markdown'));
});
test('P5.11 local folder opens existing package without mutating synthetic input files',()=>{
  const original=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
  const before=original.map(name=>fs.readFileSync(path.join(fixture,name)));
  const out=spawnSync(process.execPath,['src/local-package-cli.mjs',fixture,'EXTRA'],{cwd:project,
    encoding:'utf8',timeout:5000});
  assert.equal(out.status,1);
  assert.deepEqual(original.map(name=>fs.readFileSync(path.join(fixture,name))),before);
});
