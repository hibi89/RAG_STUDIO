import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPackage} from '../src/validate.mjs';
import {aggregateSales} from '../src/summary.mjs';
const fixture=fileURLToPath(new URL('../fixtures/ax_sample_v0/',import.meta.url));
function isolated(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p0-'));
 fs.cpSync(fixture,root,{recursive:true});
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return root;
}
function edit(root,change){const filename=path.join(root,'manifest.json');const value=JSON.parse(fs.readFileSync(filename,'utf8'));change(value);fs.writeFileSync(filename,JSON.stringify(value));}
test('valid package loads and both source pointers resolve',()=>{const p=loadPackage(fixture);assert.equal(p.textMap.size,2);assert.equal(p.manifest.documents[0].file_id,'file-policy');});
test('demo deterministic aggregate, evidence lines and policy excerpt',()=>{const r=aggregateSales(fixture);assert.equal(r.revenue_krw,'157000');assert.equal(r.units,'10');assert.equal(r.orders,6);assert.deepEqual(r.row_evidence.map(x=>x.csv_line),[2,3,4,5,6,7]);assert.match(r.document_source.excerpt,/7일/);});
test('missing required schema field denied',t=>{const root=isolated(t);edit(root,m=>delete m.project_id);assert.throws(()=>loadPackage(root),/project_id/);});
test('unsupported version denied',t=>{const root=isolated(t);edit(root,m=>m.schema_version='V1');assert.throws(()=>loadPackage(root),/schema_version/);});
test('relative parent traversal denied',t=>{const root=isolated(t);edit(root,m=>m.files[0].relative_path='../secret.csv');assert.throws(()=>loadPackage(root),/traversal/);});
test('absolute POSIX path denied',t=>{const root=isolated(t);edit(root,m=>m.files[0].relative_path='/tmp/data.csv');assert.throws(()=>loadPackage(root),/unsafe/);});
test('Windows drive and backslash denied',t=>{const root=isolated(t);edit(root,m=>m.files[0].relative_path='C:\\private.csv');assert.throws(()=>loadPackage(root),/unsafe/);});
test('duplicate relative path denied',t=>{const root=isolated(t);edit(root,m=>m.files[1].relative_path='sales.csv');assert.throws(()=>loadPackage(root),/duplicate|kind|sha256/);});
test('missing source document denied',t=>{const root=isolated(t);edit(root,m=>m.documents[0].file_id='absent');assert.throws(()=>loadPackage(root),/reference/);});
test('unapproved dataset cannot aggregate',t=>{const root=isolated(t);edit(root,m=>m.datasets[0].columns[0].review_status='NEEDS_REVIEW');assert.throws(()=>aggregateSales(root),/review/);});
test('modified CSV fails digest validation and source remains unchanged',t=>{const root=isolated(t);const source=fs.readFileSync(path.join(root,'sales.csv'));fs.appendFileSync(path.join(root,'sales.csv'),'attacker');assert.throws(()=>loadPackage(root),/size|sha256/);assert.equal(fs.readFileSync(path.join(fixture,'sales.csv')).compare(source),0);});
test('inconsistent row_count rejected by aggregate',t=>{const root=isolated(t);edit(root,m=>m.datasets[0].row_count=100);assert.throws(()=>aggregateSales(root),/row_count/);});
test('invalid processing counts denied',t=>{const root=isolated(t);edit(root,m=>m.processing_summary.accepted=0);assert.throws(()=>loadPackage(root),/summary/);});
test('dataset file pointer of wrong kind denied',t=>{const root=isolated(t);edit(root,m=>m.datasets[0].file_id='file-policy');assert.throws(()=>loadPackage(root),/reference/);});
test('symlink source refused when available',t=>{const root=isolated(t);try{fs.rmSync(path.join(root,'sales.csv'));fs.symlinkSync(path.join(fixture,'sales.csv'),path.join(root,'sales.csv'));}catch(e){t.skip(`symlink not available: ${e.code}`);return;}assert.throws(()=>loadPackage(root),/symlink/);});
test('document review status keeps source blocked',t=>{const root=isolated(t);edit(root,m=>{m.files[1].import_status='NEEDS_REVIEW';m.processing_summary.accepted=1;m.processing_summary.needs_review=1;});assert.throws(()=>aggregateSales(root),/document source/);});
