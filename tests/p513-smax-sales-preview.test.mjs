import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {previewSmaxSales} from '../src/smax-sales-preview.mjs';
import {inspectSmaxV1} from '../src/smax-intake.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const base=path.join(repo,'fixtures/ax_multi_doc_v0/sales.csv');
const fixture=path.join(repo,'fixtures/smax_p42/synthetic_v1.json');
const input=fs.readFileSync(base),nativeShaped=JSON.parse(fs.readFileSync(fixture,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const clone=()=>structuredClone(nativeShaped);
function rewrite(values,extra=null){
 const pkg=clone();
 const header=extra?nativeShaped.source.headers.concat('memo'):nativeShaped.source.headers;
 const content=header.join(',')+'\n'+values.map((r,i)=>r.join(',')+(extra?','+(i===0?extra:'ordinary'):'')).join('\n')+'\n';
 const bytes=Buffer.from(content,'utf8');
 pkg.source.sha256=sha(bytes);pkg.source.bytes=bytes.length;pkg.source.headers=header;
 for(let i=0;i<values.length;i++){
   pkg.rows[i].source_cells=extra?[...values[i],i===0?extra:'ordinary']:[...values[i]];
   Object.assign(pkg.rows[i].values,Object.fromEntries(header.slice(0,5).map((k,j)=>[k,values[i][j]])));
 }
 return {pkg,bytes};
}
const originalRecords=input.toString('utf8').trimEnd().split('\n').slice(1).map(x=>x.split(','));
test('P5.13 existing producer-shaped public fixture: full preview of 157000 KRW, 10 units, 3 SKUs',()=>{
 const r=previewSmaxSales(clone(),input);
 assert.equal(r.contract,'rag.smax-sales-preview.v1');
 assert.equal(r.status,'CALCULATED_PREVIEW_NOT_APPROVED');
 assert.equal(r.revenue_krw,'157000');assert.equal(r.units,'10');assert.equal(r.orders,6);
 assert.deepEqual(r.sku_totals.map(s=>[s.sku,s.orders,s.revenue_krw]),[['N-01',2,'45000'],['N-02',2,'72000'],['N-03',2,'40000']]);
 for(const k of ['customer_data_approved','ax_package_created','importer_enabled','source_rights_verified'])assert.equal(r[k],false);
 assert.equal(r.source_digest_verified,true);
 assert.ok(Object.isFrozen(r));
});
test('P5.13 independent unknown source fingerprint is not hardcoded to P4.2 sales fixture',()=>{
 const values=structuredClone(originalRecords);values[1][3]='25000';values[1][4]='25000';
 const {pkg,bytes}=rewrite(values);
 const r=previewSmaxSales(pkg,bytes);
 assert.equal(r.revenue_krw,'158000');assert.equal(r.units,'10');
 assert.notEqual(r.source_sha256,nativeShaped.source.sha256);
});
test('P5.13 preserve mapped field semantics despite native mapping order variation',()=>{
 const pkg=clone();
 pkg.fields.reverse();
 assert.equal(previewSmaxSales(pkg,input).revenue_krw,'157000');
});
test('P5.13 forged normalized values rejected although original source SHA matches',()=>{
 const pkg=clone();pkg.rows[0].values.amount_krw='990000';
 assert.throws(()=>previewSmaxSales(pkg,input),{code:'SMAX_SALES_NORMALIZED_VALUES_MISMATCH'});
});
test('P5.13 changed original CSV rejected even with unchanged trusted-looking JSON',()=>{
 const tampered=Buffer.from(input);
 tampered[tampered.indexOf(Buffer.from('30000'))]^=1;
 assert.throws(()=>previewSmaxSales(clone(),tampered));
});
test('P5.13 mathematically inconsistent line refused instead of silently recomputing',()=>{
 const values=structuredClone(originalRecords);values[0][4]='30001';
 const {pkg,bytes}=rewrite(values);
 assert.throws(()=>previewSmaxSales(pkg,bytes),{code:'SMAX_SALES_AMOUNT_MISMATCH'});
});
test('P5.13 duplicate order ID in distinct rows not included in aggregate',()=>{
 const values=structuredClone(originalRecords);values[1][0]='O-1001';
 const {pkg,bytes}=rewrite(values);
 assert.throws(()=>previewSmaxSales(pkg,bytes),{code:'SMAX_SALES_IDENTIFIER_INVALID'});
});
test('P5.13 acknowledged review row creates HOLD with no leaked/misleading amount',()=>{
 const pkg=clone();
 const issue={field:'quantity',code:'INVALID_INTEGER'};
 pkg.rows[0].issues=[issue];pkg.rows[0].status='NEEDS_REVIEW';
 pkg.review_queue=[{source_record:2,issues:[issue]}];
 pkg.quality.review_rows=1;pkg.quality.invalid_cells=1;
 const r=previewSmaxSales(pkg,input);
 assert.equal(r.status,'REVIEW_HOLD');assert.equal(r.revenue_krw,null);
 assert.equal(r.orders,null);assert.deepEqual(r.sku_totals,[]);
 assert.equal(r.importer_enabled,false);
});
test('P5.13 native unmapped formula-risk issue now causes review HOLD, not unsupported false reject',()=>{
 const values=structuredClone(originalRecords);
 const {pkg,bytes}=rewrite(values,'=SUM(1)');
 pkg.rows[0].issues=[{field:'memo',code:'UNMAPPED_FORMULA_RISK'}];
 pkg.rows[0].status='NEEDS_REVIEW';
 pkg.review_queue=[{source_record:2,issues:[{field:'memo',code:'UNMAPPED_FORMULA_RISK'}]}];
 pkg.quality.formula_risk_cells=1;pkg.quality.review_rows=1;
 const inspected=inspectSmaxV1(pkg,{sourceBytes:bytes});
 assert.equal(inspected.review_rows,1);
 assert.equal(previewSmaxSales(pkg,bytes).status,'REVIEW_HOLD');
});
test('P5.13 forged unregistered issue or wrong unmapped source field denied',()=>{
 const pkg=clone();
 pkg.rows[0].issues=[{field:'not_present',code:'UNMAPPED_FORMULA_RISK'}];
 pkg.rows[0].status='NEEDS_REVIEW';pkg.review_queue=[{source_record:2,issues:pkg.rows[0].issues}];
 pkg.quality.review_rows=1;pkg.quality.formula_risk_cells=1;
 assert.throws(()=>previewSmaxSales(pkg,input),/ISSUE_INVALID/);
});
test('P5.13 extra original CSV column bound through unchanged SMAX mapping is verified',()=>{
 const values=structuredClone(originalRecords);
 const {pkg,bytes}=rewrite(values,'safe');
 const r=previewSmaxSales(pkg,bytes);
 assert.equal(r.revenue_krw,'157000');
});
test('P5.13 malformed CSV and unverified fields never produce numeric preview',()=>{
 const values=structuredClone(originalRecords);
 const {pkg,bytes}=rewrite(values);
 pkg.fields[2].type='decimal';
 assert.throws(()=>previewSmaxSales(pkg,bytes),{code:'SMAX_SALES_UNSUPPORTED_MAPPING'});
 const wrong={...clone(),approval:'GRANTED'};
 assert.throws(()=>previewSmaxSales(wrong,input));
});
test('P5.13 local CLI reads exact two files, prints only non-approved preview and preserves inputs',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p513-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const j=path.join(dir,'result.json'),c=path.join(dir,'source.csv');
 fs.writeFileSync(j,JSON.stringify(clone()));fs.writeFileSync(c,input);
 const origJ=fs.readFileSync(j),origC=fs.readFileSync(c);
 const out=spawnSync(process.execPath,['src/smax-sales-preview-cli.mjs',j,c],{
   cwd:repo,encoding:'utf8',timeout:10000});
 assert.equal(out.status,0,out.stderr);
 const result=JSON.parse(out.stdout);
 assert.equal(result.revenue_krw,'157000');assert.equal(result.customer_data_approved,false);
 assert.equal(result.ax_package_created,false);
 assert.doesNotMatch(out.stdout,/O-1001|O-1002|result\.json|source\.csv/);
 assert.deepEqual(fs.readFileSync(j),origJ);assert.deepEqual(fs.readFileSync(c),origC);
 assert.deepEqual(fs.readdirSync(dir).sort(),['result.json','source.csv']);
});
test('P5.13 CLI rejects unknown files and symlink without printing private paths',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p513-blocked-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const j=path.join(dir,'secret-source.json'),c=path.join(dir,'secret-original.csv');
 fs.writeFileSync(j,JSON.stringify(clone()));fs.writeFileSync(c,input);
 const link=path.join(dir,'symlink.json');
 try{fs.symlinkSync(j,link);}catch(e){t.skip('symlink unsupported '+e.code);return;}
 for(const args of [[link,c],[j,path.join(dir,'missing.csv')],[j,j]]){
   const result=spawnSync(process.execPath,['src/smax-sales-preview-cli.mjs',...args],{
     cwd:repo,encoding:'utf8',timeout:10000});
   assert.equal(result.status,1);
   assert.match(result.stderr,/SMAX_SALES_PREVIEW_BLOCKED/);
   assert.doesNotMatch(result.stdout+result.stderr,/secret-source|secret-original|symlink\.json/);
 }
});
test('P5.13 extremely large source safely refuses',()=>{
 const bad=Buffer.alloc(2*1024*1024+1,65);
 assert.throws(()=>previewSmaxSales(clone(),bad));
});
