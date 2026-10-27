import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createSyntheticCorpus,makeCases} from '../scripts/p520-corpus.mjs';
import {loadPackage} from '../src/validate.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {searchLexicalHybrid} from '../src/lexical-hybrid.mjs';
test('P5.20 deterministic 120 grounded questions plus 12 out-of-scope negatives',()=>{
 const a=makeCases(24),b=makeCases(24);
 assert.deepEqual(a,b);assert.equal(a.length,132);
 assert.deepEqual(new Set(a.map(x=>x.family)),
   new Set(['exact','separator','typo','reordered','out_of_scope']));
 assert.equal(a.filter(x=>x.expected).length,120);
 assert.equal(a.filter(x=>x.expected===null).length,12);
});
test('P5.20 96 document corpus obeys 100-file V0 limit and SHA/line provenance',t=>{
 const pkg=createSyntheticCorpus(96);
 t.after(()=>pkg.close());
 const loaded=loadPackage(pkg.root);
 assert.equal(loaded.manifest.files.length,97);
 assert.equal(loaded.manifest.documents.length,96);
 assert.equal(loaded.manifest.processing_summary.accepted,97);
 assert.equal(loaded.textMap.size,97);
 const q=makeCases(96)[0];
 for(const search of [searchDocuments,searchLexicalHybrid]){
  const hit=search(pkg.root,q.question,{limit:3});
  assert.equal(hit.status,'FOUND');
  assert.ok(hit.evidence.some(e=>e.document_id===q.expected&&e.line>=1));
 }
});
test('P5.20 generated packages are isolated and source hashes are revalidated',t=>{
 const a=createSyntheticCorpus(6),b=createSyntheticCorpus(6);
 t.after(()=>{a.close();b.close();});
 assert.notEqual(a.root,b.root);
 const one=makeCases(6)[0];
 assert.equal(searchDocuments(a.root,one.question).status,'FOUND');
 fs.appendFileSync(path.join(a.root,'document-scale-001.txt'),'tampered');
 assert.throws(()=>searchDocuments(a.root,one.question),/size|sha256/);
 assert.equal(searchDocuments(b.root,one.question).status,'FOUND');
});
test('P5.20 refuses unsupported corpus sizes, path traversal and bad settings',()=>{
 for(const size of [-1,0,1,97,101,2.5,'96'])
   assert.throws(()=>createSyntheticCorpus(size),/LIMIT/);
 assert.throws(()=>createSyntheticCorpus(24,{lineCount:100}),/LIMIT/);
 assert.throws(()=>makeCases(0),/INVALID_DOCUMENT_COUNT/);
});
test('P5.20 no customer or repo fixture bytes are modified by generated benchmarking',t=>{
 const root=createSyntheticCorpus(3);
 t.after(()=>root.close());
 const before=fs.readFileSync(path.join(root.root,'sales.csv'));
 searchDocuments(root.root,makeCases(3)[0].question);
 searchLexicalHybrid(root.root,makeCases(3)[0].question);
 assert.deepEqual(before,fs.readFileSync(path.join(root.root,'sales.csv')));
});
