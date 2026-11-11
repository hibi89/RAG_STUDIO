import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {buildRagPrepMappingPlan} from '../src/prep-mapping-plan.mjs';
import {verifyOwnerMappingAgainstReview} from '../src/prep-owner-verify.mjs';
import {calculatePinnedSalesPreview,previewLocalMappedSales} from '../src/prep-mapped-sales.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const BASE='주문번호,상품코드,수량,단가,매출\nA-001,N-02,2,100,200\nA-002,N-01,3,20,60\nA-003,N-02,1,100,100\n';
const MAPPING=[{key:'order_id',source:'주문번호',type:'text',required:true},
 {key:'sku',source:'상품코드',type:'text',required:true},
 {key:'quantity',source:'수량',type:'integer',required:true},
 {key:'unit_price_krw',source:'단가',type:'integer',required:true},
 {key:'amount_krw',source:'매출',type:'integer',required:true}];
function setup(t, text=BASE){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p549-local-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const csv=path.join(dir,'sale.csv'),owner=path.join(dir,'owner.json');
 fs.writeFileSync(csv,text);
 const b=fs.readFileSync(csv),r=inspectCsvBytes(b);
 const m={contract:'RAG_PREP_OWNER_MAPPING_V1',source_sha256:r.source_sha256,source_size_bytes:b.length,fields:structuredClone(MAPPING)};
 fs.writeFileSync(owner,JSON.stringify(m));
 return {csv,owner,dir,b,m,r};
}
test('P5.49 end-to-end real local mapped 3-order 360-KRW preview with verified line references',t=>{
 const x=setup(t),p=previewLocalMappedSales(x.csv,x.owner);
 assert.equal(p.contract,'RAG_PREP_SALES_PREVIEW_V1');assert.equal(p.status,'REVIEW_HOLD');
 assert.deepEqual(p.metrics,{orders:3,units:'6',revenue_krw:'360'});
 assert.deepEqual(p.sku_totals,[
  {sku:'N-01',orders:1,units:'3',revenue_krw:'60'},
  {sku:'N-02',orders:2,units:'3',revenue_krw:'300'}]);
 assert.deepEqual(p.source_evidence.map(e=>e.source_line),[2,3,4]);
 assert.ok(p.blockers.includes('SALES_PREVIEW_NOT_AN_AUTHORIZED_IMPORT'));
 assert.equal(p.approval,undefined);assert.equal(p.customer_data_approved,false);
 assert.equal(p.sqlite_imported,false);assert.equal(p.document_indexed,false);
 assert.deepEqual(fs.readFileSync(x.csv),x.b);
});
test('P5.49 actual CLI outputs only metadata/provisional metrics, not raw row or paths',t=>{
 const x=setup(t);const z=spawnSync(process.execPath,['src/prep-mapped-sales-cli.mjs',x.csv,x.owner],{cwd:root,encoding:'utf8'});
 assert.equal(z.status,0,z.stderr);const p=JSON.parse(z.stdout);
 assert.equal(p.metrics.revenue_krw,'360');assert.equal(p.status,'REVIEW_HOLD');
 assert.doesNotMatch(z.stdout+z.stderr,/A-001|A-002|A-003|p549-local-|sale\.csv/);
});
test('P5.49 changing source file invalidates the owner pin',t=>{const x=setup(t);fs.appendFileSync(x.csv,'A-004,N-01,1,1,1\n');assert.throws(()=>previewLocalMappedSales(x.csv,x.owner));});
test('P5.49 changing owner plan SHA or physical source byte count refuses',t=>{const x=setup(t);for(const change of [m=>m.source_sha256='f'.repeat(64),m=>m.source_size_bytes++,m=>m.fields[0].key='__proto__']){const m=structuredClone(x.m);change(m);fs.writeFileSync(x.owner,JSON.stringify(m));assert.throws(()=>previewLocalMappedSales(x.csv,x.owner));}});
test('P5.49 mismatched or incomplete mappings cannot show provisional sales',t=>{const x=setup(t);for(const change of [m=>m.fields.pop(),m=>m.fields[2].type='boolean',m=>m.fields[0].required=false,m=>m.fields[4].key='charge',m=>m.fields[4].source='상품코드']){const m=structuredClone(x.m);change(m);fs.writeFileSync(x.owner,JSON.stringify(m));assert.throws(()=>previewLocalMappedSales(x.csv,x.owner));}});
test('P5.49 exact revenue arithmetic required; false statement is not silently accepted',t=>{const x=setup(t,BASE.replace('2,100,200','2,100,201'));assert.throws(()=>previewLocalMappedSales(x.csv,x.owner));});
test('P5.49 zero/negative/leading-zero/decimal price or quantity refused',t=>{for(const bad of ['0,100,0','-1,100,-100','02,100,200','2,1.50,3','2,100,0200']){const x=setup(t,BASE.replace('2,100,200',bad));assert.throws(()=>previewLocalMappedSales(x.csv,x.owner),bad);}});
test('P5.49 duplicate order ids and dangerous SKU syntax blocked',t=>{for(const source of [BASE.replace('A-003','A-001'),BASE.replace('N-02,2','=HYPERLINK,2'),BASE.replace('N-02,2','N_02,2')]){const x=setup(t,source);assert.throws(()=>previewLocalMappedSales(x.csv,x.owner));}});
test('P5.49 BigInt exactness refuses unsafe overflow and amount wrapping',t=>{const x=setup(t,BASE.replace('2,100,200','9007199254740991,2,18014398509481982'));assert.throws(()=>previewLocalMappedSales(x.csv,x.owner));});
test('P5.49 Unicode headers preserved, and extra unselected CSV column stays unapproved',t=>{
 const sample=BASE.replace('주문번호,상품코드,수량,단가,매출','주문번호,상품코드,수량,단가,매출,메모').replaceAll(/(A-00\d,N-0\d,\d+,\d+,\d+)\n/g,'$1,개인 메모\n');
 const x=setup(t,sample),p=previewLocalMappedSales(x.csv,x.owner);
 assert.equal(p.metrics.revenue_krw,'360');assert.ok(p.blockers.includes('MAPPING_INCOMPLETE'));
 assert.doesNotMatch(JSON.stringify(p),/개인 메모/);
});
test('P5.49 a quoted multi-line value in ignored column uses original physical source line numbers',t=>{
 const source='주문번호,상품코드,수량,단가,매출,메모\nA-001,N-02,2,100,200,"첫줄\n둘째줄"\nA-002,N-01,3,20,60,정상\n';
 const x=setup(t,source),p=previewLocalMappedSales(x.csv,x.owner);
 assert.deepEqual(p.source_evidence.map(e=>e.source_line),[2,4]);assert.equal(p.metrics.revenue_krw,'260');
});
test('P5.49 forged approved plan flags and untrusted review blocked',()=>{
 const b=Buffer.from(BASE),r=inspectCsvBytes(b),p=buildRagPrepMappingPlan(r,MAPPING),v={...p,owner_draft_rechecked:true};
 assert.equal(calculatePinnedSalesPreview(v,b).status,'REVIEW_HOLD');
 for(const change of [o=>o.approval='APPROVED',o=>o.ax_package_created=true,o=>o.owner_draft_rechecked=false,o=>o.source_sha256='0'.repeat(64),o=>o.sqlite_imported=true]){
  const forged=structuredClone(v);change(forged);assert.throws(()=>calculatePinnedSalesPreview(forged,b));
 }
});
test('P5.49 symlink source file and hardlink draft source refused',t=>{
 const x=setup(t);const link=path.join(x.dir,'linked.csv');
 try{fs.symlinkSync(x.csv,link);assert.throws(()=>previewLocalMappedSales(link,x.owner));}catch(err){if(process.platform!=='win32')throw err;}
 const hard=path.join(x.dir,'hard.csv');fs.linkSync(x.csv,hard);
 assert.throws(()=>previewLocalMappedSales(x.csv,x.owner));
});
test('P5.49 errors never reveal source paths or rows',t=>{
 const x=setup(t,BASE.replace('200','201'));
 const z=spawnSync(process.execPath,['src/prep-mapped-sales-cli.mjs',x.csv,x.owner],{cwd:root,encoding:'utf8'});
 assert.equal(z.status,1);assert.equal(JSON.parse(z.stdout).status,'SALES_PREVIEW_BLOCKED');
 assert.doesNotMatch(z.stdout+z.stderr,/A-001|p549-local-|sale\.csv/);
});
