import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {searchDocuments} from '../src/document-search.mjs';
import {knowledgeSearch} from '../src/knowledge-base.mjs';
const original=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
function isolated(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'p538-'));
  fs.cpSync(original,root,{recursive:true});
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
function add(root,id,body){
  const file=id+'.txt',bytes=Buffer.from(body,'utf8');
  fs.writeFileSync(path.join(root,file),bytes);
  const manifestPath=path.join(root,'manifest.json');
  const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  m.files.push({file_id:'file-'+id,relative_path:file,kind:'document',
    sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    size_bytes:bytes.length,import_status:'ACCEPTED'});
  m.documents.push({document_id:'document-'+id,file_id:'file-'+id,
    language:'ko',source_title:'합성 '+id,page_info:'lines:1-2',index_status:'NOT_INDEXED'});
  m.processing_summary.accepted++;
  fs.writeFileSync(manifestPath,JSON.stringify(m));
}
test('P5.38 conflict below BM25 top one cannot silently become FOUND',t=>{
  const root=isolated(t);
  for(let i=0;i<14;i++)add(root,'filler'+String(i).padStart(2,'0'),
    '[SYNTHETIC]\n반품 신청 가능 기간은 7일 이내 입니다.\n');
  add(root,'zz-other','[SYNTHETIC]\n상품 수령일부터 30일 이내 반품 신청 가능.\n');
  const r=searchDocuments(root,'반품 신청 기간',{limit:1});
  assert.equal(r.status,'POSSIBLE_CONFLICT');
  assert.equal(r.answer,null);
  assert.equal(r.evidence.length,1);
  assert.deepEqual(new Set(r.review_evidence.map(e=>e.period)),new Set([7,30]));
  assert.ok(r.review_evidence.some(e=>e.document_id==='document-zz-other'&&e.line===2));
  assert.ok(r.review_evidence.every(e=>e.file_id&&e.quote&&e.claim_kind==='calendar_days'));
  assert.doesNotMatch(JSON.stringify(r),/p538-/u);
});
test('P5.38 selected document scope excludes out-of-collection conflict',t=>{
  const root=isolated(t);
  add(root,'alt','[SYNTHETIC]\n14일 이내 반품 신청 가능합니다.\n');
  const selected=knowledgeSearch(root,['document-returns'],'반품 신청 기간',{mode:'bm25'});
  assert.equal(selected.status,'FOUND');
  assert.equal(selected.review_evidence,undefined);
  assert.ok(selected.evidence.every(e=>e.document_id==='document-returns'));
  const both=knowledgeSearch(root,['document-returns','document-alt'],'반품 신청 기간',{mode:'bm25'});
  assert.equal(both.status,'POSSIBLE_CONFLICT');
  assert.deepEqual(new Set(both.review_evidence.map(x=>x.period)),new Set([7,14]));
  const lexical=knowledgeSearch(root,['document-returns','document-alt'],'반품 신청 기간',{mode:'lexical_hybrid'});
  assert.equal(lexical.status,'POSSIBLE_CONFLICT');
});
test('P5.38 same source line can contain conflicting periods with two same-line citations',t=>{
  const root=isolated(t);
  add(root,'same-line','[SYNTHETIC]\n반품 신청은 7일 이내 가능 또는 14일 이내 가능.\n');
  const r=searchDocuments(root,'반품 기간',{limit:1});
  assert.equal(r.status,'POSSIBLE_CONFLICT');
  assert.equal(r.review_evidence.length,2);
  assert.deepEqual(new Set(r.review_evidence.map(e=>e.period)),new Set([7,14]));
});
test('P5.38 consistent period claims and shipping business-days do not create false conflict',t=>{
  const root=isolated(t);
  add(root,'consistent','[SYNTHETIC]\n반품 신청 7일 이내 가능합니다.\n배송 준비 시작 30영업일 이내.\n');
  const r=searchDocuments(root,'반품 신청 기간',{limit:1});
  assert.equal(r.status,'FOUND');
  assert.equal(r.review_evidence,undefined);
});
test('P5.38 tampered source fails before search and originals remain unchanged',t=>{
  const root=isolated(t);
  add(root,'alt','[SYNTHETIC]\n14일 이내 반품 신청 가능.\n');
  const p=path.join(root,'alt.txt');
  const before=fs.readFileSync(p);
  assert.equal(searchDocuments(root,'반품 신청',{limit:1}).status,'POSSIBLE_CONFLICT');
  assert.deepEqual(fs.readFileSync(p),before);
  fs.appendFileSync(p,'tamper');
  assert.throws(()=>searchDocuments(root,'반품 신청',{limit:1}),/size|sha256/);
});
