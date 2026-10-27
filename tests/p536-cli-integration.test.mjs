import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
function setup(t){
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'p536-'));
  t.after(()=>fs.rmSync(d,{recursive:true,force:true}));
  const sources=[['fixtures/smax_p42/synthetic_v1.json','LOCAL_SECRET_v1.json'],
    ['fixtures/ax_multi_doc_v0/sales.csv','LOCAL_SECRET.csv'],
    ['fixtures/ax_multi_doc_v0/returns_policy.txt','LOCAL_SECRET.txt']];
  const paths=sources.map(([from,name])=>{
    const target=path.join(d,name);fs.copyFileSync(path.join(root,from),target);return target;
  });
  return {paths,bytes:paths.map(x=>fs.readFileSync(x))};
}
test('P5.36 real CLI reopens synthetic originals but produces ONLY a non-approval plan',t=>{
  const s=setup(t);
  const r=spawnSync(process.execPath,['src/local-smax-approval-plan-cli.mjs',...s.paths],
    {cwd:root,encoding:'utf8',timeout:12000});
  assert.equal(r.status,0,r.stderr);
  const j=JSON.parse(r.stdout);
  assert.equal(j.status,'REVIEW_HOLD');
  assert.equal(j.review_items.length,10);
  assert.equal(j.unresolved_review_items,10);
  assert.equal(j.promotion_status,'NOT_AUTHORIZED_FOR_AX_PROMOTION');
  assert.equal(j.sqlite_imported,false);
  assert.doesNotMatch(r.stdout+r.stderr,/LOCAL_SECRET|157000|반품 신청/u);
  assert.deepEqual(s.paths.map(x=>fs.readFileSync(x)),s.bytes);
});
test('P5.36 real CLI rejects mutated synthetic source and leaks no paths or cells',t=>{
  const s=setup(t);
  fs.appendFileSync(s.paths[1],'INVALID');
  const r=spawnSync(process.execPath,['src/local-smax-approval-plan-cli.mjs',...s.paths],
    {cwd:root,encoding:'utf8',timeout:12000});
  assert.equal(r.status,1);
  assert.match(r.stderr,/LOCAL_SMAX_APPROVAL_PLAN_BLOCKED/u);
  assert.doesNotMatch(r.stdout+r.stderr,/LOCAL_SECRET|O-1001|반품 신청/u);
});
