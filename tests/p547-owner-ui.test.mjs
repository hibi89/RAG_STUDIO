import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {buildRagPrepMappingPlan} from '../src/prep-mapping-plan.mjs';
const base=fileURLToPath(new URL('../',import.meta.url));
const source=fs.readFileSync(path.join(base,'ui/prep-owner.js'),'utf8');
function init(){const ctx={};ctx.globalThis=ctx;vm.runInNewContext(source,ctx,{timeout:1000});return ctx.RagPrepOwnerUI;}
const plan=()=>buildRagPrepMappingPlan(inspectCsvBytes(Buffer.from('주문번호,수량\nA-777,2\n')));
test('P5.47 UI draft API uses validated real plan, never approves',()=>{const ui=init(),p=plan(),d=ui.createOwnerDraft(p,[{key:'order_id',type:'text',required:true},{key:'quantity',type:'integer',required:true}]);const parsed=JSON.parse(JSON.stringify(d));assert.equal(parsed.contract,'RAG_PREP_OWNER_MAPPING_V1');assert.equal(parsed.fields.length,2);assert.equal(parsed.fields[0].source,'주문번호');assert.deepEqual(Object.keys(parsed),['contract','source_sha256','source_size_bytes','fields']);assert.doesNotMatch(JSON.stringify(d),/A-777/);});
test('P5.47 UI no silent schema inference: missing choice produces held incomplete draft',()=>{const ui=init(),p=plan(),d=ui.createOwnerDraft(p,[{key:'',type:'',required:false},{key:'quantity',type:'integer',required:true}]);assert.equal(d.fields.length,1);});
test('P5.47 UI blocks invalid key, duplicate, extra choice and fake proposal approval',()=>{const ui=init(),p=plan();const v=[{key:'order_id',type:'text',required:true},{key:'quantity',type:'integer',required:true}];for(const mutate of [x=>x[0].key='DROP TABLE',x=>x[1].key='order_id',x=>x[1].type='eval',x=>x[0].extra=true,x=>x.push(v[0])]){const x=JSON.parse(JSON.stringify(v));mutate(x);assert.throws(()=>ui.createOwnerDraft(p,x));}const fake=JSON.parse(JSON.stringify(p));fake.proposed_columns[0].approval='APPROVED';assert.throws(()=>ui.checkPlan(fake));});
test('P5.47 offline HTML has strict CSP and only static local assets',()=>{const html=fs.readFileSync(path.join(base,'ui/prep-owner.html'),'utf8');assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);assert.match(html,/prep-owner\.js/);assert.doesNotMatch(source,/fetch\s*\(|XMLHttpRequest|innerHTML|eval\s*\(/);assert.doesNotMatch(html,/https?:\/\//);});
