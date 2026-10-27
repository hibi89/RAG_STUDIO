import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {evaluateHeldout} from '../src/heldout-eval.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_heldout_v1/',import.meta.url));
const goldPath=new URL('../fixtures/p53_heldout_gold.json',import.meta.url);
const fresh=()=>JSON.parse(fs.readFileSync(goldPath,'utf8'));
const originals=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
const hashes=()=>originals.map(x=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../fixtures/ax_heldout_v1/'+x,import.meta.url))).digest('hex'));
test('P5.3 separate 24-item fixture evaluates all independently fixed values and citations',()=>{
  const report=evaluateHeldout(root,fresh());
  assert.equal(report.total,24);assert.equal(report.pass,24,JSON.stringify(report.results.filter(x=>!x.passed)));
  assert.equal(report.fail,0);assert.equal(report.skipped,0);
  assert.equal(report.independently_human_reviewed,false);
  assert.equal(report.heldout_from_prior_fixture,true);
});
test('P5.3 the independent fixed source and authored question set are not the original 100-case gold set',()=>{
  const g=fresh();
  const old=JSON.parse(fs.readFileSync(new URL('../fixtures/p5_gold_v0.json',import.meta.url),'utf8'));
  assert.equal(g.oracle.revenue_krw,'187000');
  assert.equal(g.oracle.orders,8);assert.equal(g.oracle.units,'16');
  assert.equal(g.oracle.document_policies[0].period,11);
  assert.equal(g.oracle.document_policies[1].period,4);
  assert.notEqual(g.oracle.revenue_krw,old.metric.revenue_krw);
  const overlap=g.items.filter(c=>old.items.some(x=>x.question.trim()===c.question.trim()));
  assert.equal(overlap.length,0);
});
test('P5.3 wrong model answer, forged source citation and forged numeric value count as failures',()=>{
  const g=fresh();
  const deny=evaluateHeldout(root,g,{answer:()=>({status:'NOT_SUPPORTED',answer:null})});
  assert.ok(deny.fail>0);
  const forged=evaluateHeldout(root,g,{answer:()=>({status:'ANSWERED',kind:'SQL_DOCUMENT',answer:'forged',
    metric_evidence:{orders:6,units:'10',revenue_krw:'157000',row_evidence:[]},document_evidence:[]})});
  assert.ok(forged.fail>0);
});
test('P5.3 oracle tampering and duplicate questions fail before scoring',()=>{
  const wrong=fresh();wrong.oracle.revenue_krw='157000';
  assert.throws(()=>evaluateHeldout(root,wrong),x=>x.code==='HOLDOUT_ORACLE_INVALID');
  const bad=fresh();bad.items[1].question=bad.items[0].question;
  assert.throws(()=>evaluateHeldout(root,bad),x=>x.code==='HOLDOUT_CASE_INVALID');
});
test('P5.3 source fixture stays byte-identical, report does not reveal questions or policies',()=>{
  const initial=hashes();const report=evaluateHeldout(root,fresh());
  assert.deepEqual(hashes(),initial);
  const text=JSON.stringify(report);
  for(const sensitive of ['Q-2001','187000','11일 이내','4영업일 이내','/tmp/','반품 신청은']){
    assert.equal(text.includes(sensitive),false);
  }
});
