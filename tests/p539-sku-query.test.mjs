import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseFixedSkuIntent,answerFixedSkuQuestion} from '../src/sku-query.mjs';
import {routeQuestion} from '../src/evidence-router.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const ROOT=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const all='SKU별 매출 알려줘';
function isolated(t){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'p539-'));
 fs.cpSync(ROOT,tmp,{recursive:true});
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 return tmp;
}
test('P5.39 recognizes only fixed SKU syntax; historical unsupported or ambiguous stays denied',()=>{
 const valid=[
  ['SKU별 매출 알려줘','ALL_SKUS',undefined],
  ['SKU별 주문 건수 보여줘','ALL_SKUS',undefined],
  ['SKU별 판매 수량 알려줘','ALL_SKUS',undefined],
  ['SKU별 매출과 주문 건수, 판매 수량 알려줘','ALL_SKUS',undefined],
  ['SKU N-02 매출 알려줘','ONE_SKU','N-02'],
  ['sku n-01 주문 건수 보여줘?','ONE_SKU','N-01']
 ];
 for(const [question,kind,sku] of valid){
  const r=parseFixedSkuIntent(question);
  assert.equal(r?.kind,kind,question);assert.equal(r?.sku,sku,question);
 }
 for(const question of ['SKU별 매출?','SKU별 매출 집계','SKU별 재고 현황은?',
  'SKU N-02 매출만','SKU N-02 반품 기간 알려줘',
  'SKU N-02 매출 알려줘; DROP TABLE sales',
  'SKU N-02 매출 알려줘 그리고 배송비','SKU ../secret 매출 알려줘',
  'SKU N-02 매출 알려줘 내일','SKU N-02 매출 알려줘 지난주']){
  assert.equal(parseFixedSkuIntent(question),null,question);
  assert.equal(routeQuestion(ROOT,question).status,'NOT_SUPPORTED',question);
 }
});
test('P5.39 grouped fixed SQLite matches all three SKUs and original totals',()=>{
 const r=routeQuestion(ROOT,all),m=r.metric_evidence;
 assert.equal(r.status,'ANSWERED');assert.equal(r.kind,'SQL_ONLY');
 assert.equal(m.query_id,'fixed_grouped_sku_metrics');
 assert.equal(m.orders,6);assert.equal(m.units,'10');assert.equal(m.revenue_krw,'157000');
 assert.deepEqual(m.sku_totals.map(s=>[s.sku,s.orders,s.units,s.revenue_krw]),[
  ['N-01',2,'3','45000'],['N-02',2,'3','72000'],['N-03',2,'4','40000']
 ]);
 assert.deepEqual(m.row_evidence.map(x=>x.csv_line),[2,3,4,5,6,7]);
 assert.deepEqual(m.row_evidence.map(x=>x.sku),['N-01','N-02','N-01','N-03','N-02','N-03']);
 assert.equal(m.sku_totals.reduce((s,x)=>s+BigInt(x.revenue_krw),0n),157000n);
 assert.equal(m.sku_totals.reduce((s,x)=>s+BigInt(x.units),0n),10n);
 assert.equal(JSON.stringify(r).includes(ROOT),false);
});
test('P5.39 single SKU N-02 cites only CSV lines 3 and 6',()=>{
 const r=routeQuestion(ROOT,'SKU N-02 매출 알려줘');
 assert.equal(r.status,'ANSWERED');
 assert.equal(r.metric_evidence.query_id,'fixed_exact_sku_metrics');
 assert.equal(r.metric_evidence.revenue_krw,'72000');
 assert.equal(r.metric_evidence.orders,2);
 assert.equal(r.metric_evidence.units,'3');
 assert.deepEqual(r.metric_evidence.row_evidence.map(x=>x.csv_line),[3,6]);
 assert.ok(r.metric_evidence.row_evidence.every(x=>x.sku==='N-02'&&x.file_id==='file-sales'));
});
test('P5.39 unknown SKU returns no answer and never fabricates zero',()=>{
 const r=routeQuestion(ROOT,'SKU N-99 매출 알려줘');
 assert.equal(r.status,'INSUFFICIENT_EVIDENCE');
 assert.equal(r.answer,null);
 assert.equal(r.metric_evidence,undefined);
 assert.equal(JSON.stringify(r).includes(ROOT),false);
});
test('P5.39 altered or unapproved source is rejected before SQL answer',t=>{
 const root=isolated(t);fs.appendFileSync(path.join(root,'sales.csv'),'UNTRUSTED_PRIVATE_MARKER');
 assert.throws(()=>routeQuestion(root,all),/size|sha256/);
 const other=isolated(t),p=path.join(other,'manifest.json'),m=JSON.parse(fs.readFileSync(p,'utf8'));
 m.files.find(x=>x.file_id==='file-sales').import_status='NEEDS_REVIEW';
 m.processing_summary.accepted--;m.processing_summary.needs_review++;
 fs.writeFileSync(p,JSON.stringify(m));
 assert.throws(()=>routeQuestion(other,'SKU N-01 매출 알려줘'),/review/);
});
test('P5.39 global answer preserved and ambiguous SKU combinations never partially answered',()=>{
 assert.equal(routeQuestion(ROOT,'총 매출 알려줘').metric_evidence.revenue_krw,'157000');
 assert.equal(routeQuestion(ROOT,'SKU별 매출 알려줘 그리고 반품 기간?').status,'NOT_SUPPORTED');
 assert.equal(routeQuestion(ROOT,'SKU별 매출 알려줘 오늘').status,'NOT_SUPPORTED');
 assert.equal(routeQuestion(ROOT,'SKU N-01 매출 알려줘 반품 수수료').status,'NOT_SUPPORTED');
});
test('P5.39 source files remain unchanged byte for byte',()=>{
 const names=['sales.csv','manifest.json','returns_policy.txt','shipping_policy.txt'];
 const before=names.map(x=>fs.readFileSync(path.join(ROOT,x)));
 routeQuestion(ROOT,all);routeQuestion(ROOT,'SKU N-03 판매 수량 알려줘');
 names.forEach((x,i)=>assert.deepEqual(fs.readFileSync(path.join(ROOT,x)),before[i]));
});
test('P5.39 forged programmatic intent is rejected before executing any query',()=>{
 assert.throws(()=>answerFixedSkuQuestion(ROOT,{kind:'ONE_SKU',sku:"' OR 1=1 --"}),/SKU/);
 assert.throws(()=>answerFixedSkuQuestion(ROOT,{kind:'OTHER'}),/SKU/);
 assert.throws(()=>answerFixedSkuQuestion(ROOT,{kind:'ALL_SKUS',sku:'N-01'}),/SKU/);
});
test('P5.39 real localhost authenticated POST query returns verified row citations',async t=>{
 const server=createDashboardServer({packageRoot:ROOT});
 const base=await listenDashboard(server,0);
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const secret=dashboardLaunchUrl(server).split('#session=')[1];
 const body=JSON.stringify({question:'SKU N-02 주문 건수 알려줘'});
 const response=await fetch(base+'/api/query',{method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body});
 assert.equal(response.status,200);
 const r=await response.json();
 assert.equal(r.status,'ANSWERED');assert.equal(r.metric_evidence.revenue_krw,'72000');
 assert.deepEqual(r.metric_evidence.row_evidence.map(x=>x.csv_line),[3,6]);
 const anonymous=await fetch(base+'/api/query',{method:'POST',
  headers:{'Content-Type':'application/json'},body});
 assert.equal(anonymous.status,401);
});
