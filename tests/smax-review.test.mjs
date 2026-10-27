import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {assessSmaxReview} from '../src/smax-review.mjs';
const root=new URL('../fixtures/smax_v1_boundary/',import.meta.url);
const data=JSON.parse(fs.readFileSync(new URL('unapproved.json',root),'utf8'));
const bytes=fs.readFileSync(new URL('source.csv',root));
const clone=()=>structuredClone(data);
const plan=()=>({
 schema_version:'RAG_SMAX_REVIEW_V0',source_sha256:data.source.sha256,
 semantic_roles:{order_id:'order_id',quantity:'quantity',line_amount_krw:'amount_krw'},
 currency:'KRW',amount_unit:'KRW_INTEGER',amount_meaning:'LINE_TOTAL',
 tax_basis:'TAX_NOT_APPLICABLE',source_records:[2,3],
 decision:'CONFIRM_FOR_NEXT_GATE',acknowledgement:'I_CHECKED_SOURCE_FIELDS_TAX_AND_ALL_ROWS'
});
const recompute=(pkg,b)=>{pkg.source.sha256=crypto.createHash('sha256').update(b).digest('hex');pkg.source.bytes=b.length;};
test('P4.1 absent explicit review stays pending, no AX package',()=>{
 const x=assessSmaxReview(clone(),bytes);
 assert.deepEqual([x.status,x.source_binding,x.source_rows,x.ax_package_created,x.reviewer_identity_verified],
  ['PENDING_SEMANTIC_REVIEW','MATCHED',2,false,false]);
});
test('P4.1 explicit semantics record still does not create approved AX data',()=>{
 const x=assessSmaxReview(clone(),bytes,plan());
 assert.equal(x.status,'REVIEW_RECORD_READY');assert.equal(x.semantic_review_recorded,true);
 assert.equal(x.ax_package_created,false);assert.equal(x.reviewer_identity_verified,false);
});
test('P4.1 hold is never approval',()=>{
 const p=plan();p.decision='HOLD';const x=assessSmaxReview(clone(),bytes,p);
 assert.equal(x.status,'REVIEW_HOLD');assert.equal(x.ax_package_created,false);
});
test('P4.1 unexpected review fields are rejected',()=>{
 const p=plan();p.actor_token='secret';assert.throws(()=>assessSmaxReview(clone(),bytes,p));
});
test('P4.1 different source digest or missing source bytes are rejected',()=>{
 const p=plan();p.source_sha256='f'.repeat(64);assert.throws(()=>assessSmaxReview(clone(),bytes,p));
 assert.throws(()=>assessSmaxReview(clone(),null,plan()));
});
test('P4.1 missing acknowledgement or unsupported decision is rejected',()=>{
 for(const value of ['',null,false]){const p=plan();p.acknowledgement=value;assert.throws(()=>assessSmaxReview(clone(),bytes,p));}
 const p=plan();p.decision='APPROVED';assert.throws(()=>assessSmaxReview(clone(),bytes,p));
});
test('P4.1 currency/unit or tax semantics must be explicit',()=>{
 for(const [key,bad] of [['currency','USD'],['amount_unit','KRW_DECIMAL'],['amount_meaning','UNIT_PRICE'],['tax_basis','UNKNOWN'],['tax_basis',null]]){
  const p=plan();p[key]=bad;assert.throws(()=>assessSmaxReview(clone(),bytes,p),key);
 }
});
test('P4.1 wrong semantic role, row list or ordering rejected',()=>{
 for(const mutate of [p=>p.semantic_roles.line_amount_krw='quantity',p=>p.source_records=[2],
 p=>p.source_records=[3,2],p=>p.source_records=[2,2]]){
  const p=plan();mutate(p);assert.throws(()=>assessSmaxReview(clone(),bytes,p));
 }
});
test('P4.1 original CSV row tampering caught even when source digest is rewritten',()=>{
 const b=Buffer.from('order_id,quantity,amount_krw\nA-001,2,12000\nA-002,3,9900\n');
 const pkg=clone();recompute(pkg,b);assert.throws(()=>assessSmaxReview(pkg,b));
});
test('P4.1 forged normalized value rejected when raw source remains unchanged',()=>{
 const pkg=clone();pkg.rows[0].values.amount_krw='990000';
 assert.throws(()=>assessSmaxReview(pkg,bytes));
});
test('P4.1 source cell provenance forgery rejected',()=>{
 const pkg=clone();pkg.rows[1].source_cells[0]='B-002';
 assert.throws(()=>assessSmaxReview(pkg,bytes));
});
test('P4.1 clean but duplicate order identifiers are rejected',()=>{
 const pkg=clone();pkg.rows[1].source_cells[0]='A-001';pkg.rows[1].values.order_id='A-001';
 const b=Buffer.from('order_id,quantity,amount_krw\nA-001,2,12000\nA-001,3,9000\n');
 recompute(pkg,b);assert.throws(()=>assessSmaxReview(pkg,b));
});
test('P4.1 zero quantity and negative or imprecise amounts fail',()=>{
 for(const [q,amount] of [['0','12000'],['1','-3'],['1','0.01'],['1','9007199254740992']]){
  const pkg=clone(),b=Buffer.from('order_id,quantity,amount_krw\nA-001,'+q+','+amount+'\nA-002,3,9000\n');
  pkg.rows[0].source_cells[1]=q;pkg.rows[0].source_cells[2]=amount;
  pkg.rows[0].values.quantity=q;pkg.rows[0].values.amount_krw=amount;
  recompute(pkg,b);assert.throws(()=>assessSmaxReview(pkg,b),q+':'+amount);
 }
});
test('P4.1 unsupported quotes and multiline CSV are refused, not silently parsed',()=>{
 for(const b of [Buffer.from('order_id,quantity,amount_krw\n"A-001",2,12000\nA-002,3,9000\n'),
                  Buffer.from('order_id,quantity,amount_krw\nA-001,2,12000\nA-002,3,9000')]){
  const pkg=clone();recompute(pkg,b);assert.throws(()=>assessSmaxReview(pkg,b));
 }
});
test('P4.1 bogus top-level approval state rejected by preceding SMAX gate',()=>{
 const pkg=clone();pkg.approval='APPROVED';assert.throws(()=>assessSmaxReview(pkg,bytes,plan()));
});
test('P4.1 nonempty review queue or issue cannot pass semantic gate',()=>{
 const pkg=clone();pkg.rows[0].issues=[{field:'amount_krw',code:'INVALID_INTEGER'}];
 pkg.rows[0].status='NEEDS_REVIEW';pkg.review_queue=[{source_record:2,issues:pkg.rows[0].issues}];
 pkg.quality.review_rows=1;pkg.quality.invalid_cells=1;
 assert.throws(()=>assessSmaxReview(pkg,bytes,plan()));
});
test('P4.1 output never reveals raw source, order IDs, amounts or columns',()=>{
 const output=JSON.stringify(assessSmaxReview(clone(),bytes,plan()));
 for(const forbidden of ['A-001','A-002','12000','9000','order_id','amount_krw','source.csv']){
  assert.equal(output.includes(forbidden),false,forbidden);
 }
});
test('P4.1 inputs remain unchanged, no synthetic file modifications',()=>{
 const before=fs.readFileSync(new URL('unapproved.json',root)),csv=fs.readFileSync(new URL('source.csv',root));
 const pkg=clone(),copy=structuredClone(pkg);
 assessSmaxReview(pkg,bytes,plan());
 assert.deepEqual(pkg,copy);
 assert.deepEqual(fs.readFileSync(new URL('unapproved.json',root)),before);
 assert.deepEqual(fs.readFileSync(new URL('source.csv',root)),csv);
});
