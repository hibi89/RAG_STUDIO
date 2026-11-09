import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRagPrepMappingPlan} from '../src/prep-mapping-plan.mjs';
const base=()=>({schema:'RAG_LOCAL_CSV_REVIEW_V1',status:'NEEDS_REVIEW',
  local_only:true,customer_data_approved:false,smax_native_approved:false,
  ax_package_created:false,imported_to_sqlite:false,original_modified:false,
  source_sha256:'a'.repeat(64),source_size_bytes:81,row_count:2,total_issues:0,
  formula_like_cell_count:0,columns:[
    {column_index:1,name:'주문번호',inferred_type:'TEXT',review_status:'NEEDS_REVIEW'},
    {column_index:2,name:'quantity',inferred_type:'INTEGER',review_status:'NEEDS_REVIEW'},
    {column_index:3,name:'amount_krw',inferred_type:'DECIMAL',review_status:'NEEDS_REVIEW'}
  ]});
const mapping=()=>[
  {key:'order_id',source:'주문번호',type:'text',required:true},
  {key:'quantity',source:'quantity',type:'integer',required:true},
  {key:'amount_krw',source:'amount_krw',type:'decimal',required:true}];
test('P5.46 public PREP mapping remains held despite complete plausible schema',()=>{
 const p=buildRagPrepMappingPlan(base(),mapping());
 assert.equal(p.target_contract,'SMAX_PREPROCESS_GENERIC_CSV_V1');
 assert.equal(p.requested_mapping.length,3);
 assert.equal(p.status,'REVIEW_HOLD');assert.equal(p.approval,'NOT_GRANTED');
 assert.equal(p.ax_package_created,false);assert.equal(p.sqlite_imported,false);
 assert.equal(p.remote_upload,false);assert.equal(p.smax_native_approved,false);
 assert.ok(!p.blockers.includes('MAPPING_INCOMPLETE'));
});
test('P5.46 cold-start suggestions never infer a semantic target field or approve',()=>{
 const p=buildRagPrepMappingPlan(base());
 assert.equal(p.proposed_columns[0].source,'주문번호');
 assert.equal(p.proposed_columns[0].proposed_key,null);
 assert.ok(p.blockers.includes('MAPPING_INCOMPLETE'));
 assert.ok(!JSON.stringify(p).includes('O-1001'));
});
test('P5.46 type discrepancy and quality issues retain explicit blockers',()=>{
 const r=base();r.total_issues=2;r.formula_like_cell_count=1;
 const m=mapping();m[1].type='boolean';
 const p=buildRagPrepMappingPlan(r,m);
 assert.ok(p.blockers.includes('TYPE_MISMATCH_REVIEW_REQUIRED'));
 assert.ok(p.blockers.includes('CSV_QUALITY_REVIEW_REQUIRED'));
});
test('P5.46 widening integer to decimal is still a draft but not type-conflict',()=>{
 const m=mapping();m[1].type='decimal';
 const p=buildRagPrepMappingPlan(base(),m);
 assert.equal(p.requested_mapping[1].type_review_required,false);
 assert.equal(p.status,'REVIEW_HOLD');
});
test('P5.46 invalid hidden and normalized duplicate headers fail closed',()=>{
 const r=base();r.columns[1].name='quantity\u200b';
 assert.throws(()=>buildRagPrepMappingPlan(r),/RAG_PREP_MAPPING_BLOCKED/);
 r.columns[1].name='Ａ';r.columns[2].name='A';
 assert.throws(()=>buildRagPrepMappingPlan(r),/RAG_PREP_MAPPING_BLOCKED/);
});
test('P5.46 mapping key, nonexistent source, and duplicate binding rejected',()=>{
 for(const mutate of [m=>m[0].key='DROP TABLE',m=>m[0].source='absent',
  m=>m[1].key='order_id',m=>m[1].source='주문번호',m=>m[0].type='exec',
  m=>m[0].required='yes',m=>m[0].extra=1]){
  const m=mapping();mutate(m);
  assert.throws(()=>buildRagPrepMappingPlan(base(),m),/RAG_PREP_MAPPING_BLOCKED/);
 }
});
test('P5.46 forged approved or remote-origin reviews are refused',()=>{
 for(const change of [r=>r.customer_data_approved=true,r=>r.local_only=false,
  r=>r.ax_package_created=true,r=>r.status='APPROVED',
  r=>r.source_sha256='invalid',r=>r.columns[0].review_status='APPROVED']){
   const r=base();change(r);
   assert.throws(()=>buildRagPrepMappingPlan(r),/RAG_PREP_MAPPING_BLOCKED/);
 }
});
test('P5.46 plan is deterministic, carries no row values, and does not mutate review',()=>{
 const r=base(),before=structuredClone(r);
 const a=buildRagPrepMappingPlan(r,mapping());
 const b=buildRagPrepMappingPlan(r,mapping());
 assert.deepEqual(a,b);assert.deepEqual(r,before);
 assert.doesNotMatch(JSON.stringify(a),/order-row-data|token-value|secret-path/);
});
