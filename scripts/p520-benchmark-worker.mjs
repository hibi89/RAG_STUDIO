/** Isolated Node process per retrieval mode + corpus scale for peak RSS evidence. */
import {performance} from 'node:perf_hooks';
import {makeCases} from './p520-corpus.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {searchLexicalHybrid} from '../src/lexical-hybrid.mjs';
const [root,countRaw,mode]=process.argv.slice(2),count=Number(countRaw);
if(!root||!Number.isInteger(count)||count<2||count>96||!['bm25','lexical_hybrid'].includes(mode))
 throw Error('BENCHMARK_ARGUMENTS_INVALID');
const search=mode==='bm25'?searchDocuments:searchLexicalHybrid;
const cases=makeCases(count);
const durations=[],byFamily={},memory=[];
let evaluated=0;
const before=process.cpuUsage(),wallStart=performance.now();
for(const item of cases){
 const t=performance.now();
 const result=search(root,item.question,{limit:3});
 durations.push(performance.now()-t);
 memory.push(process.memoryUsage().rss);
 const group=byFamily[item.family]??={cases:0,hits_at_1:0,hits_at_3:0,false_positive:0,reciprocal_rank_sum:0};
 group.cases++;
 const ranked=result.evidence??[];
 if(item.expected===null){
   if(result.status!=='NO_EVIDENCE'||ranked.length>0)group.false_positive++;
 }else{
   const index=ranked.findIndex(e=>e.document_id===item.expected);
   if(index===0)group.hits_at_1++;
   if(index>=0&&index<3)group.hits_at_3++;
   if(index>=0)group.reciprocal_rank_sum+=1/(index+1);
 }
 evaluated++;
}
function pct(values,p){const arr=[...values].sort((a,b)=>a-b);return Number(arr[Math.ceil(arr.length*p)-1].toFixed(3));}
const cpu=process.cpuUsage(before);
const measured=process.resourceUsage();
const maxRssBytes=process.platform==='linux'?measured.maxRSS*1024:null;
const summary={
 document_count:count,mode,queries:evaluated,positive:120,negative:12,
 recall_at_1:Object.values(byFamily).reduce((n,f)=>n+f.hits_at_1,0)/120,
 recall_at_3:Object.values(byFamily).reduce((n,f)=>n+f.hits_at_3,0)/120,
 mrr_at_3:Object.values(byFamily).reduce((n,f)=>n+f.reciprocal_rank_sum,0)/120,
 negative_false_positives:byFamily.out_of_scope.false_positive,
 breakdown:byFamily,
 elapsed_ms_median:pct(durations,0.5),
 elapsed_ms_p95:pct(durations,0.95),
 total_wall_ms:Number((performance.now()-wallStart).toFixed(2)),
 cpu_user_ms:Number((cpu.user/1000).toFixed(2)),
 cpu_system_ms:Number((cpu.system/1000).toFixed(2)),
 peak_rss_bytes:maxRssBytes,
 observed_rss_max_bytes:Math.max(...memory),
 end_heap_used_bytes:process.memoryUsage().heapUsed
};
console.log(JSON.stringify(summary));
