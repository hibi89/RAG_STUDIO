import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {buildRagPrepMappingPlan} from '../src/prep-mapping-plan.mjs';
import {calculatePinnedSalesPreview} from '../src/prep-mapped-sales.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function ui(){const c={};c.globalThis=c;vm.runInNewContext(fs.readFileSync(path.join(root,'ui/prep-owner.js'),'utf8'),c,{timeout:1000});return c.RagPrepOwnerUI;}
function fixture(){const bytes=Buffer.from('주문번호,상품코드,수량,단가,매출\nA-001,N-01,2,100,200\nA-002,N-02,3,20,60\n');
 const rev=inspectCsvBytes(bytes),p=buildRagPrepMappingPlan(rev,[
 {key:'order_id',source:'주문번호',type:'text',required:true},
 {key:'sku',source:'상품코드',type:'text',required:true},
 {key:'quantity',source:'수량',type:'integer',required:true},
 {key:'unit_price_krw',source:'단가',type:'integer',required:true},
 {key:'amount_krw',source:'매출',type:'integer',required:true}]);
 const report=calculatePinnedSalesPreview({...p,owner_draft_rechecked:true},bytes);
 return {plan:JSON.parse(JSON.stringify(p)),report:JSON.parse(JSON.stringify(report))};}
test('P5.50 UI accepts only REVIEW_HOLD report pinned to the currently selected proposal',()=>{const {plan,report}=fixture();const x=ui().checkSalesPreview(report,plan);assert.equal(x.metrics.orders,2);assert.equal(x.metrics.revenue_krw,'260');assert.equal(x.customer_data_approved,false);});
test('P5.50 forged metrics and forged SKU subtotals rejected',()=>{const {plan,report}=fixture();for(const edit of [r=>r.metrics.orders++,r=>r.metrics.revenue_krw='261',r=>r.metrics.units='999',r=>r.sku_totals[0].revenue_krw='9999',r=>r.sku_totals[1].sku=r.sku_totals[0].sku]){const r=structuredClone(report);edit(r);assert.throws(()=>ui().checkSalesPreview(r,plan));}});
test('P5.50 owner source mismatch and fake APPROVED status rejected',()=>{const {plan,report}=fixture();for(const edit of [r=>r.source_sha256='0'.repeat(64),r=>r.status='APPROVED',r=>r.customer_data_approved=true,r=>r.sqlite_imported=true,r=>r.document_indexed=true,r=>r.remote_upload=true,r=>r.source_modified=true]){const r=structuredClone(report);edit(r);assert.throws(()=>ui().checkSalesPreview(r,plan));}});
test('P5.50 source line citations monotonic and bounded',()=>{const {plan,report}=fixture();for(const edit of [r=>r.source_evidence[0].source_line=1,r=>r.source_evidence[1].source_line=2,r=>r.source_evidence[0].sku='N-999',r=>r.evidence_truncated=true,r=>r.source_evidence=[],r=>r.source_evidence[0].amount_krw='-1']){const r=structuredClone(report);edit(r);assert.throws(()=>ui().checkSalesPreview(r,plan));}});
test('P5.50 no unsanitized HTML, eval, arbitrary SQL or HTTP upload primitives',()=>{const js=fs.readFileSync(path.join(root,'ui/prep-owner.js'),'utf8'),html=fs.readFileSync(path.join(root,'ui/prep-owner.html'),'utf8');assert.doesNotMatch(js,/innerHTML|eval\s*\(|fetch\s*\(|XMLHttpRequest|document\.write/);assert.match(html,/id="report-content"/);assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/https?:\/\//);});
