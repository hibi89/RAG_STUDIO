import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {evaluateGold} from '../src/gold-eval.mjs';
import {routeQuestion} from '../src/evidence-router.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const file=new URL('../fixtures/p5_gold_v0.json',import.meta.url);
const fresh=()=>JSON.parse(fs.readFileSync(file,'utf8'));
test('P5 gold: all 24 synthetic supported/abstain examples must be correct',()=>{
  const before=fs.readFileSync(file),gold=fresh();
  const report=evaluateGold(root,gold);
  assert.equal(report.total,24);
  assert.equal(report.pass,24,JSON.stringify(report.results.filter(r=>!r.passed)));
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
