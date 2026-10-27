import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createBilingualCorpus,authoredCases} from '../scripts/p521-bilingual-corpus.mjs';
import {XENOVA_E5_REVISION,verifyLocalModelFolder,verifyPublishedXenovaManifest,
 XENOVA_PUBLISHED_BLOBS} from '../src/local-model-preflight.mjs';
import {runDenseCases,summarizeDenseCases} from '../src/dense-evaluation.mjs';
const here=fileURLToPath(new URL('../',import.meta.url));
function manifest(){
 return {model_id:'Xenova/multilingual-e5-small',license:'mit',dimension:384,dtype:'q8',
  artifact_source:'https://huggingface.co/Xenova/multilingual-e5-small',revision:XENOVA_E5_REVISION,
  files:[{name:'config.json',size:658,sha256:'a'.repeat(64)},
   ...['tokenizer.json','onnx/model_quantized.onnx'].map(name=>({name,...XENOVA_PUBLISHED_BLOBS[name]}))]};
}
test('P5.24 verified upstream full commit is required for strict profile',()=>{
 assert.equal(XENOVA_E5_REVISION,'761b726dd34fb83930e26aab4e9ac3899aa1fa78');
 const m=manifest();
 assert.equal(verifyPublishedXenovaManifest(m,{requireRevision:true}).core_files_checked,2);
 for(const mutate of [
  x=>x.revision='main',x=>x.revision='761b726',x=>x.revision='f'.repeat(40),
  x=>delete x.revision,x=>x.extra='unexpected'
 ]){
  const x=manifest();mutate(x);
  assert.throws(()=>verifyPublishedXenovaManifest(x,{requireRevision:true}),/pinned/);
 }
});
test('P5.24 pinned profile rejects legacy/unpinned model folders before loading',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p524-'));
 const root=path.join(dir,'Xenova','multilingual-e5-small');
 fs.mkdirSync(root,{recursive:true});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const m=manifest();delete m.revision;
 fs.writeFileSync(path.join(root,'rag_model_manifest.json'),JSON.stringify(m));
 assert.throws(()=>verifyLocalModelFolder(root,{modelProfile:'xenova-q8',pinnedRevision:true}),
  /manifest schema/);
 assert.throws(()=>verifyLocalModelFolder(root,{modelProfile:'legacy',pinnedRevision:true}),
  /invalid pinned revision/);
});
test('P5.24 no-model CLI needs no optional libraries or model downloads',()=>{
 const r=spawnSync(process.execPath,['scripts/p524-offline-e5-eval.mjs'],{
  cwd:here,encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr);
 const out=JSON.parse(r.stdout);
 assert.equal(out.status,'MODEL_NOT_PROVIDED');
 assert.equal(out.model_loaded,false);assert.equal(out.download_performed,false);
 assert.equal(out.production_ready,false);
});
test('P5.24 no model spoofed as genuine in reports',async()=>{
 const samples=authoredCases();
 const results=await runDenseCases(samples,async()=>{
   return {status:'CANDIDATES_ONLY',answer:null,evidence:[{
    document_id:'document-ko-01',line:2}]};
 });
 assert.equal(results.questions,132);assert.equal(results.negative_questions,12);
 assert.equal(results.families.NEGATIVE.false_positives,12);
 assert.equal(results.production_ready,false);
 assert.equal(results.quality_gate,'REQUIRES_INDEPENDENT_GOLD_AND_NEGATIVE_ABSTENTION');
});
test('P5.24 evaluator rejects false provenance, missing cases and oversized evidence',()=>{
 const cases=authoredCases(),blank=()=>({result:{status:'NO_EVIDENCE',evidence:[]},elapsed_ms:0.1});
 assert.throws(()=>summarizeDenseCases(cases.slice(0,1),[blank()]),/132/);
 let out=Array.from({length:132},blank);
 out[0]={result:{status:'CANDIDATES_ONLY',evidence:[{document_id:'../evil',line:1}]},
  elapsed_ms:0.1};
 assert.throws(()=>summarizeDenseCases(cases,out),/CITATION_INVALID/);
 out=Array.from({length:132},blank);
 out[0]={result:{status:'CANDIDATES_ONLY',evidence:Array.from({length:4},
 ()=>({document_id:'document-ko-01',line:1}))},elapsed_ms:0.1};
 assert.throws(()=>summarizeDenseCases(cases,out),/TOO_MANY_EVIDENCE/);
});
test('P5.24 synthetic bilingual corpus remains hash-valid and disposeable',t=>{
 const corpus=createBilingualCorpus();
 t.after(()=>corpus.close());
 assert.equal(authoredCases().length,132);
 assert.ok(fs.existsSync(path.join(corpus.root,'manifest.json')));
});
