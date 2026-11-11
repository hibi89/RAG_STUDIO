import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {parseRagPrepDraft,readLocalRagPrepDraft,buildRagPrepReviewFromDraft} from '../src/prep-mapping-draft.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sample=Buffer.from('주문번호,quantity,amount_krw\nA-1,2,12.50\n','utf8');
const digest=crypto.createHash('sha256').update(sample).digest('hex');
const mapping=[{key:'order_id',source:'주문번호',type:'text',required:true},
 {key:'quantity',source:'quantity',type:'integer',required:true},
 {key:'amount_krw',source:'amount_krw',type:'decimal',required:true}];
const draft=()=>({contract:'RAG_PREP_MAPPING_DRAFT_V1',source_sha256:digest,requested_mapping:structuredClone(mapping)});
const encode=obj=>Buffer.from(JSON.stringify(obj),'utf8');
const makeFiles=t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p547-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const csv=path.join(dir,'confidential-source.csv'),json=path.join(dir,'mapping.json');
 fs.writeFileSync(csv,sample);fs.writeFileSync(json,encode(draft()));
 return {dir,csv,json};
};
test('P5.47 explicit source-bound user mapping remains review hold, never import',()=>{
 const review=inspectCsvBytes(sample), input=parseRagPrepDraft(encode(draft()));
 const plan=buildRagPrepReviewFromDraft(review,input);
 assert.equal(plan.status,'REVIEW_HOLD');assert.equal(plan.approval,'NOT_GRANTED');
 assert.equal(plan.source_sha256,digest);assert.equal(plan.requested_mapping.length,3);
 assert.equal(plan.blockers.includes('MAPPING_INCOMPLETE'),false);
 assert.deepEqual([plan.ax_package_created,plan.sqlite_imported,plan.remote_upload], [false,false,false]);
 assert.ok(plan.blockers.includes('SOURCE_RIGHTS_UNVERIFIED'));
});
test('P5.47 stale source digest refuses rather than reusing previous mapping',()=>{
 const d=draft(); d.source_sha256='0'.repeat(64);
 assert.throws(()=>buildRagPrepReviewFromDraft(inspectCsvBytes(sample),parseRagPrepDraft(encode(d))),/RAG_PREP_DRAFT_BLOCKED/);
});
test('P5.47 malformed UTF8, trailing JSON, oversize and forged flags are rejected',()=>{
 for(const bytes of [Buffer.from([0xff]),Buffer.from('{} junk'),Buffer.alloc(16385,32),Buffer.alloc(0)])
   assert.throws(()=>parseRagPrepDraft(bytes),/RAG_PREP_DRAFT_BLOCKED/);
 for(const change of [d=>d.approved=true,d=>d.customer_data_approved=true,
   d=>d.requested_mapping[0].approval='GRANTED',d=>d.contract='AX_DATA_PACKAGE_V0',
   d=>d.source_sha256='xyz',d=>d.requested_mapping={x:1}]){
   const d=draft();change(d);assert.throws(()=>parseRagPrepDraft(encode(d)),/RAG_PREP_DRAFT_BLOCKED/);
 }
});
test('P5.47 canonical mapping validator refuses duplicate, unsafe key and nonexistent header',()=>{
 for(const change of [d=>d.requested_mapping[1].source='주문번호',
  d=>d.requested_mapping[1].key='DROP TABLE',
  d=>d.requested_mapping[1].source='missing',d=>d.requested_mapping[1].type='script']){
  const d=draft();change(d);
  assert.throws(()=>buildRagPrepReviewFromDraft(inspectCsvBytes(sample),parseRagPrepDraft(encode(d))),/RAG_PREP_MAPPING_BLOCKED/);
 }
});
test('P5.47 type disagreement produces review blocker but no conversion',()=>{
 const d=draft();d.requested_mapping[1].type='boolean';
 const p=buildRagPrepReviewFromDraft(inspectCsvBytes(sample),parseRagPrepDraft(encode(d)));
 assert.ok(p.blockers.includes('TYPE_MISMATCH_REVIEW_REQUIRED'));
 assert.equal(p.sqlite_imported,false);
});
test('P5.47 original mapping data and review objects remain unmodified',()=>{
 const d=draft(),r=inspectCsvBytes(sample),db=structuredClone(d),rb=structuredClone(r);
 const p=buildRagPrepReviewFromDraft(r,d);
 assert.deepEqual(d,db);assert.deepEqual(r,rb);
 assert.doesNotMatch(JSON.stringify(p),/A-1|12\.50|confidential-source/);
});
test('P5.47 actual CLI reads CSV and JSON, prints no file path or private row',t=>{
 const {csv,json}=makeFiles(t), a=fs.readFileSync(csv),b=fs.readFileSync(json);
 const out=spawnSync(process.execPath,['src/prep-mapping-review-cli.mjs',csv,json],{cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(out.status,0,out.stderr);
 const p=JSON.parse(out.stdout);assert.equal(p.requested_mapping.length,3);
 assert.equal(p.status,'REVIEW_HOLD');
 assert.doesNotMatch(out.stdout+out.stderr,/confidential-source|mapping\.json|rag-p547-|A-1|12\.50/);
 assert.deepEqual(fs.readFileSync(csv),a);assert.deepEqual(fs.readFileSync(json),b);
});
test('P5.47 CLI blocks stale CSV, wrong arguments, malformed JSON without leaking sources',t=>{
 const {csv,json}=makeFiles(t);
 for(const mode of ['tamper','missing','invalid']){
  if(mode==='tamper') fs.writeFileSync(csv,'주문번호,quantity,amount_krw\nA-2,2,12.50\n');
  if(mode==='invalid') fs.writeFileSync(json,'{"untrusted":"secret-token-456"}');
  const args=mode==='missing'?[csv]:[csv,json];
  const out=spawnSync(process.execPath,['src/prep-mapping-review-cli.mjs',...args],{cwd:root,encoding:'utf8',timeout:10000});
  assert.equal(out.status,1);
  assert.deepEqual(JSON.parse(out.stdout),{status:'PREP_REVIEW_BLOCKED',ax_package_created:false,sqlite_imported:false,remote_upload:false});
  assert.doesNotMatch(out.stdout+out.stderr,/A-2|secret-token-456|confidential-source|rag-p547-/);
 }
});
test('P5.47 symlinked mapping JSON refused rather than followed',t=>{
 const {dir,json}=makeFiles(t), link=path.join(dir,'linked.json');
 try{fs.symlinkSync(json,link);}catch{return t.skip('symlink unavailable');}
 assert.throws(()=>readLocalRagPrepDraft(link),/RAG_PREP_DRAFT_BLOCKED/);
});
test('P5.47 local mapping file rejects missing, relative, and non-json paths',()=>{
 for(const x of ['mapping.json','/no/such/file.json','/tmp/file.txt',''])
  assert.throws(()=>readLocalRagPrepDraft(x),/RAG_PREP_DRAFT_BLOCKED/);
});
