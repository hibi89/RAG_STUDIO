import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {searchLocalDense,fallbackToBM25,DIMENSION,MAX_DENSE_LINES} from '../src/local-dense.mjs';
import {verifyLocalModelFolder} from '../src/local-model-preflight.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const embedding=input=>{
 const v=new Array(DIMENSION).fill(0);
 if(input.includes('반품')||input.includes('returns'))v[0]=1;
 else if(input.includes('배송')||input.includes('shipping'))v[1]=1;
 else v[2]=1;
 return v;
};
test('P5.22 bounded 384d candidate retrieval cites real verified source lines only',async()=>{
 const result=await searchLocalDense(root,'반품 기간',{embedder:embedding,limit:3});
 assert.equal(result.status,'CANDIDATES_ONLY');assert.equal(result.answer,null);
 assert.equal(result.search_mode,'local_dense_experimental');
 assert.equal(result.evidence[0].document_id,'document-returns');
 assert.ok(result.evidence[0].line>=1);
 assert.ok(result.evidence.every(e=>!JSON.stringify(e).includes(root)));
});
test('P5.22 weighted BM25+dense retains provenance and returns no factual answer',async()=>{
 const r=await searchLocalDense(root,'배송 준비',{embedder:embedding,mode:'dense_rrf',limit:3});
 assert.equal(r.status,'CANDIDATES_ONLY');assert.equal(r.answer,null);
 assert.equal(r.search_mode,'local_dense_rrf_experimental');
 assert.equal(r.evidence[0].document_id,'document-shipping');
 assert.ok(r.evidence.every(e=>e.score>0&&e.retrieval_source));
});
test('P5.22 synthetic vectors are explicitly only an injected geometry smoke, not semantic model',async()=>{
 let query=false,passage=false;
 const embedder=async input=>{
  if(input.startsWith('query: '))query=true;
  if(input.startsWith('passage: '))passage=true;
  return embedding(input);
 };
 await searchLocalDense(root,'반품',{embedder,limit:2});
 assert.equal(query,true);assert.equal(passage,true);
});
test('P5.22 BM25 fallback is explicit, without pretending a dense model ran',()=>{
 const r=fallbackToBM25(root,'반품',{reason:'LOCAL_MODEL_UNAVAILABLE'});
 assert.equal(r.search_mode,'bm25_line_ngrams');
 assert.deepEqual(r.fallback,{requested:'local_dense_experimental',actual:'bm25_line_ngrams',reason:'LOCAL_MODEL_UNAVAILABLE'});
 assert.throws(()=>fallbackToBM25(root,'반품',{reason:'I AM DENSE'}));
});
test('P5.22 reject malformed, NaN, wrong dimension, zero vectors and unsupported mode',async()=>{
 for(const invalid of [undefined,' ',{},'x'.repeat(501)])
  await assert.rejects(()=>searchLocalDense(root,invalid,{embedder:embedding}));
 await assert.rejects(()=>searchLocalDense(root,'반품',{embedder:async()=>[1,2]}),/vector/);
 await assert.rejects(()=>searchLocalDense(root,'반품',{embedder:async()=>new Array(DIMENSION).fill(0)}),/empty/);
 await assert.rejects(()=>searchLocalDense(root,'반품',{embedder:async()=>new Array(DIMENSION).fill(NaN)}),/invalid/);
 await assert.rejects(()=>searchLocalDense(root,'반품',{embedder:embedding,limit:100}),/limit/);
 await assert.rejects(()=>searchLocalDense(root,'반품',{embedder:embedding,mode:'arbitrary'}),/unsupported/);
 assert.equal(MAX_DENSE_LINES,768);
});
test('P5.22 selected documents constrain vector path and BM25 fusion',async()=>{
 const r=await searchLocalDense(root,'배송 준비',{embedder:embedding,
  documentIds:['document-returns'],mode:'dense_rrf'});
 assert.ok(r.evidence.every(x=>x.document_id==='document-returns'));
 await assert.rejects(()=>searchLocalDense(root,'반품',{embedder:embedding,documentIds:['../manifest.json']}));
});
test('P5.22 model folder missing and model integrity violations fail safely',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p522-model-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.throws(()=>verifyLocalModelFolder(dir,{ramBytes:8*1024**3}));
 assert.throws(()=>verifyLocalModelFolder('relative',{ramBytes:8*1024**3}),/absolute/);
 const f=(name,content)=>{const p=path.join(dir,name);fs.mkdirSync(path.dirname(p),{recursive:true});
   fs.writeFileSync(p,content);return {name,size:Buffer.byteLength(content),
     sha256:crypto.createHash('sha256').update(content).digest('hex')};};
 const assets=[f('config.json','{}'),f('tokenizer.json','{}'),f('onnx/model_quantized.onnx','fake-bytes')];
 const manifest={model_id:'intfloat/multilingual-e5-small',license:'mit',dimension:384,dtype:'q8',
  artifact_source:'https://huggingface.co/intfloat/multilingual-e5-small',files:assets};
 fs.writeFileSync(path.join(dir,'rag_model_manifest.json'),JSON.stringify(manifest));
 assert.equal(verifyLocalModelFolder(dir,{ramBytes:8*1024**3}).verified_files,3);
 assert.throws(()=>verifyLocalModelFolder(dir,{ramBytes:2*1024**3}),/insufficient/);
 fs.appendFileSync(path.join(dir,'onnx/model_quantized.onnx'),'tamper');
 assert.throws(()=>verifyLocalModelFolder(dir,{ramBytes:8*1024**3}),/size|SHA/);
});
test('P5.22 a source-file tampering aborts before embedding inference',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'p522-sources-'));
 fs.cpSync(root,folder,{recursive:true});
 t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 fs.appendFileSync(path.join(folder,'returns_policy.txt'),'tampered');
 let invoked=false;
 await assert.rejects(()=>searchLocalDense(folder,'반품',{embedder:()=>{invoked=true;return embedding('반품');}}),/size|sha256/);
 assert.equal(invoked,false);
});
test('P5.22 missing actual local inference does not trigger any network connection',async()=>{
 // The pure candidate backend has no network primitives and never invokes loader APIs.
 const r=await searchLocalDense(root,'배송',{embedder:embedding});
 assert.equal(r.status,'CANDIDATES_ONLY');
});

