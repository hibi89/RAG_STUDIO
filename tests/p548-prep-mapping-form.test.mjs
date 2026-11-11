import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {createRagPrepMappingForm,writeRagPrepMappingForm} from '../src/prep-mapping-form.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const csv=Buffer.from('주문번호,quantity,amount_krw\nA-1,2,12.50\n','utf8');
const review=()=>inspectCsvBytes(csv);
const scratch=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p548-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};

test('P5.48 form renders escaped header-only metadata without row values or file paths',()=>{
 const h=createRagPrepMappingForm(review());
 const digest=crypto.createHash('sha256').update(csv).digest('hex');
 assert.match(h,/Content-Security-Policy/);
 assert.match(h,/connect-src &#39;none&#39;/);
 assert.match(h,/data-source="주문번호"/);
 assert.match(h,new RegExp(digest));
 assert.doesNotMatch(h,/A-1|12\.50|confidential-source|https?:\/\//);
 assert.equal((h.match(/<tr data-source=/g)||[]).length,3);
 assert.match(h,/REVIEW_HOLD\/NOT_GRANTED/);
});
test('P5.48 script hash in CSP matches constant inline script exactly',()=>{
 const h=createRagPrepMappingForm(review());
 const match=h.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match);
 const actual=crypto.createHash('sha256').update(match[1]).digest('base64');
 assert.ok(h.includes(actual));
 assert.doesNotMatch(match[1],/fetch\(|XMLHttpRequest|WebSocket/);
 assert.match(match[1],/source_sha256:sha/);
});
test('P5.48 HTML-escapes hostile CSV headers and does not execute them as markup',()=>{
 const hostile=Buffer.from('<img src=x onerror=alert(1)>,amount\nprivate-x,1\n','utf8');
 const h=createRagPrepMappingForm(inspectCsvBytes(hostile));
 assert.doesNotMatch(h,/<img/);
 assert.match(h,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(h,/private-x/);
});
test('P5.48 generated UI contains selection for all inferred typed columns, no implicit mapping',()=>{
 const h=createRagPrepMappingForm(review());
 assert.match(h,/<option value="integer" selected>/);
 assert.match(h,/<option value="decimal" selected>/);
 assert.match(h,/data-key maxlength="64"/);
 assert.doesNotMatch(h,/data-key[^>]*value="order_id"/);
});
test('P5.48 actual CLI exclusively writes new user-chosen HTML, leaves CSV untouched',t=>{
 const dir=scratch(t),source=path.join(dir,'secret-input.csv'),target=path.join(dir,'review.html');
 fs.writeFileSync(source,csv);
 const p=spawnSync(process.execPath,['src/prep-mapping-form-cli.mjs',source,target],{cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(p.status,0,p.stderr);
 const result=JSON.parse(p.stdout);
 assert.deepEqual([result.status,result.file_created,result.ax_package_created,result.sqlite_imported,result.approved],
  ['FORM_CREATED_REVIEW_HOLD',true,false,false,false]);
 assert.doesNotMatch(p.stdout+p.stderr,/secret-input|review\.html|A-1|12\.50|rag-p548-/);
 assert.deepEqual(fs.readFileSync(source),csv);
 assert.doesNotMatch(fs.readFileSync(target,'utf8'),/A-1|12\.50|secret-input/);
 assert.ok(fs.statSync(target).isFile());
});
test('P5.48 refuses overwrite and preserves original HTML bytes',t=>{
 const dir=scratch(t),target=path.join(dir,'existing.html');
 fs.writeFileSync(target,'ORIGINAL HTML');
 assert.throws(()=>writeRagPrepMappingForm(review(),target),/RAG_PREP_FORM_BLOCKED/);
 assert.equal(fs.readFileSync(target,'utf8'),'ORIGINAL HTML');
});
test('P5.48 invalid output extensions or relative paths fail before writing',t=>{
 const dir=scratch(t);
 for(const target of ['review.html','',path.join(dir,'review.json')])
  assert.throws(()=>writeRagPrepMappingForm(review(),target),/RAG_PREP_FORM_BLOCKED/);
 assert.equal(fs.readdirSync(dir).length,0);
});
test('P5.48 invalid/unapproved review metadata fails closed, no output',t=>{
 const dir=scratch(t),target=path.join(dir,'review.html');
 for(const mutate of [r=>r.customer_data_approved=true,r=>r.smax_native_approved=true,
  r=>r.columns[0].name='\u200b',r=>r.source_sha256='bad']){
  const r=review();mutate(r);
  assert.throws(()=>writeRagPrepMappingForm(r,target),/RAG_PREP_MAPPING_BLOCKED/);
  assert.equal(fs.existsSync(target),false);
 }
});
test('P5.48 CLI refuses malformed CSV/no arguments, no output or source leak',t=>{
 const dir=scratch(t),source=path.join(dir,'secret-input.csv'),target=path.join(dir,'review.html');
 fs.writeFileSync(source,'id,name\n1,"unclosed\n');
 for(const args of [[source,target],[]]){
  const p=spawnSync(process.execPath,['src/prep-mapping-form-cli.mjs',...args],{cwd:root,encoding:'utf8',timeout:10000});
  assert.equal(p.status,1);
  assert.deepEqual(JSON.parse(p.stdout),{status:'PREP_FORM_BLOCKED',file_created:false,ax_package_created:false});
  assert.doesNotMatch(p.stdout+p.stderr,/secret-input|review\.html|unclosed/);
  assert.equal(fs.existsSync(target),false);
 }
});
