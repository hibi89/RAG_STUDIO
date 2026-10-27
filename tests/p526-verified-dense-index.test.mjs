import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createVerifiedDenseIndex} from '../src/local-dense-index.mjs';
import {searchLocalDense,DIMENSION} from '../src/local-dense.mjs';
import {authoredCases,createBilingualCorpus} from '../scripts/p521-bilingual-corpus.mjs';
import {runDenseCases} from '../src/dense-evaluation.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const embed=input=>{
 const v=new Array(DIMENSION).fill(0);
 if(input.includes('반품')||input.includes('returns'))v[0]=1;
 else if(input.includes('배송')||input.includes('shipping'))v[1]=1;
 else v[2]=1;
 return v;
};
const copy=t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p526-index-'));
 fs.cpSync(root,dir,{recursive:true});
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 return dir;
};
test('P5.26 indexed top 3 matches existing deterministic dense citations',async()=>{
 const idx=await createVerifiedDenseIndex(root,{embedder:embed});
 const fromIndex=await idx.search('반품 기간',{limit:3});
 const original=await searchLocalDense(root,'반품 기간',{embedder:embed,limit:3});
 assert.equal(fromIndex.status,'CANDIDATES_ONLY');
 assert.equal(fromIndex.answer,null);
 assert.deepEqual(fromIndex.evidence.map(e=>[e.document_id,e.line,e.score]),
   original.evidence.map(e=>[e.document_id,e.line,e.score]));
 assert.equal(idx.dimension,384);
 assert.ok(idx.passage_embeddings>0);
});
test('P5.26 passages embed once across repeated verified queries',async()=>{
 let queries=0,passages=0;
 const idx=await createVerifiedDenseIndex(root,{embedder:input=>{
  if(input.startsWith('query: '))queries++;
  else if(input.startsWith('passage: '))passages++;
  return embed(input);
 }});
 const init=idx.passage_embeddings;
 assert.equal(passages,init);
 await idx.search('반품 기간');await idx.search('배송 기간');
 assert.equal(passages,init);
 assert.equal(queries,2);
});
test('P5.26 SHA tampering after index build aborts BEFORE embedding query',async t=>{
 const dir=copy(t);
 let queries=0;
 const idx=await createVerifiedDenseIndex(dir,{embedder:input=>{
  if(input.startsWith('query: '))queries++;
  return embed(input);
 }});
 fs.appendFileSync(path.join(dir,'returns_policy.txt'),'tampered');
 await assert.rejects(()=>idx.search('반품 기간'),/sha256|size|changed/);
 assert.equal(queries,0);
});
test('P5.26 SHA tampering during query computation aborts without citations',async t=>{
 const dir=copy(t);
 const idx=await createVerifiedDenseIndex(dir,{embedder:input=>{
  if(input.startsWith('query: '))fs.appendFileSync(path.join(dir,'returns_policy.txt'),'race');
  return embed(input);
 }});
 await assert.rejects(()=>idx.search('반품 기간'),/sha256|size|changed/);
});
test('P5.26 invalid selectors, queries, output limits and zero vectors fail closed',async()=>{
 await assert.rejects(()=>createVerifiedDenseIndex(root,{embedder:embed,documentIds:['../bad']}),/selection/);
 await assert.rejects(()=>createVerifiedDenseIndex(root,{embedder:embed,documentIds:['not-present']}),/not approved/);
 await assert.rejects(()=>createVerifiedDenseIndex(root,{embedder:()=>[1,2]}),/vector/);
 await assert.rejects(()=>createVerifiedDenseIndex(root,{embedder:()=>new Array(DIMENSION).fill(0)}),/zero/);
 const idx=await createVerifiedDenseIndex(root,{embedder:embed,documentIds:['document-returns']});
 for(const question of ['',null,'x'.repeat(501)])
  await assert.rejects(()=>idx.search(question),/question/);
 for(const limit of [0,11,1.5])await assert.rejects(()=>idx.search('반품',{limit}),/limit/);
 const evidence=(await idx.search('반품')).evidence;
 assert.ok(evidence.every(e=>e.document_id==='document-returns'));
});
test('P5.26 all indexed evidence remains cited source lines and never auto-answers',async()=>{
 const idx=await createVerifiedDenseIndex(root,{embedder:embed});
 const result=await idx.search('Does the policy include actual refund terms?');
 assert.ok(result.evidence.length>0);
 assert.equal(result.answer,null);
 assert.ok(result.evidence.every(x=>x.file_id&&x.source_title&&x.line>=1&&x.quote));
 assert.ok(result.evidence.every(x=>!JSON.stringify(x).includes(root)));
});
test('P5.26 132 synthetic QA cases are runnable through one in-RAM index, not a trained model',async t=>{
 const corpus=createBilingualCorpus();
 t.after(()=>corpus.close());
 let passages=0;
 const idx=await createVerifiedDenseIndex(corpus.root,{embedder:input=>{
  const v=new Array(DIMENSION).fill(0);
  if(input.startsWith('passage: '))passages++;
  v[0]=1;return v;
 }});
 const result=await runDenseCases(authoredCases(),question=>idx.search(question,{limit:3}));
 assert.equal(result.questions,132);
 assert.equal(result.positive_questions,120);
 assert.equal(result.negative_questions,12);
 assert.equal(result.families.NEGATIVE.false_positives,12);
 assert.equal(result.production_ready,false);
 assert.equal(passages,idx.passage_embeddings);
 assert.equal(idx.document_count,20);
});
