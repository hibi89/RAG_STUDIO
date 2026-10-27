import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pdfFixture,docxFixture} from './native-document-fixtures.mjs';
import {openNativeDocumentCollectionPreview} from '../src/native-document-collection.mjs';
import {loadPackage} from '../src/validate.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {knowledgeSearch} from '../src/knowledge-base.mjs';
import {routeQuestion} from '../src/evidence-router.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';

const REPO=fileURLToPath(new URL('../',import.meta.url));
const ROOT=path.join(REPO,'fixtures/ax_multi_doc_v0');
function prepare(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p540-native-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const pdf=path.join(dir,'secret-local.pdf'),docx=path.join(dir,'secret-local.docx');
 fs.writeFileSync(pdf,pdfFixture());
 fs.writeFileSync(docx,docxFixture());
 return {dir,pdf,docx};
}
test('P5.40 real PDF+DOCX form one verified searchable corpus with distinct source units',async t=>{
 const {pdf,docx}=prepare(t);
 const before=[fs.readFileSync(pdf),fs.readFileSync(docx),
   fs.readFileSync(path.join(ROOT,'sales.csv'))];
 const work=await openNativeDocumentCollectionPreview(ROOT,[pdf,docx]);
 t.after(()=>work.cleanup());
 assert.equal(work.added_documents,2);
 assert.deepEqual(work.documents.map(x=>[x.kind,x.units,x.citation_unit]),
   [['pdf',2,'page'],['docx',2,'paragraph']]);
 assert.equal(work.source_rights_verified,false);
 assert.equal(work.customer_data_certified,false);
 assert.equal(work.remote_upload,false);
 const pkg=loadPackage(work.root);
 assert.equal(pkg.manifest.documents.length,4);
 assert.equal(pkg.manifest.processing_summary.accepted,5);
 const search=searchDocuments(work.root,'Product returns within 7 days 안전 점검 대상 부품',{limit:10});
 assert.equal(search.status,'FOUND');
 assert.ok(search.evidence.some(e=>e.file_id===work.documents[0].file_id&&
   e.quote.includes('[PDF page 1]')&&e.line===1));
 assert.ok(search.evidence.some(e=>e.file_id===work.documents[1].file_id&&
   e.quote.includes('[DOCX paragraph 2]')&&e.line===2));
 assert.equal(routeQuestion(work.root,'총 매출 알려줘').metric_evidence.revenue_krw,'157000');
 assert.deepEqual(fs.readFileSync(pdf),before[0]);
 assert.deepEqual(fs.readFileSync(docx),before[1]);
 assert.deepEqual(fs.readFileSync(path.join(ROOT,'sales.csv')),before[2]);
});
test('P5.40 selected knowledge collection isolates native PDF from DOCX',async t=>{
 const {pdf,docx}=prepare(t);
 const work=await openNativeDocumentCollectionPreview(ROOT,[pdf,docx]);
 t.after(()=>work.cleanup());
 const a=knowledgeSearch(work.root,[work.documents[0].document_id],'Product returns within 7 days');
 assert.equal(a.status,'FOUND');
 assert.ok(a.evidence.length>0);
 assert.ok(a.evidence.every(x=>x.document_id===work.documents[0].document_id));
 const b=knowledgeSearch(work.root,[work.documents[1].document_id],'안전 점검 대상 부품');
 assert.equal(b.status,'FOUND');
 assert.ok(b.evidence.every(x=>x.document_id===work.documents[1].document_id));
 assert.doesNotMatch(JSON.stringify(a)+JSON.stringify(b),/secret-local|p540-native-/);
});
test('P5.40 rejects out-of-budget and duplicate explicit file lists',async t=>{
 const s=prepare(t);
 for(const selected of [[],[s.pdf],Array(5).fill(s.pdf),[s.pdf,s.pdf]]){
  await assert.rejects(()=>openNativeDocumentCollectionPreview(ROOT,selected),
    {code:selected.length===0||selected.length===1||selected.length===5?
      'NATIVE_COLLECTION_FILE_COUNT':'NATIVE_COLLECTION_DUPLICATE_SELECTION'});
 }
 await assert.rejects(()=>openNativeDocumentCollectionPreview(ROOT,[s.pdf,path.join(s.dir,'missing.pdf')]),
   {code:'NATIVE_COLLECTION_INVALID_OR_CHANGED_INPUT'});
 await assert.rejects(()=>openNativeDocumentCollectionPreview(ROOT,[s.pdf,path.join(s.dir,'sneaky.txt')]),
   {code:'NATIVE_COLLECTION_UNSUPPORTED_FILE_KIND'});
});
test('P5.40 hardlinked source alias never passes as two separate documents',async t=>{
 const s=prepare(t),alias=path.join(s.dir,'alias.pdf');
 try{fs.linkSync(s.pdf,alias);}catch(e){t.skip('hardlink unavailable: '+e.code);return;}
 await assert.rejects(()=>openNativeDocumentCollectionPreview(ROOT,[s.pdf,alias]),
  {code:'NATIVE_COLLECTION_ALIAS_SELECTION'});
});
test('P5.40 symlink path component refuses selected originals',async t=>{
 const s=prepare(t),link=path.join(s.dir,'source-linked');
 try{fs.symlinkSync(s.dir,link,'dir');}catch(e){t.skip('symlink unavailable: '+e.code);return;}
 await assert.rejects(()=>openNativeDocumentCollectionPreview(ROOT,[path.join(link,'secret-local.pdf'),s.docx]),
  {code:'NATIVE_COLLECTION_INVALID_OR_CHANGED_INPUT'});
});
test('P5.40 an unextractable PDF refuses entire batch, no successful derived project',async t=>{
 const s=prepare(t);
 const empty=path.join(s.dir,'empty.pdf');
 fs.writeFileSync(empty,pdfFixture(['']));
 const orig=fs.readFileSync(s.docx);
 await assert.rejects(()=>openNativeDocumentCollectionPreview(ROOT,[s.docx,empty]),
  {code:'NATIVE_DOC_NO_EXTRACTABLE_TEXT'});
 assert.deepEqual(fs.readFileSync(s.docx),orig);
 assert.deepEqual(fs.readdirSync(s.dir).sort(),['empty.pdf','secret-local.docx','secret-local.pdf'].sort());
});
test('P5.40 source package under review is denied before creating native previews',async t=>{
 const s=prepare(t);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'p540-ax-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 fs.cpSync(ROOT,tmp,{recursive:true});
 const mp=path.join(tmp,'manifest.json'),m=JSON.parse(fs.readFileSync(mp,'utf8'));
 m.files.find(x=>x.file_id==='file-sales').import_status='NEEDS_REVIEW';
 m.processing_summary.accepted--;m.processing_summary.needs_review++;
 fs.writeFileSync(mp,JSON.stringify(m));
 await assert.rejects(()=>openNativeDocumentCollectionPreview(tmp,[s.pdf,s.docx]),
  {code:'NATIVE_COLLECTION_UNREADY_PACKAGE'});
});
test('P5.40 actual localhost authenticated API searches both formats and preserves source IDs',async t=>{
 const {pdf,docx}=prepare(t);
 const work=await openNativeDocumentCollectionPreview(ROOT,[pdf,docx]);
 t.after(()=>work.cleanup());
 const server=createDashboardServer({packageRoot:work.root});
 const base=await listenDashboard(server,0);
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const token=dashboardLaunchUrl(server).split('#session=')[1];
 const input=JSON.stringify({question:'Product returns within 7 days 안전 점검 대상 부품'});
 const request=async(headers={})=>fetch(base+'/api/search',{method:'POST',
  headers:{'Content-Type':'application/json',...headers},body:input});
 assert.equal((await request()).status,401);
 const reply=await request({Authorization:'Bearer '+token});
 assert.equal(reply.status,200);
 const data=await reply.json();
 assert.equal(data.status,'FOUND');
 assert.ok(data.evidence.some(x=>x.file_id===work.documents[0].file_id&&
  x.quote.includes('[PDF page 1]')));
 assert.ok(data.evidence.some(x=>x.file_id===work.documents[1].file_id&&
  x.quote.includes('[DOCX paragraph 2]')));
 const responseText=JSON.stringify(data);
 assert.doesNotMatch(responseText,/secret-local|p540-native-/);
});
test('P5.40 legacy one-document CLI still rejects an empty invocation',()=>{
 const r=spawnSync(process.execPath,['src/native-document-cli.mjs'],{
  cwd:REPO,encoding:'utf8',timeout:12000});
 assert.equal(r.status,1);
 assert.match(r.stderr,/LOCAL_DOCUMENT_PREVIEW_BLOCKED/);
 assert.doesNotMatch(r.stdout,/session=/);
});
test('P5.40 real child process accepts 2 native files and serves private session',async t=>{
 const {pdf,docx}=prepare(t);
 const child=spawn(process.execPath,['src/native-document-cli.mjs',ROOT,pdf,docx],{
  cwd:REPO,env:{...process.env,RAG_DASHBOARD_PORT:'0'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{
  if(child.exitCode===null){
   child.kill('SIGINT');
   await Promise.race([
    new Promise(resolve=>child.once('exit',resolve)),
    new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},1800))
   ]);
  }
 });
 const link=await new Promise((resolve,reject)=>{
  let output='',done=false;
  const timer=setTimeout(()=>{if(!done){done=true;child.kill('SIGKILL');
    reject(Error('COLLECTION_LAUNCH_TIMEOUT'));}},16000);
  child.stdout.on('data',c=>{
   output+=c.toString('utf8');
   if(output.length>8192&&!done){done=true;clearTimeout(timer);reject(Error('LEAKY_LAUNCH'));return;}
   const found=output.match(/http:\/\/127\.0\.0\.1:\d+\/#session=[A-Za-z0-9_-]{43}/);
   if(found&&!done){done=true;clearTimeout(timer);resolve(found[0]);}
  });
  child.once('exit',()=>{if(!done){done=true;clearTimeout(timer);reject(Error('EARLY_CLI_EXIT'));}});
 });
 const url=new URL(link),headers={Authorization:'Bearer '+url.hash.slice('#session='.length)};
 const req=await fetch(url.origin+'/api/search',{method:'POST',
  headers:{...headers,'Content-Type':'application/json'},
  body:JSON.stringify({question:'안전 점검 대상 부품'})});
 assert.equal(req.status,200);
 const result=await req.json();
 assert.equal(result.status,'FOUND');
 assert.ok(result.evidence.some(e=>e.quote.includes('[DOCX paragraph 2]')));
});
