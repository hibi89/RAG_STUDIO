/** P2.1: fully local, evidence-gated query routing; no model, generated SQL or remote I/O.
 * The small intent vocabulary is deliberate: unsupported questions must abstain.
 */
import {loadPackage, fail} from './validate.mjs';
import {withReadOnlySales} from './mixed-question.mjs';
import {searchDocuments} from './document-search.mjs';

const MAX_DOC_LINES = 10_000;
const MAX_LINE = 4_096;
const RETURNS = /반품|환불/u;
const RETURN_SCOPE = /신청|기간|규정|정책|가능|이내|언제/u;
const SHIPPING = /(?:배송|발송)\s*준비/u;
const UNSUPPORTED_FEES = /(?:배송|발송)\s*(?:비|비용|료|요금)|(?:반품|환불)\s*(?:금액|비|비용|수수료)/u;
const SALES = /매출|매상|주문\s*(?:건수|수)|판매\s*수량/u;

function intents(question) {
  return Object.freeze({
    sales: SALES.test(question),
    returns: RETURNS.test(question) && RETURN_SCOPE.test(question),
    shipping: SHIPPING.test(question),
  });
}

// Scan all approved TXT lines, not merely the top N hits, to avoid missing
// contradictory periods when BM25 truncates its result list.
function verifiedLines(pkg) {
  const result=[];
  for (const document of pkg.manifest.documents) {
    const f=pkg.fileMap.get(document.file_id);
    if(f?.kind!=='document'||f.import_status!=='ACCEPTED'||!f.relative_path.toLowerCase().endsWith('.txt')) continue;
    const txt=pkg.textMap.get(f.file_id);
    if(typeof txt!=='string') continue;
    const lines=txt.replace(/\r\n/g,'\n').split('\n');
    for(let index=0;index<lines.length;index++) {
      if(result.length>=MAX_DOC_LINES) fail('router: maximum TXT line count exceeded');
      const quote=lines[index].trim();
      if(quote.length>MAX_LINE) fail('router: document line too long');
      if(quote) result.push({document_id:document.document_id,file_id:f.file_id,source_title:document.source_title,line:index+1,quote});
    }
  }
  return result;
}

function periods(line, domain) {
  // The recognized claim is intentionally narrow. Unfamiliar policy forms abstain.
  if (domain==='returns' && (!RETURNS.test(line) || !/신청|가능/u.test(line))) return [];
  if (domain==='shipping' && (!/배송\s*준비/u.test(line) || !/시작/u.test(line))) return [];
  const re=domain==='returns'?/(\d{1,3})\s*일\s*이내/gu:/(\d{1,3})\s*영업일\s*이내/gu;
  return [...line.matchAll(re)].map(m=>Number(m[1]));
}
function source(c, unit, number) {
  return {...c, claim_kind:unit, period:number};
}
function evidenceFor(pkg, kind) {
  const items=verifiedLines(pkg);
  return items.flatMap(c=>periods(c.quote,kind).map(n=>source(c,kind==='returns'?'calendar_days':'business_days',n)));
}
function uniqueCitationKey(e) {return `${e.document_id}\u0000${e.file_id}\u0000${e.line}`;}
function distinctSources(hits) {
  const map=new Map();for(const h of hits)map.set(`${uniqueCitationKey(h)}\u0000${h.period}`,h);
  return [...map.values()].sort((a,b)=>a.document_id.localeCompare(b.document_id)||a.line-b.line);
}

function computeSales(root) {
  return withReadOnlySales(root,({db,totals,expected})=>({
    engine:'node:sqlite (in-memory)', query_id:'fixed_read_only_sales_totals',
    dataset_file_id:expected.dataset_file_id,
    orders:totals.orders, units:String(totals.units), revenue_krw:String(totals.revenue_krw),
    row_evidence:db.prepare('SELECT order_id, csv_line, amount_krw FROM sales ORDER BY csv_line').all().map(r=>({
      file_id:expected.dataset_file_id,order_id:r.order_id,csv_line:r.csv_line,amount_krw:String(r.amount_krw)
    }))
  }));
}

/** Bounded synthetic-domain router. Never answers a partially supported multi-part question. */
export function routeQuestion(root, question) {
  if(typeof question!=='string'||!question.trim()||question.length>500) fail('router: question must be 1..500 characters');
  // Fees/refund amounts are outside the time-period vocabulary. Abstain
  // entirely instead of answering only a supported fragment of a mixed query.
  if(UNSUPPORTED_FEES.test(question)) return {
    status:'NOT_SUPPORTED',answer:null,
    reason:'Fees and refund amounts are outside the supported synthetic intents'
  };
  const request=intents(question);
  if(!request.sales&&!request.returns&&!request.shipping){
    return {status:'NOT_SUPPORTED',answer:null,reason:'Supported: sales total, return period, shipping preparation period',requested:request};
  }
  // Read and verify the *entire* package before any claim, even for a sales-only query.
  const pkg=loadPackage(root);
  const citations=[];
  const claims=[];
  for (const domain of ['returns','shipping']) {
    if(!request[domain]) continue;
    // Search establishes keyword-source linkage; deterministic period extraction
    // checks all approved TXT lines independently of result truncation.
    const canonical=domain==='returns'?'반품 신청 가능 기간':'배송 준비 시작 기간';
    const retrieved=searchDocuments(root,canonical,{limit:10});
    if(retrieved.status==='NO_EVIDENCE') return {status:'INSUFFICIENT_EVIDENCE',answer:null,reason:`No searchable ${domain} document`,requested:request};
    const facts=distinctSources(evidenceFor(pkg,domain));
    if(!facts.length) return {status:'INSUFFICIENT_EVIDENCE',answer:null,reason:`No explicit verified ${domain} fact`,requested:request};
    // Refuse contradictions even when the relevant line is below lexical top ten.
    if(new Set(facts.map(f=>f.period)).size!==1) {
      return {status:'POSSIBLE_CONFLICT',answer:null,reason:`Conflicting ${domain} period statements require human review`,requested:request,review_evidence:facts};
    }
    // At least one fact must also have *actual search evidence*, not just regex.
    const matched=new Set(retrieved.evidence.map(uniqueCitationKey));
    const linked=facts.filter(f=>matched.has(uniqueCitationKey(f)));
    if(!linked.length) return {status:'INSUFFICIENT_EVIDENCE',answer:null,reason:`No retrieved ${domain} fact with a verified citation`,requested:request};
    const best=linked[0];
    citations.push(best);
    if(domain==='returns') claims.push(`반품·환불 신청 기간: ${best.period}일 이내 (문서: ${best.document_id}, ${best.line}행)`);
    else claims.push(`배송 준비 시작: ${best.period}영업일 이내 (문서: ${best.document_id}, ${best.line}행)`);
  }
  let metric=null;
  if(request.sales) {
    metric=computeSales(root);
    claims.unshift(`매출 합계: ${Number(metric.revenue_krw).toLocaleString('ko-KR')}원, 주문 ${metric.orders}건, 판매 수량 ${metric.units}개 (원본 CSV 행 근거 포함)`);
  }
  return {
    status:'ANSWERED', kind:request.sales&&citations.length?'SQL_DOCUMENT':request.sales?'SQL_ONLY':'DOCUMENT_ONLY',
    answer:claims.join(' / '),requested:request,
    metric_evidence:metric,document_evidence:citations,
    limits:['synthetic test only','limited deterministic intents and period formats','no LLM, arbitrary SQL, PDF or vector search']
  };
}
