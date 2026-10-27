import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {evaluateGold} from '../src/gold-eval.mjs';
import {routeQuestion} from '../src/evidence-router.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const file=new URL('../fixtures/p5_gold_v0.json',import.meta.url);
const fresh=()=>JSON.parse(fs.readFileSync(file,'utf8'));
test('P5 gold: all 100 synthetic supported/abstain examples must be correct',()=>{
  const before=fs.readFileSync(file),gold=fresh();
  const report=evaluateGold(root,gold);
  assert.equal(report.total,100);
  assert.equal(report.pass,100,JSON.stringify(report.results.filter(r=>!r.passed)));
  assert.equal(report.fail,0);
  assert.equal(report.skipped,0);
  assert.equal(report.readiness,'SYNTHETIC_BASELINE_PASS');
  assert.equal(report.real_customer_accuracy_verified,false);
  assert.deepEqual(fs.readFileSync(file),before);
});
test('P5 gold: unsupported fees never yield misleading partial sales or duration',()=>{
  for(const q of ['배송비가 얼마야?','환불 금액은 얼마야?','매출과 반품 배송비를 알려줘']){
    const r=routeQuestion(root,q);
    assert.equal(r.status,'NOT_SUPPORTED');
    assert.equal(r.answer,null);
  }
});
test('P5 gold: rejects duplicate case IDs, malformed expectations and wrong data',()=>{
  const dup=fresh();dup.items[1].id=dup.items[0].id;
  assert.throws(()=>evaluateGold(root,dup),/GOLD_CASE_INVALID/);
  const bad=fresh();bad.items[0].expected.kind='ARBITRARY_SQL';
  assert.throws(()=>evaluateGold(root,bad),/GOLD_EXPECTATION_INVALID/);
  const wrong=fresh();wrong.metric.revenue_krw='157001';
  assert.equal(evaluateGold(root,wrong).fail>0,true);
});
test('P5 gold: a wrong answer is a failed case; no unknown question leakage',()=>{
  const gold=fresh();
  const report=evaluateGold(root,gold,{answer:()=>({status:'NOT_SUPPORTED',answer:null})});
  assert.ok(report.fail>0);
  assert.ok(report.results.every(x=>!Object.hasOwn(x,'question')));
  assert.ok(!JSON.stringify(report).includes('배송비'));
});

test('P5.1 gold: 100 independent case IDs, distinct questions and expected category coverage',()=>{
  const gold=fresh(),ids=new Set(),questions=new Set(),counts={SQL_ONLY:0,DOCUMENT_ONLY:0,SQL_DOCUMENT:0,NOT_SUPPORTED:0};
  for(const c of gold.items){
    assert.ok(!ids.has(c.id));ids.add(c.id);
    assert.ok(!questions.has(c.question.normalize('NFKC').trim()));questions.add(c.question.normalize('NFKC').trim());
    const category=c.expected.status==='NOT_SUPPORTED'?'NOT_SUPPORTED':c.expected.kind;
    counts[category]++;
  }
  assert.equal(ids.size,100);
  assert.deepEqual(counts,{SQL_ONLY:12,DOCUMENT_ONLY:36,SQL_DOCUMENT:10,NOT_SUPPORTED:42});
});
test('P5.1 gold: compound near-misses require full abstention, never partial evidence',()=>{
  for(const q of [
    '이번 달 매출은?','SKU별 매출 집계','어제 주문 건수는?',
    '반품 신청 제외 상품은?','환불 신청 후 입금까지 며칠?',
    '배송준비 후 도착까지 시간은?','배송 준비 중 택배사 조회',
    '총 매출과 현재 재고를 알려줘','지난달 매출과 반품 기간은?',
    '주문 건수와 결제 취소 건수 알려줘','환불 정책과 교환 절차 알려줘',
    '매출과 배송 준비 기간, 배송 추적 정보 보여줘'
  ]){
    const r=routeQuestion(root,q);
    assert.equal(r.status,'NOT_SUPPORTED',q);
    assert.equal(r.answer,null,q);
    assert.equal(r.metric_evidence,undefined,q);
    assert.equal(r.document_evidence,undefined,q);
  }
});
test('P5.1 gold: ordinary supported combinations retain cited results',()=>{
  const r=routeQuestion(root,'매상·환불 신청 기간·배송 준비 시작을 요약');
  assert.equal(r.status,'ANSWERED');
  assert.equal(r.metric_evidence.revenue_krw,'157000');
  assert.deepEqual(r.document_evidence.map(x=>x.period),[7,2]);
});
