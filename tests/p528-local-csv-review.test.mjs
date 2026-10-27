import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes,inspectLocalCsv,parseCsvForReview} from '../src/local-csv-review.mjs';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const base=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const inspect=s=>inspectCsvBytes(Buffer.from(s,'utf8'));
function temp(t,content,ext='.csv'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p528-review-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const f=path.join(dir,'secret-input'+ext);fs.writeFileSync(f,content);return f;
}
test('P5.28 infer safe types, always review; do not import unknown CSV',()=>{
 const r=inspect('sku,qty,price,date,flag\nA,2,5.2,2026-10-25,true\nB,3,6.8,2026-10-26,false\n');
 assert.deepEqual(r.columns.map(c=>c.inferred_type),['TEXT','INTEGER','DECIMAL','DATE','BOOLEAN']);
 assert.equal(r.row_count,2);assert.equal(r.total_issues,0);
 assert.equal(r.status,'NEEDS_REVIEW');assert.equal(r.imported_to_sqlite,false);
 assert.equal(r.smax_native_approved,false);assert.equal(r.ax_package_created,false);
});
test('P5.28 incomplete/extra records retain row + physical line for review',()=>{
 const r=inspect('a,b\n1,2\nbroken\n3,4,5\n');
 assert.equal(r.rows_with_column_mismatch,2);
 assert.equal(r.analyzed_rows,1);
 assert.deepEqual(r.issue_examples.map(x=>[x.row_number,x.source_line]),[[3,3],[4,4]]);
});
test('P5.28 BOM, CRLF, quoted multiline and escaped quotes parsed',()=>{
 const b=Buffer.from('\uFEFFname,note\r\n"A ""quote""","one\r\ntwo"\r\nB,ok\r\n');
 const rows=parseCsvForReview(b);
 assert.equal(rows.length,3);
 assert.equal(rows[1].cells[0],'A "quote"');
 assert.equal(rows[1].cells[1],'one\ntwo');
 assert.equal(rows[2].source_line,4);
 assert.equal(inspectCsvBytes(b).row_count,2);
});
test('P5.28 mixed type and leading-zero IDs are not coerced to number',()=>{
 const r=inspect('id,amount\n001,10\n002,N/A\n003,12\n');
 assert.equal(r.columns[0].inferred_type,'TEXT');
 assert.equal(r.columns[1].inferred_type,'MIXED');
 assert.ok(r.issue_examples.some(x=>x.code==='MIXED_TYPE_COLUMN'));
});
test('P5.28 duplicate/empty header and formula-like text flagged without raw values',()=>{
 const r=inspect('name,NAME,,=cmd\nA,1,2,"=HYPERLINK(""x"",""y"")"\n');
 for(const reason of ['DUPLICATE_HEADER','EMPTY_HEADER','FORMULA_LIKE_HEADER','FORMULA_LIKE_CELL'])
  assert.ok(r.issue_examples.some(x=>x.code===reason),reason);
 assert.equal(r.formula_like_cell_count,1);
 assert.doesNotMatch(JSON.stringify(r),/HYPERLINK/);
});
test('P5.28 invalid UTF-8, bad quote, too large cell, controls and rows are blocked',()=>{
 for(const s of ['a,b\n"bad,2','a,b\nabc"de,2','a\n'+('x'.repeat(513)),
  'a\n\u0000','x\n'.repeat(2003)])
  assert.throws(()=>inspect(s),/CSV review refused/);
 assert.throws(()=>inspectCsvBytes(Buffer.from([0xff,0xfe])),/CSV review refused/);
});
test('P5.28 readonly local file, rejects extensions/symlinks without changes',t=>{
 const p=temp(t,'id,value\nA,2\n');
 const before=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 assert.equal(inspectLocalCsv(p).source_sha256,before);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),before);
 assert.throws(()=>inspectLocalCsv(temp(t,'a,b\n1,2','.txt')),/CSV review refused/);
 if(process.platform!=='win32'){
  const sym=p+'.csv';fs.symlinkSync(p,sym);
  assert.throws(()=>inspectLocalCsv(sym),/CSV review refused/);
 }
});
test('P5.28 actual CLI reports untouched 157000 KRW baseline and path-free review',t=>{
 const p=temp(t,'sku,quantity\nA,2\nB,N/A\n');
 const x=spawnSync(process.execPath,['scripts/p528-inspect-csv.mjs',p,base],
  {cwd,encoding:'utf8',timeout:12000});
 assert.equal(x.status,0,x.stderr);
 const r=JSON.parse(x.stdout);
 assert.equal(r.status,'NEEDS_REVIEW');
 assert.equal(r.verified_baseline.revenue_krw,'157000');
 assert.equal(r.verified_baseline.changed_by_inspection,false);
 assert.equal(r.imported_to_sqlite,false);
 assert.doesNotMatch(x.stdout,/secret-input|p528-review-|\/tmp\//);
});
test('P5.28 malformed input CLI returns sanitized blocked status without path',t=>{
 const p=temp(t,'a,b\n"bad,2\n');
 const x=spawnSync(process.execPath,['scripts/p528-inspect-csv.mjs',p,base],
  {cwd,encoding:'utf8',timeout:12000});
 assert.equal(x.status,1);
 assert.equal(JSON.parse(x.stdout).status,'CSV_INSPECTION_BLOCKED');
 assert.doesNotMatch(x.stdout+x.stderr,/secret-input|p528-review-/);
});
