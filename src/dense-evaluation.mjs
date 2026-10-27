/** P5.24: evaluate retrieval provenance against a synthetic, author-labelled corpus.
 * No pretrained-model claims, no raw source in report, no model installation.
 */
import {performance} from 'node:perf_hooks';
export function summarizeDenseCases(cases,results){
 if(!Array.isArray(cases)||!Array.isArray(results)||
   cases.length!==132||results.length!==132)
   throw Error('P524_EXPECTED_132_CASES');
 const families={},latencies=[],counter=new Set();
 for(let i=0;i<cases.length;i++){
  const sample=cases[i],row=results[i];
  if(!sample||typeof sample.family!=='string'||
    typeof sample.question!=='string'||!row||
    typeof row.elapsed_ms!=='number'||!Number.isFinite(row.elapsed_ms)||row.elapsed_ms<0)
    throw Error('P524_INVALID_BENCHMARK');
  const bucket=families[sample.family]??={questions:0,hit_1:0,hit_3:0,false_positives:0};
  bucket.questions++;
  const evidence=row.result?.evidence;
  if(!Array.isArray(evidence)||!['NO_EVIDENCE','CANDIDATES_ONLY'].includes(row.result?.status))
    throw Error('P524_RESULT_NOT_DENSE_CANDIDATES');
  if(evidence.length>3)throw Error('P524_TOO_MANY_EVIDENCE');
  for(const c of evidence){
   if(typeof c.document_id!=='string'||!/^document-(?:ko|en)-\d{2}$/.test(c.document_id)||
      !Number.isInteger(c.line)||c.line<1)
     throw Error('P524_CITATION_INVALID');
  }
  if(sample.expected===null){
   if(sample.family!=='NEGATIVE')throw Error('P524_NEGATIVE_FAMILY_INVALID');
   if(evidence.length)bucket.false_positives++;
  }else{
   if(evidence[0]?.document_id===sample.expected)bucket.hit_1++;
   if(evidence.some(e=>e.document_id===sample.expected))bucket.hit_3++;
  }
  latencies.push(row.elapsed_ms);
  counter.add(sample.id);
 }
 if(counter.size!==132||Object.keys(families).sort().join(',')!==
   'EN_SAME,EN_TO_KO,KO_SAME,KO_TO_EN,NEGATIVE')
   throw Error('P524_FAMILY_OR_ID_MISMATCH');
 const p=latencies.sort((a,b)=>a-b),quantile=q=>Number(p[Math.ceil(q*p.length)-1].toFixed(3));
 return {schema:'P524_PRETRAINED_DENSE_OPTIN_EVALUATION',
   source:'AUTHOR_LABELLED_SYNTHETIC_NOT_INDEPENDENT_GOLD',
   questions:132,positive_questions:120,negative_questions:12,
   families,latency_median_ms:quantile(.5),latency_p95_ms:quantile(.95),
   quality_gate:'REQUIRES_INDEPENDENT_GOLD_AND_NEGATIVE_ABSTENTION',
   production_ready:false};
}
export async function runDenseCases(cases,search){
 if(typeof search!=='function')throw Error('P524_SEARCH_FUNCTION_REQUIRED');
 const results=[];
 for(const sample of cases){
  const begin=performance.now();
  const result=await search(sample.question);
  results.push({result,elapsed_ms:performance.now()-begin});
 }
 return summarizeDenseCases(cases,results);
}
