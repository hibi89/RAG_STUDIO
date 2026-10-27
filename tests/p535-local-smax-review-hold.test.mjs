import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {stageLocalSmaxReview} from '../src/local-smax-review-hold.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url));
const fixture=JSON.parse(fs.readFileSync(path.join(repo,'fixtures/smax_p42/synthetic_v1.json'),'utf8'));
const csv=fs.readFileSync(path.join(repo,'fixtures/ax_multi_doc_v0/sales.csv'));
const doc=fs.readFileSync(path.join(repo,'fixtures/ax_multi_doc_v0/returns_policy.txt'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function make(t,transform){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p535-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const json=path.join(dir,'LOCAL_SECRET_V1.json'),source=path.join(dir,'LOCAL_SECRET_source.csv'),policy=path.join(dir,'LOCAL_SECRET_policy.txt');
 const pkg=structuredClone(fixture),raw=Buffer.from(csv),policyBytes=Buffer.from(doc);
 if(transform)transform({pkg,raw,policyBytes,dir});
 fs.writeFileSync(json,JSON.stringify(pkg),{flag:'wx'});
 fs.writeFileSync(source,raw,{flag:'wx'});
 fs.writeFileSync(policy,policyBytes,{flag:'wx'});
 return {dir,json,source,policy,paths:{jsonPath:json,csvPath:source,documentPath:policy}};
}
test('P5.35 explicit three-file local stage always REVIEW_HOLD with verified provenance, no AX/SQLite',t=>{
 const x=make(t),old=[fs.readFileSync(x.json),fs.readFileSync(x.source),fs.readFileSync(x.policy)];
 const report=stageLocalSmaxReview(x.paths);
 assert.equal(report.contract,'RAG_LOCAL_SMAX_REVIEW_HOLD_V1');
 assert.equal(report.status,'REVIEW_HOLD');
 assert.equal(report.sales_preview_status,'CALCULATED_PREVIEW_NOT_APPROVED');
 assert.equal(report.source_provenance,'ORIGINAL_CSV_DIGEST_VERIFIED');
 assert.equal(report.source_sha256,hash(old[1]));
 assert.equal(report.source_rows,6);assert.equal(report.mapped_columns,5);
 assert.equal(report.provisional_revenue_krw,'157000');
 assert.equal(report.provisional_units,'10');
 assert.equal(report.provisional_orders,6);
 assert.equal(report.document.sha256,hash(old[2]));
 assert.ok(report.document.line_count>=2);
 for(const prop of ['ax_package_created','sqlite_imported','document_indexed',
   'authenticated_reviewer','source_rights_verified','smax_native_approved',
   'customer_data_approved','remote_upload','source_files_modified'])assert.equal(report[prop],false);
 assert.equal(Object.isFrozen(report),true);
 assert.equal(Object.isFrozen(report.document),true);
 assert.doesNotMatch(JSON.stringify(report),/LOCAL_SECRET|O-1001|반품 신청/);
 assert.deepEqual([fs.readFileSync(x.json),fs.readFileSync(x.source),fs.readFileSync(x.policy)],old);
 assert.deepEqual(fs.readdirSync(x.dir).sort(),['LOCAL_SECRET_V1.json','LOCAL_SECRET_policy.txt','LOCAL_SECRET_source.csv']);
});
test('P5.35 valid NON-hardcoded sale remains a provisional unapproved review',t=>{
 const x=make(t,({pkg,raw})=>{
  const before=Buffer.from('24000'),at=raw.indexOf(before);
  assert.ok(at>=0);
  raw.set(Buffer.from('25000'),at);
  const amount=raw.indexOf(Buffer.from('24000'),at+before.length);
  assert.ok(amount>=0);raw.set(Buffer.from('25000'),amount);
  pkg.source.sha256=hash(raw);
  pkg.rows[1].source_cells[3]='25000';pkg.rows[1].source_cells[4]='25000';
  pkg.rows[1].values.unit_price_krw='25000';pkg.rows[1].values.amount_krw='25000';
 });
 const result=stageLocalSmaxReview(x.paths);
 assert.equal(result.status,'REVIEW_HOLD');
 assert.equal(result.provisional_revenue_krw,'158000');
 assert.equal(result.customer_data_approved,false);
 assert.equal(result.sqlite_imported,false);
});
test('P5.35 any row needing review holds and suppresses all totals',t=>{
 const x=make(t,({pkg})=>{
  const issue={field:'quantity',code:'INVALID_INTEGER'};
  pkg.rows[0].issues=[issue];pkg.rows[0].status='NEEDS_REVIEW';
  pkg.review_queue=[{source_record:2,issues:[issue]}];
  pkg.quality.review_rows=1;pkg.quality.invalid_cells=1;
 });
 const r=stageLocalSmaxReview(x.paths);
 assert.equal(r.status,'REVIEW_HOLD');assert.equal(r.rows_needing_review,1);
 assert.equal(r.sales_preview_status,'REVIEW_HOLD');
 assert.equal(r.provisional_revenue_krw,null);
 assert.equal(r.provisional_units,null);
});
test('P5.35 stale or forged source checksum is blocked',t=>{
 const x=make(t);
 fs.appendFileSync(x.source,'X');
 assert.throws(()=>stageLocalSmaxReview(x.paths),{code:'LOCAL_SMAX_REVIEW_BLOCKED'});
});
test('P5.35 forged producer approval is blocked',t=>{
 const x=make(t,({pkg})=>{pkg.approval='GRANTED';});
 assert.throws(()=>stageLocalSmaxReview(x.paths));
});
test('P5.35 invalid arithmetical amount remains blocked even with consistent JSON and source checksum',t=>{
 const x=make(t,({pkg,raw})=>{
  const i=raw.indexOf(Buffer.from('30000'));assert.ok(i>=0);
  raw.set(Buffer.from('30001'),i);
  pkg.source.sha256=hash(raw);
  pkg.rows[0].source_cells[4]='30001';pkg.rows[0].values.amount_krw='30001';
 });
 assert.throws(()=>stageLocalSmaxReview(x.paths));
});
test('P5.35 malformed, huge, binary and empty documents cannot be staged',t=>{
 const x=make(t);
 for(const value of [Buffer.from([0xff,0xfe]),Buffer.from(''),Buffer.alloc(256*1024+1,65),Buffer.from('safe\u0000no')]){
  fs.writeFileSync(x.policy,value);
  assert.throws(()=>stageLocalSmaxReview(x.paths));
 }
});
test('P5.35 duplicate file selection, wrong format, and missing absolute paths refused',t=>{
 const x=make(t);
 assert.throws(()=>stageLocalSmaxReview({...x.paths,documentPath:x.source}));
 assert.throws(()=>stageLocalSmaxReview({...x.paths,jsonPath:'relative.json'}));
 const wrong=path.join(x.dir,'policy.pdf');fs.copyFileSync(x.policy,wrong);
 assert.throws(()=>stageLocalSmaxReview({...x.paths,documentPath:wrong}));
});
test('P5.35 direct source symlinks and ancestor directory symlink refused where supported',t=>{
 const x=make(t),link=path.join(x.dir,'link-policy.txt');
 try{fs.symlinkSync(x.policy,link,'file');}catch{t.skip('Windows symlink permissions unavailable');return;}
 assert.throws(()=>stageLocalSmaxReview({...x.paths,documentPath:link}));
 const ancestor=path.join(x.dir,'linked-directory');
 try{fs.symlinkSync(x.dir,ancestor,'dir');}catch{return;}
 assert.throws(()=>stageLocalSmaxReview({...x.paths,documentPath:path.join(ancestor,'LOCAL_SECRET_policy.txt')}));
});
test('P5.35 hardlink alias of selected original rejected',t=>{
 const x=make(t),alt=path.join(x.dir,'duplicate-policy.md');
 try{fs.linkSync(x.policy,alt);}catch{t.skip('hardlinks unsupported');return;}
 assert.throws(()=>stageLocalSmaxReview({...x.paths,documentPath:alt}).source_rows, {code:'LOCAL_SMAX_REVIEW_BLOCKED'});
});
test('P5.35 local CLI return contains no filename, original cells or document text',t=>{
 const x=make(t);
 const r=spawnSync(process.execPath,['src/local-smax-review-cli.mjs',x.json,x.source,x.policy],
   {cwd:repo,encoding:'utf8',timeout:12000});
 assert.equal(r.status,0,r.stderr);
 const parsed=JSON.parse(r.stdout);
 assert.equal(parsed.status,'REVIEW_HOLD');
 assert.doesNotMatch(r.stdout+r.stderr,/LOCAL_SECRET|O-1001|반품 신청/u);
 const invalid=spawnSync(process.execPath,['src/local-smax-review-cli.mjs',x.json,x.source,x.source],
   {cwd:repo,encoding:'utf8',timeout:12000});
 assert.equal(invalid.status,1);
 assert.match(invalid.stderr,/LOCAL_SMAX_REVIEW_BLOCKED/);
 assert.doesNotMatch(invalid.stdout+invalid.stderr,/LOCAL_SECRET/u);
});
