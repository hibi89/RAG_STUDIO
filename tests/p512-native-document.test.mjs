import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {pdfFixture,docxFixture} from './native-document-fixtures.mjs';
import {extractLocalDocument} from '../src/native-document-extract.mjs';
import {openNativeDocumentPreview} from '../src/native-document-workspace.mjs';
import {loadPackage} from '../src/validate.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {routeQuestion} from '../src/evidence-router.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const base=path.join(repo,'fixtures/ax_multi_doc_v0');
function local(t,suffix,bytes){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rag-native-test-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const p=path.join(dir,'sample.'+suffix);
 fs.writeFileSync(p,bytes);
 return p;
}
test('P5.12 actual two-page PDF text yields genuine page markers',async()=>{
 const r=await extractLocalDocument(pdfFixture(),'pdf');
 assert.equal(r.kind,'pdf');assert.equal(r.units,2);assert.equal(r.citation_unit,'page');
 assert.match(r.text,/\[PDF page 1\] Product returns within 7 days/);
 assert.match(r.text,/\[PDF page 2\] Shipping starts within 2 business days/);
 assert.equal(r.ocr_performed,false);assert.equal(r.source_rights_verified,false);
});
test('P5.12 actual OOXML DOCX includes Korean paragraph markers, never guessed pages',async()=>{
 const r=await extractLocalDocument(docxFixture(),'docx');
 assert.equal(r.kind,'docx');assert.equal(r.units,2);assert.equal(r.citation_unit,'paragraph');
 assert.match(r.text,/\[DOCX paragraph 1\] 반품 규정 7일 이내/);
 assert.match(r.text,/\[DOCX paragraph 2\] 안전 점검 대상 부품입니다/);
 assert.doesNotMatch(r.text,/DOCX page/);
});
test('P5.12 PDF local file creates verified disposable AX search project',async t=>{
 const doc=local(t,'pdf',pdfFixture());
 const work=await openNativeDocumentPreview(base,doc);
 t.after(()=>work.cleanup());
 assert.equal(work.local_only,true);
 assert.equal(work.customer_data_certified,false);
 assert.equal(work.source_rights_verified,false);
 const pkg=loadPackage(work.root);
 assert.equal(pkg.manifest.datasets.length,1);
 assert.equal(pkg.manifest.documents.length,3);
 assert.equal(pkg.manifest.processing_summary.accepted,4);
 const result=searchDocuments(work.root,'Product returns within 7 days',{limit:10});
 assert.equal(result.status,'FOUND');
 const citation=result.evidence.find(e=>e.file_id===work.derived_file_id);
 assert.ok(citation);assert.match(citation.quote,/\[PDF page 1\]/);assert.equal(citation.line,1);
 assert.equal(routeQuestion(work.root,'총 매출 알려줘').metric_evidence.revenue_krw,'157000');
});
test('P5.12 DOCX local file adds searchable original paragraphs to the same dashboard',async t=>{
 const doc=local(t,'docx',docxFixture());
 const work=await openNativeDocumentPreview(base,doc);t.after(()=>work.cleanup());
 const r=searchDocuments(work.root,'안전 점검 대상 부품');
 assert.equal(r.status,'FOUND');
 assert.ok(r.evidence.some(c=>c.file_id===work.derived_file_id&&c.quote.includes('[DOCX paragraph 2]')));
});
test('P5.12 preserves original PDF/DOCX and AX package bytes and removes only derived folder',async t=>{
 const d=local(t,'docx',docxFixture());
 const original=fs.readFileSync(d);
 const source=fs.readFileSync(path.join(base,'sales.csv'));
 const work=await openNativeDocumentPreview(base,d);
 assert.equal(fs.existsSync(work.root),true);
 work.cleanup();work.cleanup();
 assert.equal(fs.existsSync(work.root),false);
 assert.deepEqual(fs.readFileSync(d),original);
 assert.deepEqual(fs.readFileSync(path.join(base,'sales.csv')),source);
});
test('P5.12 no OCR claim for image-only/scanned PDF',async()=>{
 const empty=pdfFixture(['']);
 await assert.rejects(()=>extractLocalDocument(empty,'pdf'),{code:'NATIVE_DOC_NO_EXTRACTABLE_TEXT'});
});
test('P5.12 invalid native format rejected without silently importing as text',async()=>{
 await assert.rejects(()=>extractLocalDocument(Buffer.alloc(20),'pdf'),{code:'NATIVE_DOC_PDF_HEADER'});
 await assert.rejects(()=>extractLocalDocument(Buffer.alloc(20),'docx'),{code:'NATIVE_DOC_DOCX_ZIP_HEADER'});
 await assert.rejects(()=>extractLocalDocument(pdfFixture(),'exe'),{code:'NATIVE_DOC_UNSUPPORTED_FORMAT'});
});
test('P5.12 2MB input safety boundary prevents oversized source',async()=>{
 await assert.rejects(()=>extractLocalDocument(Buffer.alloc(2*1024*1024+1),'docx'),{code:'NATIVE_DOC_SIZE_OR_BUFFER'});
});
test('P5.12 source symlink forbidden before opening local input',async t=>{
 const d=local(t,'pdf',pdfFixture());
 const link=d+'.link.pdf';
 try{fs.symlinkSync(d,link);}catch(e){t.skip('symlink unsupported: '+e.code);return;}
 await assert.rejects(()=>openNativeDocumentPreview(base,link),{code:'NATIVE_IMPORT_INVALID_FILE'});
});
test('P5.12 native preview refuses missing CLI arguments without leaking a path',()=>{
 const proc=spawnSync(process.execPath,['src/native-document-cli.mjs'],{cwd:repo,encoding:'utf8',timeout:10000});
 assert.equal(proc.status,1);
 assert.match(proc.stderr,/LOCAL_DOCUMENT_PREVIEW_BLOCKED/);
 assert.doesNotMatch(proc.stdout,/session=/);
});
test('P5.12 real child process PDF preview supports 401 and cited authenticated HTTP',async t=>{
 const p=local(t,'pdf',pdfFixture());
 const child=spawn(process.execPath,['src/native-document-cli.mjs',base,p],{
   cwd:repo,env:{...process.env,RAG_DASHBOARD_PORT:'0'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{
   if(child.exitCode===null){child.kill('SIGINT');await Promise.race([
    new Promise(resolve=>child.once('exit',resolve)),
    new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},1800))
   ]);}
 });
 const link=await new Promise((resolve,reject)=>{
   let out='';
   const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('LOCAL_PREVIEW_TIMEOUT'));},15000);
   const readable=chunk=>{
     out+=chunk.toString('utf8');
     if(out.length>8192){clearTimeout(timeout);reject(new Error('UNSAFE_LAUNCH_OUTPUT'));return;}
     const found=out.match(/http:\/\/127\.0\.0\.1:\d+\/#session=[A-Za-z0-9_-]{43}/);
     if(found){clearTimeout(timeout);child.stdout.off('data',readable);resolve(found[0]);}
   };
   child.stdout.on('data',readable);
   child.once('exit',()=>{clearTimeout(timeout);reject(new Error('CHILD_EARLY_EXIT'));});
 });
 const url=new URL(link),auth={Authorization:'Bearer '+url.hash.slice('#session='.length)};
 assert.equal((await fetch(url.origin+'/api/overview')).status,401);
 const r=await fetch(url.origin+'/api/search',{method:'POST',headers:{...auth,'Content-Type':'application/json'},
    body:JSON.stringify({question:'Product returns within 7 days'})});
 assert.equal(r.status,200);
 const answer=await r.json();
 assert.equal(answer.status,'FOUND');
 assert.ok(answer.evidence.some(e=>e.quote.includes('[PDF page 1]')));
});
