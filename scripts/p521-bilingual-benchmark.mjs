/** P5.21: authored bilingual labels, separate from previous identifier/typo P5.20 gold.
 * Pure local evaluation: does not install/download a model or switch user defaults.
 */
import {performance} from 'node:perf_hooks';
import {authoredCases,createBilingualCorpus} from './p521-bilingual-corpus.mjs';
import {searchDocuments} from '../src/document-search.mjs';
import {searchLexicalHybrid} from '../src/lexical-hybrid.mjs';
const corpus=createBilingualCorpus(),cases=authoredCases();
const engines=[['bm25',searchDocuments],['lexical_rrf',searchLexicalHybrid]];
function measure(name,search){
 const byFamily={},misfires=[];
 const times=[];const before=process.cpuUsage();
 for(const sample of cases){
  const start=performance.now();
  const result=search(corpus.root,sample.question,{limit:3});
  times.push(performance.now()-start);
  const bucket=byFamily[sample.family]??={total:0,hit_1:0,hit_3:0,
    unanswered:0,wrong_top1:0,false_positives:0};
  bucket.total++;
  const hits=result.evidence??[];
  if(sample.expected===null){
    if(result.status!=='NO_EVIDENCE'||hits.length)bucket.false_positives++;
  }else{
    if(hits[0]?.document_id===sample.expected)bucket.hit_1++;
    else{bucket.wrong_top1++;if(misfires.length<12)misfires.push({id:sample.id,
      expected:sample.expected,found:hits[0]?.document_id??null,status:result.status});}
    if(hits.slice(0,3).some(e=>e.document_id===sample.expected))bucket.hit_3++;
    if(!hits.length)bucket.unanswered++;
    // Every retrieved line must come from one of the current verified manifest sources.
    for(const evidence of hits){
      if(!/^document-(?:ko|en)-\d{2}$/.test(evidence.document_id)||
         evidence.line<1||!Number.isInteger(evidence.line))
         throw Error('UNTRUSTED_CITATION_SHAPE');
    }
  }
 }
 const millis=[...times].sort((a,b)=>a-b);
 const p=x=>Number(millis[Math.ceil(millis.length*x)-1].toFixed(3));
 const cpu=process.cpuUsage(before);
 return {engine:name,queries:cases.length,
  measures:byFamily,wrong_top1_examples:misfires,
  overall_hit_at_3:Object.entries(byFamily)
    .filter(([k])=>k!=='NEGATIVE').reduce((n,[,x])=>n+x.hit_3,0),
  total_positive:120,
  latency_median_ms:p(.5),latency_p95_ms:p(.95),
  cpu_user_ms:Number((cpu.user/1000).toFixed(3)),
  cpu_system_ms:Number((cpu.system/1000).toFixed(3))};
}
try{
 const enginesMeasured=engines.map(([name,fn])=>measure(name,fn));
 const summary={schema:'P521_BILINGUAL_SEMANTIC_GAP_V1',
  source:'HAND_AUTHORED_SYNTHETIC_NOT_EXTERNAL_HUMAN_GOLD',
  platform:process.platform,node:process.version,document_count:20,
  positive_questions:120,negative_questions:12,
  engines:enginesMeasured,model_feasibility:{
    installed_dense_model_in_this_project:false,
    model_weights_audited:false,
    model_license_reviewed:false,
    trained_cross_lingual_embeddings_tested:false,
    windows_three_pc_validated:false,
    conclusion:'NO_DENSE_MODEL_INSTALL_NO_DEFAULT_SWITCH'
  },
  limitations:[
    'Same-author synthetic questions, not an independently adjudicated held-out customer benchmark',
    '20 short synthetic operational documents with same-topic distractors',
    'Top-k document-id retrieval, not factual answer correctness or legal policy validation',
    'Lexical RRF only, not actual embedding-based dense/FAISS RAG',
    'Timings include manifest SHA checks and are single-run Linux figures'
  ]};
 console.log(JSON.stringify(summary,null,2));
}finally{corpus.close();}
