/** Experimental single-query CLI, never exposed in network dashboard.
 * With no preinstalled audited model/runtime: show explicit BM25 fallback.
 * With local pre-provisioned models: no automatic network/cache/model downloads.
 */
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {verifyLocalModelFolder} from '../src/local-model-preflight.mjs';
import {fallbackToBM25,searchLocalDense} from '../src/local-dense.mjs';
const argv=process.argv.slice(2);
if(argv.length<2||argv.length>3||!path.isAbsolute(argv[0])||!argv[1].trim()||argv[1].length>500)
 throw Error('USAGE: node scripts/p522-offline-dense-cli.mjs <ABSOLUTE_AX_PACKAGE_ROOT> <QUESTION> [ABSOLUTE_LOCAL_MODEL_FOLDER]');
const [root,question,modelDir]=argv;
function safeFallback(reason){
 const result=fallbackToBM25(root,question,{reason});
 return {status:'FALLBACK_BM25',result};
}
let output;
if(!modelDir){
 output=safeFallback('LOCAL_MODEL_UNAVAILABLE');
}else{
 if(!path.isAbsolute(modelDir))throw Error('MODEL_FOLDER_ABSOLUTE_REQUIRED');
 let manifest;
 try{
   const local=fs.realpathSync(modelDir);
   const modelProfile=path.basename(path.dirname(local))==='Xenova'?'xenova-q8':'legacy';
   manifest=verifyLocalModelFolder(modelDir,{modelProfile});
 }
 catch{output=safeFallback('MODEL_INTEGRITY_FAILED');}
 if(manifest){
  // Import optional native inference only AFTER full local file integrity checks.
  let runtime;
  try{runtime=await import('@huggingface/transformers');}
  catch{output=safeFallback('RUNTIME_UNAVAILABLE');}
  if(runtime){
   try{
    runtime.env.allowRemoteModels=false;
    runtime.env.allowLocalModels=true;
    runtime.env.useFSCache=false;
    runtime.env.localModelPath=path.dirname(path.dirname(fs.realpathSync(modelDir)))+path.sep;
    // Both supported IDs must match their declared local directory exactly.
    if(path.basename(path.dirname(fs.realpathSync(modelDir)))!==manifest.model_id.split('/')[0]||
       path.basename(fs.realpathSync(modelDir))!==manifest.model_id.split('/')[1])
      throw Error('MODEL_LOCATION_MUST_MATCH_ID');
    // Node native ONNX CPU runtime is optional. An absent one fails closed.
    await import('onnxruntime-node');
    const extractor=await runtime.pipeline('feature-extraction',manifest.model_id,{
      device:'cpu',dtype:'q8',local_files_only:true});
    const embedder=async input=>{
      const result=await extractor(input,{pooling:'mean',normalize:true});
      return result.data;
    };
    output={status:'EXPERIMENTAL_LOCAL_DENSE_NOT_CERTIFIED',
      model:manifest,results:await searchLocalDense(root,question,{embedder,mode:'dense_rrf',limit:5})};
   }catch{output=safeFallback('INFERENCE_FAILED');}
  }
 }
}
console.log(JSON.stringify(output,null,2));
