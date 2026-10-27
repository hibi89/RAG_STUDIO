/** P5.39: fixed, source-cited SQLite SKU questions, never arbitrary SQL. */
import {fail} from './validate.mjs';
import {withReadOnlySales} from './mixed-question.mjs';

const GROUP=/^SKU별\s+(?:매출|주문\s*건수|판매\s*수량|매출과\s*주문\s*건수,\s*판매\s*수량)\s+(?:알려줘|보여줘)[?？]?$/iu;
const SINGLE=/^SKU\s+([A-Z0-9-]{1,40})\s+(?:매출|주문\s*건수|판매\s*수량)\s+(?:알려줘|보여줘)[?？]?$/iu;
const IDENTIFIER=/^[A-Z0-9-]{1,40}$/u;
const SQL_GROUP='SELECT sku, COUNT(*) AS orders, SUM(quantity) AS units, SUM(amount_krw) AS revenue_krw FROM sales GROUP BY sku ORDER BY sku ASC';
const SQL_ROWS='SELECT sku, order_id, csv_line, quantity, amount_krw FROM sales ORDER BY csv_line';

export function parseFixedSkuIntent(question){
 if(typeof question!=='string'||question.length>500)return null;
 if(GROUP.test(question))return Object.freeze({kind:'ALL_SKUS'});
 const m=SINGLE.exec(question);
 if(!m)return null;
 const sku=m[1].toUpperCase();
 return IDENTIFIER.test(sku)?Object.freeze({kind:'ONE_SKU',sku}):null;
}
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const reject=()=>fail('SKU: SQL aggregates differ from verified CSV');
/** Only fixed statements over already verified, approved synthetic AX rows. */
export function answerFixedSkuQuestion(root,intent){
 if(!intent||!['ALL_SKUS','ONE_SKU'].includes(intent.kind)||
   (intent.kind==='ONE_SKU'&&!IDENTIFIER.test(intent.sku))||
   (intent.kind==='ALL_SKUS'&&Object.hasOwn(intent,'sku')))
   fail('SKU: invalid fixed intent');
 return withReadOnlySales(root,({db,totals,expected})=>{
  const groups=db.prepare(SQL_GROUP).all();
  if(!groups.length||groups.length>100)reject();
  const sum={orders:0n,units:0n,revenue:0n};
  const map=new Map();
  for(const g of groups){
   if(typeof g.sku!=='string'||!IDENTIFIER.test(g.sku)||map.has(g.sku)||
     !safe(g.orders)||!safe(g.units)||!safe(g.revenue_krw))reject();
   const item=Object.freeze({sku:g.sku,orders:g.orders,units:String(g.units),revenue_krw:String(g.revenue_krw)});
   map.set(g.sku,item);
   sum.orders+=BigInt(g.orders);sum.units+=BigInt(g.units);sum.revenue+=BigInt(g.revenue_krw);
  }
  if(sum.orders!==BigInt(totals.orders)||sum.units!==BigInt(totals.units)||
    sum.revenue!==BigInt(totals.revenue_krw))reject();
  const selected=intent.kind==='ONE_SKU'?[map.get(intent.sku)].filter(Boolean):[...map.values()];
  if(!selected.length)return {status:'INSUFFICIENT_EVIDENCE',answer:null,
    reason:'Requested exact SKU not found in verified source'};
  const selectedIds=new Set(selected.map(x=>x.sku));
  const checked=new Map(selected.map(x=>[x.sku,{orders:0n,units:0n,revenue:0n}]));
  const rows=db.prepare(SQL_ROWS).all().filter(row=>selectedIds.has(row.sku));
  if(rows.length>5000)reject();
  const evidence=rows.map(row=>{
    if(!safe(row.csv_line)||row.csv_line<2||!safe(row.quantity)||!safe(row.amount_krw)||
       !IDENTIFIER.test(row.sku)||typeof row.order_id!=='string')reject();
    const acc=checked.get(row.sku);
    acc.orders++;acc.units+=BigInt(row.quantity);acc.revenue+=BigInt(row.amount_krw);
    return {file_id:expected.dataset_file_id,sku:row.sku,
      order_id:row.order_id,csv_line:row.csv_line,amount_krw:String(row.amount_krw)};
  });
  for(const item of selected){
    const x=checked.get(item.sku);
    if(x.orders!==BigInt(item.orders)||x.units!==BigInt(item.units)||
       x.revenue!==BigInt(item.revenue_krw))reject();
  }
  const orders=selected.reduce((a,x)=>a+BigInt(x.orders),0n);
  const units=selected.reduce((a,x)=>a+BigInt(x.units),0n);
  const revenue=selected.reduce((a,x)=>a+BigInt(x.revenue_krw),0n);
  const answers=selected.map(g=>'SKU '+g.sku+': 매출 '+
    Number(g.revenue_krw).toLocaleString('ko-KR')+'원, 주문 '+g.orders+
    '건, 판매 수량 '+g.units+'개');
  return {status:'ANSWERED',kind:'SQL_ONLY',answer:answers.join(' / '),
    requested:{sales:true,returns:false,shipping:false,sku_scope:intent.kind},
    metric_evidence:{engine:'node:sqlite (in-memory)',
      query_id:intent.kind==='ONE_SKU'?'fixed_exact_sku_metrics':'fixed_grouped_sku_metrics',
      dataset_file_id:expected.dataset_file_id,sku_scope:intent.kind,
      orders:Number(orders),units:String(units),revenue_krw:String(revenue),
      sku_totals:selected,row_evidence:evidence},
    document_evidence:[],
    limits:['synthetic test only','literal approved SKU source only',
      'fixed read-only SQL; no arbitrary SQL or customer data approval']};
 });
}
