import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {inspectSmaxV1,inspectSmaxFiles} from '../src/smax-intake.mjs';
const source=Buffer.from('order_id,quantity,amount_krw\nA-001,2,12000\nA-002,3,9000\n','utf8');
function pkg(){
 const rows=[
  {source_record:2,source_cells:['A-001','2','12000'],values:{order_id:'A-001',quantity:'2',amount_krw:'12000'},status:'READY_FOR_HUMAN_REVIEW',issues:[]},
  {source_record:3,source_cells:['A-002','3','9000'],values:{order_id:'A-002',quantity:'3',amount_krw:'9000'},status:'READY_FOR_HUMAN_REVIEW',issues:[]}
 ];
 return {schema_version:'SMAX_PREPROCESS_GENERIC_CSV_V1',source:{format:'UTF8_CSV',sha256:crypto.createHash('sha256').update(source).digest('hex'),bytes:source.length,headers:['order_id','quantity','amount_krw'],source_rows:2},
 fields:[{key:'order_id',source:'order_id',type:'text',required:true},{key:'quantity',source:'quantity',type:'integer',required:true},{key:'amount_krw',source:'amount_krw',type:'integer',required:true}],
 rows,review_queue:[],quality:{input_rows:2,output_rows:2,review_rows:0,exact_duplicate_rows:0,missing_required_cells:0,invalid_cells:0,formula_risk_cells:0},processing_mode:'DETERMINISTIC_LOCAL',approval:'NOT_GRANTED'};
}
function temp(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rag-smax-gate-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const json=path.join(dir,'package.json'),csv=path.join(dir,'source.csv');
 fs.writeFileSync(json,JSON.stringify(pkg()));fs.writeFileSync(csv,source);
 return {dir,json,csv};
}
test('V1 clean source still requires explicit human review; no AX package emitted',()=>{
 const x=inspectSmaxV1(pkg(),{sourceBytes:source});
 assert.deepEqual([x.status,x.provenance,x.source_rows,x.mapped_fields,x.review_rows,x.ax_package_created],['REVIEW_REQUIRED','SOURCE_DIGEST_VERIFIED',2,3,0,false]);
});
test('No source bytes means digest is NOT claimed verified',()=>{
 const x=inspectSmaxV1(pkg());assert.equal(x.provenance,'SOURCE_BYTES_NOT_SUPPLIED');assert.equal(x.acceptance,'NOT_GRANTED');
});
test('Forged APPPROVED top-level state fails closed',()=>{
 const x=pkg();x.approval='APPROVED';assert.throws(()=>inspectSmaxV1(x));
});
test('Forged APPROVED row is refused',()=>{
 const x=pkg();x.rows[0].status='APPROVED';assert.throws(()=>inspectSmaxV1(x));
});
test('Tampered source SHA, data length and untrusted types rejected',()=>{
 for(const tamper of [Buffer.from('changed'),Buffer.concat([source,Buffer.from('!')]),'not-buffer']){
  assert.throws(()=>inspectSmaxV1(pkg(),{sourceBytes:tamper}));
 }
});
test('Broken review queue/counters are rejected',()=>{
 const x=pkg();x.rows[0].issues=[{field:'quantity',code:'INVALID_INTEGER'}];x.rows[0].status='NEEDS_REVIEW';
 assert.throws(()=>inspectSmaxV1(x));
});
test('Duplicate original rows cannot be silently marked clean',()=>{
 const x=pkg();x.rows[1].source_cells=[...x.rows[0].source_cells];assert.throws(()=>inspectSmaxV1(x));
});
test('Unsupported schema version or unknown extra fields fail closed',()=>{
 for(const change of [x=>x.schema_version='OTHER',x=>x.extra='secret']){const x=pkg();change(x);assert.throws(()=>inspectSmaxV1(x));}
});
test('Approved-looking source field is not automatically promoted',()=>{
 const x=pkg();x.fields[0].key='secret_access_token';x.rows[0].values.secret_access_token=x.rows[0].values.order_id;delete x.rows[0].values.order_id;x.rows[1].values.secret_access_token=x.rows[1].values.order_id;delete x.rows[1].values.order_id;
 assert.equal(inspectSmaxV1(x,{sourceBytes:source}).ax_package_created,false);
});
test('Local verified fixture inspection reports only safe counts',t=>{
 const {json,csv}=temp(t);
 const outcome=inspectSmaxFiles(json,csv);assert.equal(outcome.status,'REVIEW_REQUIRED');
 assert.equal(outcome.provenance,'SOURCE_DIGEST_VERIFIED');
 assert.doesNotMatch(JSON.stringify(outcome),/A-001|12000|source\.csv|order_id/);
});
test('Raw JSON file without matching original source is not verified',t=>{
 const {json}=temp(t);const x=inspectSmaxFiles(json);assert.equal(x.provenance,'SOURCE_BYTES_NOT_SUPPLIED');
});
test('Actual altered CSV blocks inspection and never creates package',t=>{
 const {json,csv}=temp(t);fs.appendFileSync(csv,'attack');
 assert.deepEqual(inspectSmaxFiles(json,csv),{status:'REJECTED',code:'SMAX_CONTRACT_OR_PROVENANCE_INVALID',ax_package_created:false});
});
test('Symlinked JSON and invalid UTF-8 never imported',t=>{
 const {json,dir,csv}=temp(t);const link=path.join(dir,'link.json');fs.symlinkSync(json,link);
 assert.equal(inspectSmaxFiles(link,csv).status,'REJECTED');
 fs.writeFileSync(json,Buffer.from([0xff,0xfe]));assert.equal(inspectSmaxFiles(json,csv).status,'REJECTED');
});
test('Missing or oversize files produce fixed error without leaking paths',t=>{
 const {json,dir}=temp(t);const extra=path.join(dir,'oversized.json');
 fs.writeFileSync(extra,Buffer.alloc(4*1024*1024+1,97));
 for(const file of ['/not-a-real-user-file-123',extra]){
  const report=inspectSmaxFiles(file);assert.equal(report.status,'REJECTED');
  assert.ok(!JSON.stringify(report).includes(file));
 }
});
test('Input file bytes are preserved after inspection',t=>{
 const {json,csv}=temp(t);const j=fs.readFileSync(json),c=fs.readFileSync(csv);
 inspectSmaxFiles(json,csv);assert.deepEqual(fs.readFileSync(json),j);assert.deepEqual(fs.readFileSync(csv),c);
});
