import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pdfFixture,docxFixture} from './native-document-fixtures.mjs';
import {openNativeDocumentCollectionPreview} from '../src/native-document-collection.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {resolveCitation,citationKey,documentPageStartForLine,nativeSourceLocation} from '../ui/provenance.js';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const source=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
async function setup(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p541-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const pdf=path.join(dir,'selected.pdf'),docx=path.join(dir,'selected.docx');
 fs.writeFileSync(pdf,pdfFixture());
 fs.writeFileSync(docx,docxFixture());
 const work=await openNativeDocumentCollectionPreview(source,[pdf,docx]);
 t.after(()=>work.cleanup());
 const server=createDashboardServer({packageRoot:work.root});
 const base=await listenDashboard(server,0);
 t.after(()=>new Promise(done=>server.close(done)));
 const token=dashboardLaunchUrl(server).split('#session=')[1];
 return {work,base,headers:{Authorization:'Bearer '+token}};
}
test('P5.41 40-line page start is bounded and one-based',()=>{
 for(const [line,expected] of [[1,1],[2,1],[40,1],[41,41],[80,41],[81,81],[10000,9961]])
  assert.equal(documentPageStartForLine(line),expected);
 for(const x of [0,-2,1.5,null,'41',10001,Infinity,NaN])
  assert.equal(documentPageStartForLine(x),null);
});
test('P5.41 native locator accepts only generated titles and exact prefixes',()=>{
 assert.equal(nativeSourceLocation({source_title:'Local PDF text preview 1',quote:'[PDF page 1] Product returns'}),'파일 1 · PDF 추출 1페이지');
 assert.equal(nativeSourceLocation({source_title:'Local DOCX text preview 2',quote:'[DOCX paragraph 2] 안전 점검'}),'파일 2 · DOCX 추출 2문단');
 assert.equal(nativeSourceLocation({source_title:'Local PDF text preview',quote:'[PDF page 50] End'}),'PDF 추출 50페이지');
 for(const bad of [
  {source_title:'returns_policy',quote:'[PDF page 1] Forged'},
  {source_title:'Local DOCX text preview 2',quote:'[PDF page 1] Wrong'},
  {source_title:'Local PDF text preview 1',quote:'intro [PDF page 1]'},
  {source_title:'Local PDF text preview 1',quote:'[PDF page 51] Wrong'},
  {source_title:'Local DOCX text preview 2',quote:'[DOCX paragraph 501] Wrong'},
  {source_title:'Local PDF text preview 9',quote:'[PDF page 1] Wrong'},
  {source_title:'Local PDF text preview 1',quote:'[PDF page 01] Wrong'},
  {source_title:'Local PDF text preview 1',quote:'[PDF page 1]'}
 ])assert.equal(nativeSourceLocation(bad),null);
});
test('P5.41 PDF/DOCX search citations match newly retrieved SHA-checked source lines',async t=>{
 const {work,base,headers}=await setup(t);
 const query='Product returns within 7 days 안전 점검 대상 부품';
 const search=searchDocuments(work.root,query,{limit:10});
 assert.equal(search.status,'FOUND');
 const ov=await fetch(base+'/api/overview',{headers});
 assert.equal(ov.status,200);
 const overview=await ov.json();
 for(const [index,location,line] of [[0,'PDF 추출 1페이지',1],[1,'DOCX 추출 2문단',2]]){
  const hit=search.evidence.find(x=>x.file_id===work.documents[index].file_id&&x.line===line);
  assert.ok(hit);
  const ref=resolveCitation(overview,hit);
  assert.equal(ref.kind,'document');
  assert.equal(citationKey(ref),citationKey({kind:'document',document_id:hit.document_id,file_id:hit.file_id}));
  assert.match(nativeSourceLocation(ref),new RegExp(location));
  const start=documentPageStartForLine(ref.line);
  const res=await fetch(base+'/api/documents?document_id='+encodeURIComponent(ref.document_id)+'&start='+start,{headers});
  assert.equal(res.status,200);
  const original=await res.json();
  assert.equal(original.file_id,ref.file_id);
  assert.equal(original.lines.find(r=>r.line===ref.line)?.text.trim(),ref.quote.trim());
  assert.equal(original.start,1);
 }
});
test('P5.41 authenticated source viewer refuses anonymous reads and source file alteration',async t=>{
 const {work,base,headers}=await setup(t);
 const hit=searchDocuments(work.root,'안전 점검 대상 부품').evidence.find(x=>x.file_id===work.documents[1].file_id);
 assert.ok(hit);
 const url=base+'/api/documents?document_id='+encodeURIComponent(hit.document_id)+'&start=1';
 assert.equal((await fetch(url)).status,401);
 assert.equal((await fetch(url,{headers})).status,200);
 const manifest=JSON.parse(fs.readFileSync(path.join(work.root,'manifest.json'),'utf8'));
 const file=manifest.files.find(x=>x.file_id===hit.file_id);
 fs.appendFileSync(path.join(work.root,file.relative_path),'CHANGED');
 const bad=await fetch(url,{headers});
 assert.equal(bad.status,422);
 assert.equal((await bad.json()).error,'PACKAGE_UNVERIFIED');
});
test('P5.41 client citation jump contract includes source quote revalidation and race guard',()=>{
 const file=fileURLToPath(new URL('../ui/app.js',import.meta.url));
 const src=fs.readFileSync(file,'utf8');
 assert.match(src,/documentPageStartForLine\(ref\.line\)/);
 assert.match(src,/void openDocument\(ref\.document_id,start,ref\)/);
 assert.match(src,/matched\.text\.trim\(\)!==expectedCitation\.quote\.trim\(\)/);
 assert.match(src,/request!==docRequestSequence/);
 assert.match(src,/node\.value===expectedCitation\.line/);
 assert.doesNotMatch(src,/innerHTML\s*=/);
});
