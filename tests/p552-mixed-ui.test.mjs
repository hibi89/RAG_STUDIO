import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {buildRagPrepMappingPlan} from '../src/prep-mapping-plan.mjs';
import {previewLocalSalesAndPolicy} from '../src/prep-mixed-preview.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function ui(){const c={};c.globalThis=c;vm.runInNewContext(fs.readFileSync(path.join(root,'ui/prep-owner.js'),'utf8'),c,{timeout:1000});return c.RagPrepOwnerUI;}
function fixture(t,doc='반품 신청은 7일 이내 가능합니다.\n'){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p552-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const raw='주문번호,상품코드,수량,단가,매출\nA-001,N-01,2,100,200\n';
 const csv=path.join(tmp,'data.csv'),mapping=path.join(tmp,'mapping.json'),policy=path.join(tmp,'policy.txt');fs.writeFileSync(csv,raw);fs.writeFileSync(policy,doc);
 const b=fs.readFileSync(csv),r=inspectCsvBytes(b),fields=[['order_id','주문번호','text'],['sku','상품코드','text'],['quantity','수량','integer'],['unit_price_krw','단가','integer'],['amount_krw','매출','integer']].map(([key,source,type])=>({key,source,type,required:true}));
 fs.writeFileSync(mapping,JSON.stringify({contract:'RAG_PREP_OWNER_MAPPING_V1',source_sha256:r.source_sha256,source_size_bytes:b.length,fields}));
 const plan=buildRagPrepMappingPlan(r);const report=previewLocalSalesAndPolicy(csv,mapping,policy,'매출과 반품 기간');
 return {plan:JSON.parse(JSON.stringify(plan)),report:JSON.parse(JSON.stringify(report))};
}
test('P5.52 mixed UI only shows a held, source-pinned citation review',t=>{const f=fixture(t),p=ui().checkMixedPreview(f.report,f.plan);assert.equal(p.status,'PREVIEW_WITH_CITATIONS');assert.equal(p.answer,null);assert.equal(p.document_evidence.source_lines[0].source_line,1);});
test('P5.52 conflict cannot become an approved answer',t=>{const f=fixture(t,'반품은 7일 이내 신청 가능합니다.\n환불은 14일 이내 신청 가능합니다.\n');const p=ui().checkMixedPreview(f.report,f.plan);assert.equal(p.status,'POSSIBLE_CONFLICT');assert.equal(p.answer,null);assert.equal(p.document_evidence.source_lines.length,2);});
test('P5.52 forged approved, SQL or out-of-scope source rejected',t=>{const f=fixture(t);for(const change of [r=>r.approval='APPROVED',r=>r.answer='확정',r=>r.sqlite_imported=true,r=>r.document_indexed=true,r=>r.source_sha256='f'.repeat(64),r=>r.document_evidence.sha256='invalid',r=>r.metric_evidence.metrics.orders++]){const r=structuredClone(f.report);change(r);assert.throws(()=>ui().checkMixedPreview(r,f.plan));}});
test('P5.52 invalid citations and insufficient evidence rules are consistent',t=>{const f=fixture(t);for(const change of [r=>r.document_evidence.source_lines[0].source_line=0,r=>r.document_evidence.source_lines[0].quote='\u0000',r=>r.document_evidence.source_lines=[],r=>r.status='APPROVED',r=>r.document_evidence.source_lines[0].kind='TRUSTED']){const r=structuredClone(f.report);change(r);assert.throws(()=>ui().checkMixedPreview(r,f.plan));}});
test('P5.52 HTML and client use textContent only, no external upload or dynamic HTML',()=>{const html=fs.readFileSync(path.join(root,'ui/prep-owner.html'),'utf8'),js=fs.readFileSync(path.join(root,'ui/prep-owner.js'),'utf8');assert.match(html,/id="mixed-report"/);assert.match(html,/connect-src 'none'/);assert.doesNotMatch(js,/innerHTML|fetch\s*\(|eval\s*\(|XMLHttpRequest/);assert.match(js,/mixedLines\.appendChild\(li\)/);});
