import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {verifyLocalModelFolder,verifyPublishedXenovaManifest,
  XENOVA_E5_ID,XENOVA_PUBLISHED_BLOBS} from '../src/local-model-preflight.mjs';

function specimen(){
 return {model_id:XENOVA_E5_ID,license:'mit',dimension:384,dtype:'q8',
  artifact_source:'https://huggingface.co/Xenova/multilingual-e5-small',
  files:[
   {name:'config.json',sha256:'a'.repeat(64),size:2},
   ...['tokenizer.json','onnx/model_quantized.onnx'].map(name=>({
     name,...XENOVA_PUBLISHED_BLOBS[name]}))
  ]};
}
test('P5.23 independent upstream blob references are recorded without fetching weights',()=>{
 const m=specimen(),a=verifyPublishedXenovaManifest(m);
 assert.equal(a.status,'PUBLISHED_HASH_REFERENCE_MATCHES_MANIFEST_ONLY');
 assert.equal(a.trained_inference,'NOT_RUN');
 assert.equal(a.legal_redistribution,'NOT_REVIEWED');
 assert.equal(XENOVA_PUBLISHED_BLOBS['onnx/model_quantized.onnx'].size,118308185);
});
test('P5.23 deny spoofed published weight hash and fake/altered byte size',()=>{
 for(const mutate of [
  m=>m.files[2].sha256='0'.repeat(64),
  m=>m.files[2].size--,
  m=>m.files[1].sha256='f'.repeat(64),
  m=>m.files[1].size++,
  m=>m.files=m.files.filter(x=>x.name!=='onnx/model_quantized.onnx'),
  m=>m.files.push({...m.files[1]}),
  m=>m.files.push({name:'sentencepiece.bpe.model',sha256:'f'.repeat(64),size:5069051})
 ]){
  const m=specimen();mutate(m);
  assert.throws(()=>verifyPublishedXenovaManifest(m),/dense model:/);
 }
});
test('P5.23 strict model ID, domain, declared license, type and dtype required',()=>{
 for(const mutate of [
  m=>m.model_id='intfloat/multilingual-e5-small',
  m=>m.artifact_source='https://evil.example.org/Xenova/multilingual-e5-small',
  m=>m.license='custom',
  m=>m.dimension=512,
  m=>m.dtype='fp16',
  m=>m.files=null
 ]){
  const m=specimen();mutate(m);
  assert.throws(()=>verifyPublishedXenovaManifest(m),/published profile/);
 }
 assert.throws(()=>verifyPublishedXenovaManifest(null),/published profile/);
});
test('P5.23 a claimed public hash cannot certify mismatching local bytes',t=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'p523-model-'));
 const root=path.join(base,'Xenova','multilingual-e5-small');
 fs.mkdirSync(path.join(root,'onnx'),{recursive:true});
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const m=specimen();
 fs.writeFileSync(path.join(root,'config.json'),'{}');
 fs.writeFileSync(path.join(root,'tokenizer.json'),'NOT_REAL_TOKENIZER');
 fs.writeFileSync(path.join(root,'onnx','model_quantized.onnx'),'NOT_REAL_ONNX');
 fs.writeFileSync(path.join(root,'rag_model_manifest.json'),JSON.stringify(m));
 assert.throws(()=>verifyLocalModelFolder(root,{ramBytes:8*1024**3,modelProfile:'xenova-q8'}),/size\/budget mismatch|SHA mismatch/);
 assert.throws(()=>verifyLocalModelFolder(root,{ramBytes:8*1024**3,modelProfile:'unsupported'}),/unsupported profile/);
});
test('P5.23 folder profile cannot assert upstream identity for a renamed path',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'p523-wrong-folder-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 assert.throws(()=>verifyLocalModelFolder(root,{ramBytes:8*1024**3,modelProfile:'xenova-q8'}),/directory mismatch/);
});
