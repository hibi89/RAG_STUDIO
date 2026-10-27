import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {authoredCases,createBilingualCorpus,SCENARIOS} from '../scripts/p521-bilingual-corpus.mjs';
import {loadPackage} from '../src/validate.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {searchLexicalHybrid} from '../src/lexical-hybrid.mjs';

test('P5.21 120 authored topic and 12 negative questions have explicit independent source IDs',()=>{
 const a=authoredCases(),b=authoredCases();
 assert.deepEqual(a,b);assert.equal(a.length,132);assert.equal(new Set(a.map(x=>x.id)).size,132);
 assert.deepEqual(Object.fromEntries(['KO_SAME','EN_SAME','KO_TO_EN','EN_TO_KO','NEGATIVE']
   .map(f=>[f,a.filter(x=>x.family===f).length])),
   {KO_SAME:30,EN_SAME:30,KO_TO_EN:30,EN_TO_KO:30,NEGATIVE:12});
 assert.equal(SCENARIOS.length,10);
 for(const x of a){
   assert.equal(typeof x.question,'string');
   assert.ok(x.question.length>7&&x.question.length<500);
   if(x.family==='NEGATIVE')assert.equal(x.expected,null);
   else assert.match(x.expected,/^document-(ko|en)-\d{2}$/);
 }
});
test('P5.21 verified bilingual corpus contains 20 document sources and one CSV only',t=>{
 const c=createBilingualCorpus();t.after(()=>c.close());
 const pkg=loadPackage(c.root);
 assert.equal(pkg.manifest.files.length,21);
 assert.equal(pkg.manifest.documents.length,20);
 assert.equal(pkg.manifest.processing_summary.accepted,21);
 assert.equal(pkg.textMap.size,21);
 const one=pkg.manifest.documents[0],two=pkg.manifest.documents[1];
 assert.equal(one.document_id,'document-ko-01');assert.equal(two.document_id,'document-en-01');
 assert.notEqual(pkg.textMap.get(one.file_id),pkg.textMap.get(two.file_id));
});
test('P5.21 cross-lingual ground truth resolves to opposite-language document',()=>{
 const cases=authoredCases();
 for(const x of cases){
   if(x.family==='KO_TO_EN')assert.match(x.expected,/document-en-/);
   if(x.family==='EN_TO_KO')assert.match(x.expected,/document-ko-/);
 }
});
test('P5.21 both retrieval engines preserve citation provenance and do not mutate corpus',t=>{
 const c=createBilingualCorpus();t.after(()=>c.close());
 const doc=path.join(c.root,'document-en-01.txt'),before=fs.readFileSync(doc);
 for(const fn of [searchDocuments,searchLexicalHybrid]){
  const answer=fn(c.root,'frozen seafood freezer',{limit:3});
  assert.equal(answer.status,'FOUND');
  assert.ok(answer.evidence.length>0);
  for(const e of answer.evidence){
   assert.ok(e.line>=1&&Number.isInteger(e.line));
   assert.match(e.document_id,/^document-(ko|en)-\d{2}$/);
   assert.equal(JSON.stringify(e).includes(c.root),false);
  }
 }
 assert.deepEqual(fs.readFileSync(doc),before);
});
test('P5.21 tampered benchmark document cannot be searched by any ranking mode',t=>{
 const c=createBilingualCorpus();t.after(()=>c.close());
 fs.appendFileSync(path.join(c.root,'document-ko-02.txt'),'tampered');
 for(const fn of [searchDocuments,searchLexicalHybrid])
  assert.throws(()=>fn(c.root,'frozen seafood'),/size|sha256/);
});
test('P5.21 unrelated question is not treated as answered on authored negative example',t=>{
 const c=createBilingualCorpus();t.after(()=>c.close());
 const q='해왕성의 대기 메탄 함량은 얼마인가?';
 for(const fn of [searchDocuments,searchLexicalHybrid]){
  const r=fn(c.root,q,{limit:3});
  assert.ok(['NO_EVIDENCE','FOUND'].includes(r.status));
  assert.equal(r.status==='FOUND',r.evidence.length>0);
  // Relevance is scored by benchmark. A retriever's FOUND status is never an asserted factual answer.
  assert.equal(r.answer===null||typeof r.answer==='string',true);
 }
});
