import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeLocalSelection} from '../src/local-smax-approval-wizard.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
function copies(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p537-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const paths=[
    ['fixtures/smax_p42/synthetic_v1.json','LOCAL_SECRET_v1.json'],
    ['fixtures/ax_multi_doc_v0/sales.csv','LOCAL_SECRET.csv'],
    ['fixtures/ax_multi_doc_v0/returns_policy.txt','LOCAL_SECRET.txt']
  ].map(([src,dest])=>{
    const p=path.join(dir,dest);
    fs.copyFileSync(path.join(ROOT,src),p);
    return p;
  });
  return {paths,baseline:paths.map(p=>fs.readFileSync(p))};
}
function execute(paths){
  return spawnSync(process.execPath,['src/local-smax-approval-wizard.mjs'],{
    cwd:ROOT,encoding:'utf8',timeout:16000,input:paths.join('\n')+'\n',windowsHide:true
  });
}
test('P5.37 path selection accepts only explicitly selected absolute file paths',()=>{
  const absolute=path.resolve(os.tmpdir(),'local-file.json');
  assert.equal(normalizeLocalSelection('  "'+absolute+'"  '),absolute);
  assert.equal(normalizeLocalSelection(absolute),absolute);
  for(const bad of ['','./relative.json','invalid"quoted.json','abc\u0000def',
    'a'.repeat(4097),'"unterminated','\u0007'])
    assert.throws(()=>normalizeLocalSelection(bad),{code:'LOCAL_SMAX_WIZARD_BLOCKED'});
});
test('P5.37 actual stdin path wizard runs HOLD checklist, no customer source output',t=>{
  const sample=copies(t);
  const r=execute(sample.paths.map(x=>'"'+x+'"'));
  assert.equal(r.status,0,r.stderr);
  const parsed=JSON.parse(r.stdout);
  assert.equal(parsed.status,'REVIEW_HOLD');
  assert.equal(parsed.promotion_status,'NOT_AUTHORIZED_FOR_AX_PROMOTION');
  assert.equal(parsed.review_items.length,10);
  assert.equal(parsed.sqlite_imported,false);
  assert.equal(parsed.ax_package_created,false);
  assert.deepEqual(sample.paths.map(x=>fs.readFileSync(x)),sample.baseline);
  assert.doesNotMatch(r.stdout+r.stderr,/LOCAL_SECRET|O-1001|157000|반품 신청/u);
});
test('P5.37 tampered original cannot produce approval readiness report',t=>{
  const sample=copies(t);
  fs.appendFileSync(sample.paths[1],'invalid');
  const r=execute(sample.paths);
  assert.equal(r.status,1);
  assert.equal(r.stdout,'');
  assert.match(r.stderr,/LOCAL_SMAX_WIZARD_BLOCKED/u);
  assert.doesNotMatch(r.stderr,/LOCAL_SECRET|O-1001|invalid/u);
});
test('P5.37 early EOF and relative paths fail closed',t=>{
  const sample=copies(t);
  for(const input of [sample.paths.slice(0,2),['./relative.json',...sample.paths.slice(1)]]){
    const r=execute(input);
    assert.equal(r.status,1);
    assert.equal(r.stdout,'');
    assert.match(r.stderr,/LOCAL_SMAX_WIZARD_BLOCKED/u);
  }
});
test('P5.37 direct wizard refuses all command arguments instead of expanding them',()=>{
  const r=spawnSync(process.execPath,['src/local-smax-approval-wizard.mjs','bad-path'],{
    cwd:ROOT,timeout:8000,encoding:'utf8',windowsHide:true
  });
  assert.equal(r.status,2);
  assert.equal(r.stdout,'');
  assert.match(r.stderr,/interactive only/u);
});
