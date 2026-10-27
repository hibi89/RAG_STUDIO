import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {makeCandidateManifest,inspectOfflineModelFolder,
 prepareOfflineModelManifest} from '../src/local-model-provision.mjs';
import {XENOVA_PUBLISHED_BLOBS,XENOVA_E5_REVISION} from '../src/local-model-preflight.mjs';

const cwd=fileURLToPath(new URL('../',import.meta.url));
const pin=n=>({name:n,...XENOVA_PUBLISHED_BLOBS[n]});
const specimen=()=>[
 {name:'config.json',size:658,sha256:'a'.repeat(64)},
 pin('tokenizer.json'),pin('onnx/model_quantized.onnx')];
function folder(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'p525-'));
 const root=path.join(base,'Xenova','multilingual-e5-small');
 fs.mkdirSync(path.join(root,'onnx'),{recursive:true});
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 return root;
}
test('P5.25 pure manifest candidate pins immutable upstream revision and mandatory published bytes',()=>{
 const m=makeCandidateManifest(specimen());
 assert.equal(m.revision,XENOVA_E5_REVISION);
 assert.equal(m.files.length,3);
 assert.equal(m.artifact_source,'https://huggingface.co/Xenova/multilingual-e5-small');
 assert.equal(m.license,'mit'); // declared upstream metadata, not release approval
});
test('P5.25 reject forged ONNX/tokenizer hash and size without creating an artifact',()=>{
 for(const change of [
  s=>s[2].sha256='b'.repeat(64),s=>s[2].size++,
  s=>s[1].sha256='b'.repeat(64),s=>s[1].size--,
  s=>s.pop(),s=>s.push({...s[1]})
 ]){
  const s=specimen();change(s);
  assert.throws(()=>makeCandidateManifest(s),/P525_|dense model:/);
 }
});
test('P5.25 optional independently pinned SentencePiece is also checked',()=>{
 const s=[...specimen(),pin('sentencepiece.bpe.model')];
 assert.equal(makeCandidateManifest(s).files.length,4);
 s[3].sha256='c'.repeat(64);
 assert.throws(()=>makeCandidateManifest(s),/published SHA/);
});
test('P5.25 rejects unsupported paths, hash shapes, missing mandatory set',()=>{
 for(const bad of [
  {name:'../escape',size:1,sha256:'b'.repeat(64)},
  {name:'onnx/model.onnx',size:1,sha256:'b'.repeat(64)},
  {name:'tokenizer_config.json',size:0,sha256:'b'.repeat(64)},
  {name:'tokenizer_config.json',size:3,sha256:'INVALID'}
 ]){
  assert.throws(()=>makeCandidateManifest([...specimen(),bad]),/P525_/);
 }
});
test('P5.25 dry-run and explicit write fail closed for fake bytes, preserve original files',t=>{
 const root=folder(t);
 const model=path.join(root,'onnx','model_quantized.onnx');
 fs.writeFileSync(path.join(root,'config.json'),'{}');
 fs.writeFileSync(path.join(root,'tokenizer.json'),'test-unauthenticated');
 fs.writeFileSync(model,'fake-weights');
 const original=crypto.createHash('sha256').update(fs.readFileSync(model)).digest('hex');
 assert.throws(()=>inspectOfflineModelFolder(root),/published SHA|published profile/);
 assert.throws(()=>prepareOfflineModelManifest(root,{write:true}),/published SHA|published profile/);
 assert.equal(fs.existsSync(path.join(root,'rag_model_manifest.json')),false);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(model)).digest('hex'),original);
});
test('P5.25 never overwrites an existing operator manifest',t=>{
 const root=folder(t),p=path.join(root,'rag_model_manifest.json');
 fs.writeFileSync(p,'KEEP ORIGINAL');
 assert.throws(()=>inspectOfflineModelFolder(root),/MANIFEST_EXISTS/);
 assert.equal(fs.readFileSync(p,'utf8'),'KEEP ORIGINAL');
});
test('P5.25 rejects undeclared files and symlinks before source hashing',t=>{
 const root=folder(t);
 fs.writeFileSync(path.join(root,'secret.env'),'NO_UPLOAD');
 assert.throws(()=>inspectOfflineModelFolder(root),/UNDECLARED_FILE/);
 fs.unlinkSync(path.join(root,'secret.env'));
 if(process.platform!=='win32'){
  fs.symlinkSync(path.join(root,'onnx'),path.join(root,'sym'));
  assert.throws(()=>inspectOfflineModelFolder(root),/SYMLINK_FILE/);
 }
});
test('P5.25 preparer CLI has no network/download and never changes missing path',()=>{
 const bad=path.join(os.tmpdir(),'p525-nonexistent-model-629816');
 const r=spawnSync(process.execPath,['scripts/p525-prepare-local-model.mjs',bad],{
  cwd,encoding:'utf8',timeout:10000});
 assert.equal(r.status,1,r.stderr);
 const d=JSON.parse(r.stdout);
 assert.equal(d.status,'LOCAL_MODEL_PREPARATION_BLOCKED');
 assert.equal(d.download_performed,false);
 assert.equal(d.manifest_written,false);
 assert.equal(fs.existsSync(bad),false);
});
