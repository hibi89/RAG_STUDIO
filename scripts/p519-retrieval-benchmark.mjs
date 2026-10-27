/** Offline repeatable synthetic retrieval trade-off measurement, not a sales-quality claim.
 * Prints measured recall@3, median/p95 elapsed time and process heap/RSS deltas.
 */
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {searchDocuments} from '../src/document-search.mjs';
import {searchLexicalHybrid} from '../src/lexical-hybrid.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const cases=[
 {q:'반품 신청 기간',id:'document-returns'},
 {q:'반품 안내',id:'document-returns'},
 {q:'환불 신청',id:'document-returns'},
 {q:'배송 준비 기간',id:'document-shipping'},
 {q:'배송 준비 언제 시작',id:'document-shipping'},
 {q:'발송 준비',id:'document-shipping'},
 {q:'반품 환불',id:'document-returns'},
 {q:'배송 작업',id:'document-shipping'}
];
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return Number(sorted[Math.ceil(sorted.length*p)-1].toFixed(3));};
function run(name,search){
 const times=[];let correct=0,valid=0;
 const heapBefore=process.memoryUsage().heapUsed,rssBefore=process.memoryUsage().rss;
 for(let repeat=0;repeat<3;repeat++){
  for(const item of cases){
   const start=performance.now();
   const x=search(root,item.q,{limit:3});
   times.push(performance.now()-start);
   if(repeat===0){valid++;if(x.evidence.some(h=>h.document_id===item.id))correct++;}
  }
 }
 const heapAfter=process.memoryUsage().heapUsed,rssAfter=process.memoryUsage().rss;
 return {name,queries:valid,repeat_runs:3,recall_at_3:correct/valid,correct,
   elapsed_ms_median:percentile(times,0.5),elapsed_ms_p95:percentile(times,0.95),
   heap_delta_bytes:heapAfter-heapBefore,rss_delta_bytes:rssAfter-rssBefore};
}
// Pre-warm both paths to avoid one-sided module startup advantage; measured RSS is shared.
searchDocuments(root,cases[0].q);searchLexicalHybrid(root,cases[0].q);
const baseline=run('BM25_DEFAULT',searchDocuments);
const hybrid=run('LEXICAL_BIGRAM_RRF_EXPERIMENT',searchLexicalHybrid);
console.log(JSON.stringify({
 environment:{node:process.version,platform:process.platform,arch:process.arch},
 scope:'SYNTHETIC_2_DOCUMENTS_NO_SEMANTIC_OR_DENSE_BENCHMARK',
 caveat:'Tiny labeled fixture, in-process end-to-end including manifest/hash reads; deltas not peak memory, order-dependent and not quality generalization',
 baseline,hybrid
},null,2));
