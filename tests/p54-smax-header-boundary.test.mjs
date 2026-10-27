/** Public-only boundary regression, no Private SMAX code or produced artifacts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectSmaxV1,inspectSmaxFiles} from '../src/smax-intake.mjs';
const v1Path=new URL('../fixtures/smax_p42/synthetic_v1.json',import.meta.url);
const sourcePath=new URL('../fixtures/ax_multi_doc_v0/sales.csv',import.meta.url);
const pkg=()=>JSON.parse(fs.readFileSync(v1Path,'utf8'));
const source=fs.readFileSync(sourcePath);
const rejected=x=>assert.throws(()=>inspectSmaxV1(x,{sourceBytes:source}),e=>e.code==='SOURCE_METADATA_INVALID');
test('P5.4 original public V1 fixture remains unapproved and digest-verified',()=>{
 const r=inspectSmaxV1(pkg(),{sourceBytes:source});
 assert.equal(r.status,'REVIEW_REQUIRED');
 assert.equal(r.provenance,'SOURCE_DIGEST_VERIFIED');
 assert.equal(r.acceptance,'NOT_GRANTED');
 assert.equal(r.ax_package_created,false);
});
test('P5.4 rejects unsafe invisible header characters in unmapped columns',()=>{
 for(const unsafe of ['\u200b','\u202e','\u2066','\u2069','\u034f','\u00ad','\u0007']){
   const v=pkg();v.source.headers.push('unused'+unsafe+'field');
   rejected(v);
 }
});
test('P5.4 rejects Unicode NFKC/case-folding duplicates even if bytewise different',()=>{
 for(const extra of ['ＯＲＤＥＲ_ＩＤ','ORDER_ID','order_id']){
   const v=pkg();v.source.headers.push(extra);
   rejected(v);
 }
});
test('P5.4 rejects padded and whitespace-only names rather than trimming identifiers',()=>{
 for(const unsafe of [' order_id','new ',' new',' ','\tcol','col\nname']){
   const v=pkg();v.source.headers.push(unsafe);
   rejected(v);
 }
});
test('P5.4 safely refuses forged approval even with unambiguous headers',()=>{
 const v=pkg();v.approval='APPROVED';
 assert.throws(()=>inspectSmaxV1(v),e=>e.code==='CONTRACT_OR_APPROVAL_INVALID');
});
test('P5.4 original files are unmodified and local inspector reports only counters',()=>{
 const before=fs.readFileSync(v1Path),original=fs.readFileSync(sourcePath);
 const r=inspectSmaxFiles(new URL(v1Path).pathname,new URL(sourcePath).pathname);
 assert.equal(r.status,'REVIEW_REQUIRED');
 assert.ok(!JSON.stringify(r).includes('O-1001'));
 assert.deepEqual(fs.readFileSync(v1Path),before);
 assert.deepEqual(fs.readFileSync(sourcePath),original);
});
