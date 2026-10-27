/** P5.3: separate curated synthetic holdout, not an independent human accuracy audit.
 * The oracle is fixed *before* running the router. No customer data or external API.
 */
import {loadPackage} from './validate.mjs';
import {routeQuestion} from './evidence-router.mjs';
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const PINS=Object.freeze({source:'4d52fec36e88721e16404648088c66b5ba6bea3bf164c3b63ce32eaf9097fbea',
  returns:'2f822ed24ea201f10fe9772aaac6f153f9248f6d69d9b1265854b411f8b056a5',
  shipping:'465482ede3d1711ff6da882cdeeb1e269401bc6fe5dad5360c5aaf1f93f75c14'});
const expectedFiles=[['file-sales',PINS.source],['file-policy',PINS.returns],['file-shipping',PINS.shipping]];
function fail(code){throw Object.assign(new Error('Holdout gate refused'),{code});}
function validateGold(gold){
  if(!object(gold)||gold.schema_version!=='RAG_P53_HELDOUT_GOLD_V0'||
     gold.dataset!=='ax_heldout_v1'||!object(gold.oracle)||!Array.isArray(gold.items)||
     gold.items.length!==24)fail('HOLDOUT_GOLD_INVALID');
  const o=gold.oracle;
  if(o.project_id!=='synthetic-heldout-shop-002'||o.orders!==8||o.units!=='16'||
     o.revenue_krw!=='187000'||!exact(o.sales_source_lines,[2,3,4,5,6,7,8,9])||
     !exact(o.document_policies,[
       {document_id:'document-returns',file_id:'file-policy',line:2,period:11,claim_kind:'calendar_days'},
       {document_id:'document-shipping',file_id:'file-shipping',line:2,period:4,claim_kind:'business_days'}
     ]))fail('HOLDOUT_ORACLE_INVALID');
  const ids=new Set(),questions=new Set();
  for(const item of gold.items) {
    if(!object(item)||Object.keys(item).sort().join(',')!=='expected,id,question'||
       typeof item.id!=='string'||!/^h-[a-z-]+-[0-9]{2}$/.test(item.id)||
       typeof item.question!=='string'||!item.question.trim()||item.question.length>500||
       ids.has(item.id)||questions.has(item.question.trim())||
       !object(item.expected)||Object.keys(item.expected).sort().join(',')!=='document_ids,kind,status')
      fail('HOLDOUT_CASE_INVALID');
    ids.add(item.id);questions.add(item.question.trim());
    const e=item.expected;
    if(!Array.isArray(e.document_ids)||new Set(e.document_ids).size!==e.document_ids.length||
      e.document_ids.some(x=>!o.document_policies.some(d=>d.document_id===x))||
      (e.status==='NOT_SUPPORTED'?(e.kind!==null||e.document_ids.length>0):
       e.status!=='ANSWERED'||!['SQL_ONLY','DOCUMENT_ONLY','SQL_DOCUMENT'].includes(e.kind)||
       ((e.kind==='SQL_ONLY')!== (e.document_ids.length===0))||
       (e.kind==='DOCUMENT_ONLY'&&e.document_ids.length===0)))
      fail('HOLDOUT_EXPECTED_INVALID');
  }
}
function verifyIndependentSeed(pkg,gold){
  if(pkg.manifest.project_id!==gold.oracle.project_id||
     pkg.manifest.files.length!==3||
     expectedFiles.some(([id,sha])=>pkg.fileMap.get(id)?.sha256!==sha ||
       pkg.fileMap.get(id)?.import_status!=='ACCEPTED')||
     pkg.manifest.datasets.length!==1||pkg.manifest.datasets[0].row_count!==8||
     pkg.manifest.documents.length!==2)fail('HOLDOUT_SEED_INVALID');
  const source=pkg.textMap.get('file-sales');
  if(typeof source!=='string')fail('HOLDOUT_CSV_INVALID');
  const lines=source.trimEnd().split('\n');
  if(lines.length!==9 || lines[0]!=='order_id,sku,quantity,unit_price_krw,amount_krw')fail('HOLDOUT_CSV_INVALID');
  let units=0n,total=0n;
  const orderIds=new Set();
  for(let i=1;i<lines.length;i++){
    const cells=lines[i].split(',');
    if(cells.length!==5||!/^[A-Z]-[0-9]+$/.test(cells[0])||
      orderIds.has(cells[0])||cells.slice(2).some(x=>!/^(0|[1-9][0-9]*)$/.test(x)))
      fail('HOLDOUT_CSV_INVALID');
    orderIds.add(cells[0]);
    const qty=BigInt(cells[2]),price=BigInt(cells[3]),amount=BigInt(cells[4]);
    if(qty<=0n||qty*price!==amount)fail('HOLDOUT_CSV_INVALID');
    units+=qty;total+=amount;
  }
  if(orderIds.size!==gold.oracle.orders||String(units)!==gold.oracle.units||
     String(total)!==gold.oracle.revenue_krw)fail('HOLDOUT_ORACLE_SOURCE_MISMATCH');
  for(const d of gold.oracle.document_policies){
    const text=pkg.textMap.get(d.file_id);
    const line=text?.split('\n')[d.line-1]?.trim();
    if(typeof line!=='string'||!line.includes(String(d.period)+
      (d.claim_kind==='business_days'?'영업일':'일')+' 이내'))fail('HOLDOUT_DOCUMENT_INVALID');
  }
}
function correctResponse(response,expected,oracle,pkg){
  if(!object(response)||response.status!==expected.status)return false;
  if(expected.status==='NOT_SUPPORTED')return response.answer===null&&
    response.metric_evidence==null&&response.document_evidence==null;
  if(response.kind!==expected.kind||typeof response.answer!=='string'||!response.answer)return false;
  const numeric=expected.kind==='SQL_ONLY'||expected.kind==='SQL_DOCUMENT';
  if(numeric){
    const e=response.metric_evidence;
    if(!object(e)||e.orders!==oracle.orders||e.units!==oracle.units||
       e.revenue_krw!==oracle.revenue_krw||
       !exact(e.row_evidence?.map(x=>x.csv_line),oracle.sales_source_lines)||
       !Array.isArray(e.row_evidence))return false;
    let sum=0n;
    try{
      for(const row of e.row_evidence){
        if(row.file_id!=='file-sales'||!/^(0|[1-9][0-9]*)$/.test(row.amount_krw))return false;
        sum+=BigInt(row.amount_krw);
      }
      if(String(sum)!==oracle.revenue_krw)return false;
    }catch{return false;}
  }else if(response.metric_evidence!==null)return false;
  const citations=response.document_evidence;
  if(!Array.isArray(citations)||!exact(citations.map(x=>x.document_id),expected.document_ids))return false;
  for(const c of citations){
    const o=oracle.document_policies.find(x=>x.document_id===c.document_id);
    const content=pkg.textMap.get(o?.file_id);
    if(!o||c.file_id!==o.file_id||c.line!==o.line||c.period!==o.period||
      c.claim_kind!==o.claim_kind||c.quote!==content?.split('\n')[o.line-1]?.trim())return false;
  }
  return true;
}
/** Fixed holdout baseline; report contains only IDs and statuses, never source text. */
export function evaluateHeldout(root,gold,{answer=routeQuestion}={}){
  validateGold(gold);
  if(typeof root!=='string'||!root.trim()||typeof answer!=='function')fail('HOLDOUT_RUN_INVALID');
  const pkg=loadPackage(root);
  verifyIndependentSeed(pkg,gold);
  const results=gold.items.map(c=>{
    let actual='EXCEPTION',passed=false;
    try{
      const r=answer(root,c.question);
      actual=typeof r?.status==='string'?r.status:'MALFORMED';
      passed=correctResponse(r,c.expected,gold.oracle,pkg);
    }catch{}
    return Object.freeze({id:c.id,expected:c.expected.status,actual,passed});
  });
  const pass=results.filter(x=>x.passed).length;
  return Object.freeze({schema_version:'RAG_P53_HELDOUT_REPORT_V0',
    fixture:'ax_heldout_v1',total:results.length,pass,fail:results.length-pass,skipped:0,
    heldout_from_prior_fixture:true,independently_human_reviewed:false,
    readiness:pass===results.length?'SYNTHETIC_HELDOUT_PASS':'SYNTHETIC_HELDOUT_FAIL',results});
}
