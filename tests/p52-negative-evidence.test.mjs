import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {evaluateNegativeEvidence} from '../src/negative-evidence-eval.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const originals=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
const digest=()=>originals.map(x=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../fixtures/ax_multi_doc_v0/'+x,import.meta.url))).digest('hex'));
test('P5.2 twenty negative/positive evidence scenarios are assessed with no skips',()=>{
  const result=evaluateNegativeEvidence(root);
  assert.equal(result.total,20);
  assert.equal(result.pass,20,JSON.stringify(result.results.filter(x=>!x.passed)));
  assert.equal(result.fail,0);
  assert.equal(result.skipped,0);
  assert.equal(result.readiness,'SYNTHETIC_NEGATIVE_GATE_PASS');
  assert.equal(result.customer_accuracy_verified,false);
  assert.equal(result.results[0].expected,'ANSWERED');
});
test('P5.2 outputs contain status/ID only, not original source text, questions or local paths',()=>{
  const result=evaluateNegativeEvidence(root);
  assert.equal(new Set(result.results.map(x=>x.id)).size,20);
  const text=JSON.stringify(result);
  for(const unsafe of ['총 매출','[SYNTHETIC]','returns_policy.txt','/tmp/','shipping_policy.txt','157000']){
    assert.equal(text.includes(unsafe),false,unsafe);
  }
});
test('P5.2 exact fixture bytes remain untouched after all mutants are evaluated',()=>{
  const before=digest();evaluateNegativeEvidence(root);assert.deepEqual(digest(),before);
});
test('P5.2 never reports successful evaluation for an invalid synthetic root',()=>{
  assert.throws(()=>evaluateNegativeEvidence(''),/SYNTHETIC_ROOT_REQUIRED/);
  assert.throws(()=>evaluateNegativeEvidence(root+'/not-a-directory'));
});