test('P5.22 undeclared additional model asset and symbolic link are blocked',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p522-unlisted-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const f=(name,content)=>{
  const p=path.join(dir,name);fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,content);return {name,size:Buffer.byteLength(content),
    sha256:crypto.createHash('sha256').update(content).digest('hex')};
 };
 const assets=[f('config.json','{}'),f('tokenizer.json','{}'),f('onnx/model_quantized.onnx','placeholder')];
 fs.writeFileSync(path.join(dir,'rag_model_manifest.json'),JSON.stringify({
  model_id:'intfloat/multilingual-e5-small',license:'mit',dimension:384,dtype:'q8',
  artifact_source:'https://huggingface.co/intfloat/multilingual-e5-small',files:assets
 }));
 assert.equal(verifyLocalModelFolder(dir,{ramBytes:8*1024**3}).verified_files,3);
 fs.writeFileSync(path.join(dir,'unsafe-extra.json'),'{}');
 assert.throws(()=>verifyLocalModelFolder(dir,{ramBytes:8*1024**3}),/undeclared/);
 fs.rmSync(path.join(dir,'unsafe-extra.json'));
 if(process.platform!=='win32'){
  fs.symlinkSync(path.join(dir,'config.json'),path.join(dir,'unsafe-link'));
  assert.throws(()=>verifyLocalModelFolder(dir,{ramBytes:8*1024**3}),/symlink/);
 }
});
