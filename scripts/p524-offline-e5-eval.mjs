/** Explicit developer-only, no-download benchmark of a locally provisioned q8 E5.
 * No model folder => no installation, network access or inferred metrics.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createBilingualCorpus,authoredCases} from './p521-bilingual-corpus.mjs';
import {verifyLocalModelFolder} from '../src/local-model-preflight.mjs';
import {searchLocalDense} from '../src/local-dense.mjs';
import {runDenseCases} from '../src/dense-evaluation.mjs';

const args=process.argv.slice(2);
if(args.length>1)throw Error('USAGE: node scripts/p524-offline-e5-eval.mjs [ABS_XENOVA_MODEL_DIR]');
let summary;
if(!args.length){
 summary={status:'MODEL_NOT_PROVIDED',model_loaded:false,model_run:false,
   download_performed:false,baseline_unchanged:true,production_ready:false};
}else{
 const modelDir=args[0];
 if(!path.isAbsolute(modelDir))throw Error('MODEL_DIRECTORY_MUST_BE_ABSOLUTE');
 // Always verify all listed bytes BEFORE importing any optional runtime code.
 let manifest;
 try{manifest=verifyLocalModelFolder(modelDir,{modelProfile:'xenova-q8',pinnedRevision:true});}
 catch {summary={status:'MODEL_INTEGRITY_OR_REVISION_FAILED',
   model_loaded:false,model_run:false,production_ready:false};}
 if(manifest){
  let runtime;
  try{runtime=await import('@huggingface/transformers');}
  catch {summary={status:'RUNTIME_NOT_INSTALLED',model_loaded:false,
     model_run:false,production_ready:false};}
  if(runtime){
   let corpus;
   try{
    const modelRoot=fs.realpathSync(modelDir);
    runtime.env.allowRemoteModels=false;
    runtime.env.allowLocalModels=true;
    runtime.env.useFSCache=false;
    runtime.env.useBrowserCache=false;
    runtime.env.localModelPath=path.dirname(path.dirname(modelRoot))+path.sep;
    await import('onnxruntime-node');
    const pipe=await runtime.pipeline('feature-extraction',manifest.model_id,{
      device:'cpu',dtype:'q8',local_files_only:true});
    const cache=new Map();
    const embedder=async input=>{
      let v=cache.get(input);
      if(v)return v;
      if(cache.size>=1024)throw Error('P524_EMBEDDING_CACHE_BUDGET_EXCEEDED');
      const result=await pipe(input,{pooling:'mean',normalize:true});
      v=result.data;
      cache.set(input,v);return v;
    };
    corpus=createBilingualCorpus();
    const before=process.cpuUsage(),start=process.memoryUsage().rss;
    const score=await runDenseCases(authoredCases(),question=>
      searchLocalDense(corpus.root,question,{embedder,limit:3,mode:'dense'}));
    const cpu=process.cpuUsage(before);
    summary={status:'REAL_MODEL_EVALUATION_NOT_RELEASE_CERTIFICATION',
      actual_trained_model_run:true,model_id:manifest.model_id,
      revision_status:manifest.revision_status,
      cold_start_memory_rss_bytes:start,final_memory_rss_bytes:process.memoryUsage().rss,
      embedding_cache_entries:cache.size,
      cpu_user_ms:Number((cpu.user/1000).toFixed(2)),
      cpu_system_ms:Number((cpu.system/1000).toFixed(2)),
      ...score};
   }catch{
    summary={status:'INFERENCE_FAILED_NO_RESULTS_CERTIFIED',
      model_run:false,production_ready:false};
   }finally{corpus?.close();}
  }
 }
}
console.log(JSON.stringify(summary,null,2));
