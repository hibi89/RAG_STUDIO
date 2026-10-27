import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {aggregateSales} from '../src/summary.mjs';
import {loadPackage} from '../src/validate.mjs';
import {beginSyntheticExport,syntheticReviewPlan,confirmSyntheticExport,
  writeSyntheticAxBundle} from '../src/smax-synthetic-export.mjs';

const fixtures=new URL('../fixtures/ax_multi_doc_v0/',import.meta.url);
const v1URL=new URL('../fixtures/smax_p42/synthetic_v1.json',import.meta.url);
const source=fs.readFileSync(new URL('sales.csv',fixtures));
const policy=fs.readFileSync(new URL('returns_policy.txt',fixtures));
const prepared=()=>JSON.parse(fs.readFileSync(v1URL,'utf8'));
const start=()=>beginSyntheticExport(prepared(),source,policy);
const approve=h=>confirmSyntheticExport(h,h.review_challenge,syntheticReviewPlan(h));
function temp(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p42-synthetic-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 return {root:dir,target:path.join(dir,'new-ax-output')};
}
test('P4.2 begin binds a review-only challenge, not output authority',()=>{
 const h=start();
 assert.equal(h.status,'AWAITING_EXPLICIT_SYNTHETIC_CONFIRMATION');
 assert.equal(h.export_allowed,false);
 assert.equal(h.reviewer_identity_verified,false);
 assert.equal(h.source_rows,6);
});
test('P4.2 no review challenge means no bundle can be created',()=>{
 const h=start();
 assert.throws(()=>confirmSyntheticExport(h,null,syntheticReviewPlan(h)));
 assert.throws(()=>confirmSyntheticExport(h,'CONFIRM SYNTHETIC wrong',syntheticReviewPlan(h)));
});
test('P4.2 review plan specifies meaning, currency, units and all source lines',()=>{
 const h=start(),plan=syntheticReviewPlan(h);
 assert.deepEqual(plan.semantic_roles,['order_id','sku','quantity','unit_price_krw','amount_krw']);
 assert.deepEqual(plan.source_records,[2,3,4,5,6,7]);
 assert.equal(plan.currency,'KRW');
 assert.equal(plan.tax_basis,'TAX_NOT_APPLICABLE');
});
test('P4.2 forged handle never produces authority',()=>{
 const h=start();
 assert.throws(()=>syntheticReviewPlan({...h}));
 assert.throws(()=>confirmSyntheticExport({...h},h.review_challenge,syntheticReviewPlan(h)));
});
test('P4.2 plan exactness blocks extra keys and forged project ID',()=>{
 const h=start(),p=structuredClone(syntheticReviewPlan(h));p.admin_override=true;
 assert.throws(()=>confirmSyntheticExport(h,h.review_challenge,p));
 const q=structuredClone(syntheticReviewPlan(h));q.project_id='customer-records';
 assert.throws(()=>confirmSyntheticExport(h,h.review_challenge,q));
});
test('P4.2 currency, amount meaning and tax basis cannot be changed silently',()=>{
 for(const [k,v] of [['currency','USD'],['amount_unit','CENTS'],['amount_meaning','UNIT_PRICE'],['tax_basis','UNKNOWN']]){
  const h=start(),p=structuredClone(syntheticReviewPlan(h));p[k]=v;
  assert.throws(()=>confirmSyntheticExport(h,h.review_challenge,p),k);
 }
});
test('P4.2 incorrect row coverage or reordered semantic roles blocks export',()=>{
 for(const change of [p=>p.source_records=[2,3],p=>p.source_records=[3,2,4,5,6,7],
   p=>p.semantic_roles.reverse(),p=>p.decision='HOLD',p=>p.acknowledgement='YES']){
  const h=start(),p=structuredClone(syntheticReviewPlan(h));change(p);
  assert.throws(()=>confirmSyntheticExport(h,h.review_challenge,p));
 }
});
test('P4.2 rejected SMAX review rows cannot be promoted',()=>{
 const p=prepared();
 p.rows[0].issues=[{field:'quantity',code:'INVALID_INTEGER'}];
 p.rows[0].status='NEEDS_REVIEW';
 p.review_queue=[{source_record:2,issues:p.rows[0].issues}];
 p.quality.review_rows=1;p.quality.invalid_cells=1;
 assert.throws(()=>beginSyntheticExport(p,source,policy));
});
test('P4.2 tampering with normalized quantity or price refuses export',()=>{
 for(const field of ['quantity','unit_price_krw','amount_krw','sku']){
  const p=prepared();p.rows[1].values[field]='TAMPERED';
  assert.throws(()=>beginSyntheticExport(p,source,policy),field);
 }
});
test('P4.2 source digest, CSV mutation and non-allowlisted customer-like content refused',()=>{
 assert.throws(()=>beginSyntheticExport(prepared(),Buffer.from('real customer input'),policy));
 const modified=Buffer.from(source);modified[80]^=1;
 assert.throws(()=>beginSyntheticExport(prepared(),modified,policy));
});
test('P4.2 altered/missing policy doc refused',()=>{
 assert.throws(()=>beginSyntheticExport(prepared(),source,Buffer.from('not a synthetic policy')));
 assert.throws(()=>beginSyntheticExport(prepared(),source,null));
});
test('P4.2 spoofed READY_TO_IMPORT or altered rows refused',()=>{
 const p=prepared();p.approval='APPROVED';
 assert.throws(()=>beginSyntheticExport(p,source,policy));
 const q=prepared();q.rows[1].source_record=42;
 assert.throws(()=>beginSyntheticExport(q,source,policy));
});
test('P4.2 review phrase can only be used once',()=>{
 const h=start();const p=syntheticReviewPlan(h);
 const b=confirmSyntheticExport(h,h.review_challenge,p);
 assert.equal(b.status,'SYNTHETIC_AX_BUNDLE_PREPARED');
 assert.equal(b.customer_data_allowed,false);
 assert.throws(()=>confirmSyntheticExport(h,h.review_challenge,p));
 assert.throws(()=>syntheticReviewPlan(h));
});
test('P4.2 exact synthesized accepted manifest and SQLite sales totals verify',t=>{
 const {target}=temp(t);
 const bundle=approve(start());
 const done=writeSyntheticAxBundle(bundle,target);
 assert.equal(done.status,'SYNTHETIC_AX_VERIFIED');
 assert.equal(done.orders,6);
 assert.equal(done.revenue_krw,'157000');
 assert.equal(done.units,'10');
 assert.equal(done.reviewer_identity_verified,false);
 assert.equal(done.customer_data_allowed,false);
 const pkg=loadPackage(target);
 assert.equal(pkg.manifest.schema_version,'AX_DATA_PACKAGE_V0');
 assert.deepEqual(pkg.manifest.files.map(f=>f.import_status),['ACCEPTED','ACCEPTED']);
 assert.equal(pkg.manifest.datasets[0].columns.every(c=>c.review_status==='APPROVED'),true);
 assert.equal(pkg.manifest.documents[0].document_id,'document-returns');
 assert.equal(aggregateSales(target).row_evidence[0].csv_line,2);
 assert.deepEqual(fs.readFileSync(path.join(target,'sales.csv')),source);
 assert.deepEqual(fs.readFileSync(path.join(target,'returns_policy.txt')),policy);
});
test('P4.2 absence of approved bundle does not create output',t=>{
 const {target}=temp(t),h=start();
 assert.throws(()=>writeSyntheticAxBundle(h,target));
 assert.equal(fs.existsSync(target),false);
});
test('P4.2 preexisting target directory/files cannot be overwritten',t=>{
 const {target}=temp(t),h=start(),bundle=approve(h);
 fs.mkdirSync(target);const sentinel=path.join(target,'existing.txt');
 fs.writeFileSync(sentinel,'DO_NOT_CHANGE');
 assert.throws(()=>writeSyntheticAxBundle(bundle,target));
 assert.equal(fs.readFileSync(sentinel,'utf8'),'DO_NOT_CHANGE');
 assert.equal(fs.existsSync(path.join(target,'sales.csv')),false);
});
test('P4.2 successful bundle cannot be written twice',t=>{
 const {root,target}=temp(t),bundle=approve(start());
 writeSyntheticAxBundle(bundle,target);
 assert.throws(()=>writeSyntheticAxBundle(bundle,path.join(root,'second')));
 assert.equal(fs.existsSync(path.join(root,'second')),false);
});
test('P4.2 returned reports do not expose source CSV, raw rows or credentials',()=>{
 const handle=start(),plan=syntheticReviewPlan(handle),bundle=approve(handle);
 const all=JSON.stringify([handle,plan,bundle]);
 for(const word of ['O-1001','N-01','15000','30000','line 2 source body','Bearer']){
  assert.equal(all.includes(word),false,word);
 }
});
test('P4.2 caller-supplied objects and approved original fixtures remain immutable',t=>{
 const dir=temp(t),p=prepared(),before=structuredClone(p);
 const originalCSV=Buffer.from(source),originalPolicy=Buffer.from(policy);
 const handle=beginSyntheticExport(p,source,policy);
 p.rows[0].values.quantity='99999'; // mutation after begin cannot affect snapshot.
 const bundle=approve(handle);
 const result=writeSyntheticAxBundle(bundle,dir.target);
 assert.equal(result.revenue_krw,'157000');
 assert.equal(before.rows[0].values.quantity,'2');
 assert.deepEqual(source,originalCSV);
 assert.deepEqual(policy,originalPolicy);
});
test('P4.2 no private producer module imported or side-effect network/API requirements',()=>{
 const text=fs.readFileSync(new URL('../src/smax-synthetic-export.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(text,/from ['"](?:\.\.\/){2,}.*SMAX|fetch\s*\(|https?:\/\/|child_process/u);
});
