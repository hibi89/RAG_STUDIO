/** P4.3 public-consumer contract lock.
 * All inputs below are existing PUBLIC, synthetic RAG_STUDIO fixtures.
 * No private SMAX code or generated artifact is imported/published here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inspectSmaxV1,inspectSmaxFiles} from '../src/smax-intake.mjs';
import {beginSyntheticExport} from '../src/smax-synthetic-export.mjs';
const root=new URL('../fixtures/',import.meta.url);
const fixture=new URL('smax_p42/synthetic_v1.json',root);
const sourceFile=new URL('ax_multi_doc_v0/sales.csv',root);
const policyFile=new URL('ax_multi_doc_v0/returns_policy.txt',root);
const source=fs.readFileSync(sourceFile),policy=fs.readFileSync(policyFile);
const pkg=()=>JSON.parse(fs.readFileSync(fixture,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('P4.3 public wire golden: source bytes, source SHA and strict NOT_GRANTED remain bound',()=>{
  const p=pkg();
  assert.equal(p.schema_version,'SMAX_PREPROCESS_GENERIC_CSV_V1');
  assert.equal(p.source.sha256,sha(source));
  assert.equal(p.source.bytes,source.length);
  assert.equal(p.approval,'NOT_GRANTED');
  assert.equal(p.processing_mode,'DETERMINISTIC_LOCAL');
});
test('P4.3 all synthetic source row IDs, cells and normalized string values match',()=>{
  const p=pkg();
  const [header,...rawRows]=source.toString('utf8').trimEnd().split('\n').map(line=>line.split(','));
  assert.deepEqual(p.source.headers,header);
  assert.equal(p.source.source_rows,rawRows.length);
  assert.equal(p.fields.length,header.length);
  for(let i=0;i<rawRows.length;i++){
    const row=p.rows[i];
    assert.equal(row.source_record,i+2);
    assert.deepEqual(row.source_cells,rawRows[i]);
    assert.deepEqual(Object.keys(row.values),header);
    for(let j=0;j<header.length;j++)assert.equal(row.values[header[j]],rawRows[i][j]);
    assert.equal(row.status,'READY_FOR_HUMAN_REVIEW');
    assert.deepEqual(row.issues,[]);
  }
});
test('P4.3 quality counters and review queue cannot silently grant permission',()=>{
  const p=pkg();
  assert.deepEqual(p.review_queue,[]);
  assert.deepEqual(p.quality,{input_rows:6,output_rows:6,review_rows:0,
    exact_duplicate_rows:0,missing_required_cells:0,invalid_cells:0,
    formula_risk_cells:0});
  assert.equal(inspectSmaxV1(p,{sourceBytes:source}).status,'REVIEW_REQUIRED');
});
test('P4.3 source digest verified only if raw bytes are supplied',()=>{
  assert.equal(inspectSmaxV1(pkg()).provenance,'SOURCE_BYTES_NOT_SUPPLIED');
  assert.equal(inspectSmaxV1(pkg(),{sourceBytes:source}).provenance,'SOURCE_DIGEST_VERIFIED');
});
test('P4.3 forged approved top-level state is rejected by the consumer',()=>{
  const p=pkg();p.approval='APPROVED';
  assert.throws(()=>inspectSmaxV1(p,{sourceBytes:source}));
  assert.throws(()=>beginSyntheticExport(p,source,policy));
});
test('P4.3 changing a source file without changing manifest SHA is rejected',()=>{
  const b=Buffer.from(source);b[77]^=1;
  assert.throws(()=>inspectSmaxV1(pkg(),{sourceBytes:b}));
  assert.throws(()=>beginSyntheticExport(pkg(),b,policy));
});
test('P4.3 forged normalized value can pass shallow wire shape but cannot enter AX',()=>{
  const p=pkg();p.rows[0].values.amount_krw='999999';
  const wire=inspectSmaxV1(p,{sourceBytes:source});
  assert.equal(wire.status,'REVIEW_REQUIRED');
  assert.equal(wire.ax_package_created,false);
  assert.throws(()=>beginSyntheticExport(p,source,policy));
});
test('P4.3 forged cell provenance can never be promoted',()=>{
  const p=pkg();p.rows[0].source_cells[0]='O-FAKE';
  const wire=inspectSmaxV1(p,{sourceBytes:source});
  assert.equal(wire.status,'REVIEW_REQUIRED');
  assert.throws(()=>beginSyntheticExport(p,source,policy));
});
test('P4.3 review queue with consistent issue counters remains blocked for AX',()=>{
  const p=pkg();const issue={field:'amount_krw',code:'INVALID_INTEGER'};
  p.rows[0].issues=[issue];p.rows[0].status='NEEDS_REVIEW';
  p.review_queue=[{source_record:2,issues:[issue]}];
  p.quality.review_rows=1;p.quality.invalid_cells=1;
  const wire=inspectSmaxV1(p,{sourceBytes:source});
  assert.equal(wire.review_rows,1);
  assert.equal(wire.status,'REVIEW_REQUIRED');
  assert.throws(()=>beginSyntheticExport(p,source,policy));
});
test('P4.3 malformed review queue or duplicate sources rejected by wire gate',()=>{
  const a=pkg();a.review_queue=[{source_record:2,issues:[]}];
  assert.throws(()=>inspectSmaxV1(a,{sourceBytes:source}));
  const b=pkg();b.rows[1].source_cells=[...b.rows[0].source_cells];
  assert.throws(()=>inspectSmaxV1(b,{sourceBytes:source}));
});
test('P4.3 public fixture passes both disk and in-memory gate without source edits',()=>{
  const before=Buffer.from(source),v1=fs.readFileSync(fixture);
  const r=inspectSmaxFiles(fileURLToPath(new URL('smax_p42/synthetic_v1.json',root)),
    fileURLToPath(new URL('ax_multi_doc_v0/sales.csv',root)));
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.provenance,'SOURCE_DIGEST_VERIFIED');
  assert.deepEqual(fs.readFileSync(fixture),v1);
  assert.deepEqual(fs.readFileSync(sourceFile),before);
});
test('P4.3 consumer reports never disclose rows, order IDs or currency amounts',()=>{
  const r=JSON.stringify(inspectSmaxV1(pkg(),{sourceBytes:source}));
  for(const raw of ['O-1001','N-01','15000','30000','unit_price_krw','returns_policy.txt']){
    assert.equal(r.includes(raw),false);
  }
});
