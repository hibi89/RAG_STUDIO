/** Launch each independent worker in a fresh process to compare quality/cost.
 * Not a semantic or production benchmark: results are generated synthetic labels.
 */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createSyntheticCorpus} from './p520-corpus.mjs';
const worker=fileURLToPath(new URL('./p520-benchmark-worker.mjs',import.meta.url));
const profiles=[];
for(const count of [24,64,96]){
 const dataset=createSyntheticCorpus(count);
 try{
  const methods={};
  for(const mode of ['bm25','lexical_hybrid']){
   const result=spawnSync(process.execPath,[worker,dataset.root,String(count),mode],{
     encoding:'utf8',maxBuffer:1024*1024,timeout:180_000});
   if(result.status!==0||result.error)throw Error('BENCHMARK_WORKER_FAILED: '+mode+' documents='+count+
     ' '+String(result.error??result.stderr).slice(0,700));
   const parsed=JSON.parse(result.stdout);
   if(parsed.queries!==132||parsed.positive!==120||parsed.negative!==12||parsed.document_count!==count)
     throw Error('BENCHMARK_INCOMPLETE');
   methods[mode]=parsed;
  }
  profiles.push({documents:count,lines:count*dataset.lineCount,methods,
    delta_recall_at_3:methods.lexical_hybrid.recall_at_3-methods.bm25.recall_at_3,
    median_latency_ratio:methods.lexical_hybrid.elapsed_ms_median/
      Math.max(0.0001,methods.bm25.elapsed_ms_median),
    peak_rss_ratio:methods.lexical_hybrid.peak_rss_bytes/
      Math.max(1,methods.bm25.peak_rss_bytes)});
 }finally{dataset.close();}
}
console.log(JSON.stringify({schema:'RAG_P520_SYNTHETIC_RETRIEVAL_GATE_V1',
 platform:process.platform,node:process.version,corpus_origin:'deterministic synthetic generator',
 cases_per_profile:132,profiles,default_recommendation:'RETAIN_BM25_UNTIL_REAL_SEMANTIC_GOLD_AND_WINDOWS_QA',
 limitations:['Generated reference identifiers favor lexical matching',
 'Small bounded V0 packages (100-file cap), no embeddings, no production customer data',
 'Separate-process Linux peak RSS includes runtime startup; do not infer Windows peak',
 'No FAISS/model deployment benchmark'],},null,2));
