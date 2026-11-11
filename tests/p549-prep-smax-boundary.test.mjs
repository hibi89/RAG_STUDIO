import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {verifyRagPrepSmaxBoundary} from '../src/prep-smax-boundary.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const salesCsv=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/sales.csv',import.meta.url));
const salesV1=fileURLToPath(new URL('../fixtures/smax_p42/synthetic_v1.json',import.meta.url));
const basicCsv=fileURLToPath(new URL('../fixtures/smax_v1_boundary/source.csv',import.meta.url));
const basicV1=fileURLToPath(new URL('../fixtures/smax_v1_boundary/unapproved.json',import.meta.url));
const digest=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const fixture=(csv=salesCsv,v1=salesV1)=>{
 const bytes=fs.readFileSync(csv),pkg=JSON.parse(fs.readFileSync(v1,'utf8'));
 const draft={contract:'RAG_PREP_MAPPING_DRAFT_V1',source_sha256:digest(bytes),
  requested_mapping:structuredClone(pkg.fields)};
 return {bytes,pkg,draft,review:inspectCsvBytes(bytes)};
};
const temp=t=>{const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p549-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));return folder;};

test('P5.49 public synthetic SMAX V1 fields, mapping SHA and actual sales CSV reconcile',()=>{
 const {bytes,pkg,draft,review}=fixture();
 const r=verifyRagPrepSmaxBoundary(review,draft,pkg,bytes);
 assert.equal(r.contract,'RAG_PREP_SMAX_BOUNDARY_V1');
 assert.equal(r.status,'REVIEW_HOLD');
 assert.equal(r.source_sha256,digest(bytes));
 assert.equal(r.preview_status,'CALCULATED_PREVIEW_NOT_APPROVED');
 assert.deepEqual([r.provisional_orders,r.provisional_units,r.provisional_revenue_krw],[6,'10','157000']);
 assert.equal(r.row_lineage_verified,true);
 assert.deepEqual([r.approval,r.smax_native_approved,r.customer_data_approved,r.ax_package_created,r.sqlite_imported,r.remote_upload],
  ['NOT_GRANTED',false,false,false,false,false]);
});
test('P5.49 exact mapping required: altered field keys or sources are blocked',()=>{
 for(const edit of [x=>x.draft.requested_mapping[0].key='different_key',
  x=>x.draft.requested_mapping[0].source='sku',
  x=>x.draft.requested_mapping[0].required=false,
  x=>x.draft.requested_mapping[2].type='decimal']){
  const x=fixture();edit(x);
  assert.throws(()=>verifyRagPrepSmaxBoundary(x.review,x.draft,x.pkg,x.bytes));
 }
});
test('P5.49 stale CSV and untrusted V1 self-approval are rejected',()=>{
 for(const edit of [x=>{x.bytes=Buffer.from(x.bytes);x.bytes[30]^=1;},
  x=>{x.pkg.approval='GRANTED';},
  x=>{x.pkg.quality.input_rows=0;},
  x=>{x.pkg.source.headers[0]='forged';}]){
  const x=fixture();edit(x);
  assert.throws(()=>verifyRagPrepSmaxBoundary(x.review,x.draft,x.pkg,x.bytes));
 }
});
test('P5.49 noncanonical 3-column producer contract remains review only, no sales claim',()=>{
 const x=fixture(basicCsv,basicV1),r=verifyRagPrepSmaxBoundary(x.review,x.draft,x.pkg,x.bytes);
 assert.equal(r.status,'REVIEW_HOLD');assert.equal(r.source_rows,2);
 assert.equal(r.preview_status,'ROW_VALUES_UNVERIFIED');
 assert.equal(r.provisional_revenue_krw,null);
 assert.equal(r.row_lineage_verified,false);
 assert.equal(r.public_v1_shape_verified,true);
});
test('P5.49 source quality issues force preview HOLD without import',()=>{
 const x=fixture();x.review.total_issues=1;
 const r=verifyRagPrepSmaxBoundary(x.review,x.draft,x.pkg,x.bytes);
 assert.equal(r.preview_status,'MAPPING_OR_SOURCE_QUALITY_REVIEW');
 assert.equal(r.provisional_orders,null);assert.equal(r.ax_package_created,false);
});
test('P5.49 API does not mutate any review, CSV, mapping or SMAX JSON inputs',()=>{
 const x=fixture(),a=Buffer.from(x.bytes),b=structuredClone(x.draft),c=structuredClone(x.pkg),d=structuredClone(x.review);
 verifyRagPrepSmaxBoundary(x.review,x.draft,x.pkg,x.bytes);
 assert.deepEqual(x.bytes,a);assert.deepEqual(x.draft,b);assert.deepEqual(x.pkg,c);assert.deepEqual(x.review,d);
});
test('P5.49 CLI reads three local sources and returns aggregate only, never rows/paths',t=>{
 const x=fixture(),dir=temp(t),draftFile=path.join(dir,'mapping.json');
 fs.writeFileSync(draftFile,JSON.stringify(x.draft));
 const before=[fs.readFileSync(salesCsv),fs.readFileSync(salesV1),fs.readFileSync(draftFile)];
 const out=spawnSync(process.execPath,['src/prep-smax-boundary-cli.mjs',salesCsv,draftFile,salesV1],
  {cwd:root,encoding:'utf8',timeout:15000});
 assert.equal(out.status,0,out.stderr);
 const r=JSON.parse(out.stdout);assert.equal(r.provisional_revenue_krw,'157000');
 assert.equal(r.status,'REVIEW_HOLD');
 assert.doesNotMatch(out.stdout+out.stderr,/O-1001|N-01|sales\.csv|mapping\.json|rag-p549-|synthetic_v1/);
 assert.deepEqual([fs.readFileSync(salesCsv),fs.readFileSync(salesV1),fs.readFileSync(draftFile)],before);
});
test('P5.49 CLI rejects stale draft, invalid JSON and no args without leaking data',t=>{
 const x=fixture(),dir=temp(t),draftFile=path.join(dir,'mapping.json');
 fs.writeFileSync(draftFile,JSON.stringify({...x.draft,source_sha256:'0'.repeat(64)}));
 for(const args of [[salesCsv,draftFile,salesV1],[],[salesCsv,draftFile]]){
  const out=spawnSync(process.execPath,['src/prep-smax-boundary-cli.mjs',...args],
   {cwd:root,encoding:'utf8',timeout:15000});
  assert.equal(out.status,1);
  assert.deepEqual(JSON.parse(out.stdout),{status:'PREP_SMAX_BOUNDARY_BLOCKED',ax_package_created:false});
  assert.doesNotMatch(out.stdout+out.stderr,/sales\.csv|rag-p549-|mapping\.json|O-1001/);
 }
});
test('P5.49 CLI refuses source symlinks as untrusted input',t=>{
 const x=fixture(),dir=temp(t),alias=path.join(dir,'alias.csv'),draftFile=path.join(dir,'mapping.json');
 fs.writeFileSync(draftFile,JSON.stringify(x.draft));
 try{fs.symlinkSync(salesCsv,alias);}catch{return t.skip('symlink unavailable');}
 const out=spawnSync(process.execPath,['src/prep-smax-boundary-cli.mjs',alias,draftFile,salesV1],
  {cwd:root,encoding:'utf8',timeout:15000});
 assert.equal(out.status,1);
 assert.deepEqual(JSON.parse(out.stdout),{status:'PREP_SMAX_BOUNDARY_BLOCKED',ax_package_created:false});
});
