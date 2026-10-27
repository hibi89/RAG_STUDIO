/** P5.0 synthetic-only, deterministic quality gate; not a customer accuracy claim.
 * No LLM, internet, writes, or real-data paths. Only caller-supplied fixture root.
 */
import {routeQuestion} from './evidence-router.mjs';

const expectedKeys=['status','kind','document_ids'];
const arrEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const own=(x,k)=>Object.hasOwn(x,k);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function checkGold(gold){
  if(!object(gold)||gold.schema_version!=='RAG_P5_GOLD_V0'||
     gold.fixture!=='ax_multi_doc_v0'||gold.scope!=='synthetic_read_only'||
     !object(gold.metric)||!object(gold.document_periods)||
     !Array.isArray(gold.items)||gold.items.length<1||gold.items.length>100)
    throw new Error('GOLD_SCHEMA_INVALID');
  if(!Number.isSafeInteger(gold.metric.orders)||gold.metric.orders<1||
     !/^[0-9]+$/.test(gold.metric.revenue_krw)||
     !/^[0-9]+$/.test(gold.metric.units)||
     !arrEqual(gold.metric.source_csv_lines,[2,3,4,5,6,7])||
     !Number.isSafeInteger(gold.document_periods['document-returns'])||
     !Number.isSafeInteger(gold.document_periods['document-shipping']))
    throw new Error('GOLD_METRIC_INVALID');
  const ids=new Set();
  for(const c of gold.items){
    if(!object(c)||Object.keys(c).sort().join(',')!=='expected,id,question'||
       typeof c.id!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(c.id)||
       ids.has(c.id)||typeof c.question!=='string'||
       !c.question.trim()||c.question.length>500||!object(c.expected)||
       Object.keys(c.expected).sort().join(',')!==[...expectedKeys].sort().join(','))
      throw new Error('GOLD_CASE_INVALID');
    ids.add(c.id);
    const e=c.expected;
    if(!['ANSWERED','NOT_SUPPORTED'].includes(e.status)||
       (e.status==='NOT_SUPPORTED'&&(e.kind!==null||!arrEqual(e.document_ids,[])))||
       (e.status==='ANSWERED'&&!['SQL_ONLY','DOCUMENT_ONLY','SQL_DOCUMENT'].includes(e.kind))||
       !Array.isArray(e.document_ids)||new Set(e.document_ids).size!==e.document_ids.length||
       e.document_ids.some(id=>!own(gold.document_periods,id))||
       (e.kind==='SQL_ONLY'&&e.document_ids.length!==0)||
       (e.kind==='DOCUMENT_ONLY'&&e.document_ids.length===0)||
       (e.kind==='SQL_DOCUMENT'&&e.document_ids.length===0))
      throw new Error('GOLD_EXPECTATION_INVALID');
  }
}
function metricOk(metric,gold){
  if(!object(metric)||metric.orders!==gold.metric.orders||
     metric.units!==gold.metric.units||metric.revenue_krw!==gold.metric.revenue_krw||
     !Array.isArray(metric.row_evidence)||!arrEqual(
       metric.row_evidence.map(row=>row.csv_line),gold.metric.source_csv_lines))
    return false;
  try{
    const sum=metric.row_evidence.reduce((n,row)=>{
      if(typeof row.file_id!=='string'||typeof row.order_id!=='string'||
         !/^(0|[1-9][0-9]*)$/.test(row.amount_krw))throw new Error('INVALID_ROW');
      return n+BigInt(row.amount_krw);
    },0n);
    return sum===BigInt(gold.metric.revenue_krw);
  }catch{return false;}
}
function caseOk(response,e,gold){
  if(!object(response)||response.status!==e.status)return false;
  if(e.status==='NOT_SUPPORTED')return response.answer===null&&
    response.metric_evidence==null&&response.document_evidence==null;
  if(response.kind!==e.kind||typeof response.answer!=='string'||!response.answer.trim())return false;
  const needsMetric=e.kind==='SQL_ONLY'||e.kind==='SQL_DOCUMENT';
  if(needsMetric?!metricOk(response.metric_evidence,gold):response.metric_evidence!==null)return false;
  const citations=response.document_evidence;
  if(!Array.isArray(citations)||!arrEqual(citations.map(x=>x.document_id),e.document_ids))return false;
  return citations.every(c=>typeof c.file_id==='string'&&c.line>=1&&
    typeof c.quote==='string'&&c.quote.length>0&&
    c.period===gold.document_periods[c.document_id]);
}
/** Never returns user questions, row values, or source document quotations. */
export function evaluateGold(root,gold,{answer=routeQuestion}={}){
  checkGold(gold);
  if(typeof root!=='string'||!root.trim()||typeof answer!=='function')
    throw new Error('GOLD_RUNNER_INVALID');
  const outcomes=gold.items.map(c=>{
    let passed=false,actual='EXCEPTION';
    try{
      const response=answer(root,c.question);
      actual=typeof response?.status==='string'?response.status:'MALFORMED';
      passed=caseOk(response,c.expected,gold);
    }catch{passed=false;}
    return Object.freeze({id:c.id,passed,expected:c.expected.status,actual});
  });
  const pass=outcomes.filter(r=>r.passed).length;
  return Object.freeze({
    schema_version:'RAG_P5_GOLD_REPORT_V0',fixture:'ax_multi_doc_v0',
    total:outcomes.length,pass,fail:outcomes.length-pass,skipped:0,
    readiness:pass===outcomes.length?'SYNTHETIC_BASELINE_PASS':'SYNTHETIC_BASELINE_FAIL',
    real_customer_accuracy_verified:false,results:outcomes
  });
}
