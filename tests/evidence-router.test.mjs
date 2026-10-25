import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {routeQuestion} from '../src/evidence-router.mjs';
const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
function isolated(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'rag-router-'));fs.cpSync(root,d,{recursive:true});t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}
function updateManifest(d,fn){const p=path.join(d,'manifest.json'),m=JSON.parse(fs.readFileSync(p));fn(m);fs.writeFileSync(p,JSON.stringify(m));}
function rewriteDocument(d,name,text){const p=path.join(d,name),bytes=Buffer.from(text,'utf8');fs.writeFileSync(p,bytes);updateManifest(d,m=>{const entry=m.files.find(f=>f.relative_path===name);entry.sha256=crypto.createHash('sha256').update(bytes).digest('hex');entry.size_bytes=bytes.length;});}
function addDocument(d,id,content){const name=`${id}.txt`,bytes=Buffer.from(content,'utf8');fs.writeFileSync(path.join(d,name),bytes);updateManifest(d,m=>{m.files.push({file_id:`file-${id}`,relative_path:name,kind:'document',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size_bytes:bytes.length,import_status:'ACCEPTED'});m.documents.push({document_id:`document-${id}`,file_id:`file-${id}`,language:'ko',source_title:'테스트 합성 문서',page_info:'lines:1-2',index_status:'NOT_INDEXED'});m.processing_summary.accepted++;});}
const mixed='총 매출과 반품 기간, 배송 준비 기간은?';
test('P2.1 combines fixed SQLite metric and two independently cited TXT policy claims',()=>{
 const r=routeQuestion(root,mixed);assert.equal(r.status,'ANSWERED');assert.equal(r.kind,'SQL_DOCUMENT');
 assert.equal(r.metric_evidence.revenue_krw,'157000');assert.equal(r.metric_evidence.orders,6);assert.equal(r.metric_evidence.units,'10');
 assert.deepEqual(r.metric_evidence.row_evidence.map(x=>x.csv_line),[2,3,4,5,6,7]);
 assert.deepEqual(r.document_evidence.map(x=>x.document_id),['document-returns','document-shipping']);
 assert.deepEqual(r.document_evidence.map(x=>x.line),[2,2]);
 assert.deepEqual(r.document_evidence.map(x=>x.period),[7,2]);assert.match(r.answer,/157,000원/);
});
test('P2.1 sales-only remains a fixed, source-linked SQLite aggregate',()=>{
 const r=routeQuestion(root,'총 매출 알려줘');assert.equal(r.status,'ANSWERED');assert.equal(r.kind,'SQL_ONLY');
 assert.equal(r.document_evidence.length,0);assert.equal(r.metric_evidence.row_evidence.length,6);
});
test('P2.1 doc-only supports individually cited returns and shipping',()=>{
 const a=routeQuestion(root,'반품 기간은?'),b=routeQuestion(root,'배송 준비는 언제 시작?');
 assert.equal(a.status,'ANSWERED');assert.equal(a.kind,'DOCUMENT_ONLY');assert.equal(a.metric_evidence,null);assert.equal(a.document_evidence[0].period,7);
 assert.equal(b.status,'ANSWERED');assert.equal(b.document_evidence[0].period,2);assert.equal(b.document_evidence[0].claim_kind,'business_days');
});
test('P2.1 no supported intent abstains',()=>{const r=routeQuestion(root,'제주도 내일 날씨는?');assert.equal(r.status,'NOT_SUPPORTED');assert.equal(r.answer,null);});
test('P2.1 enforces input type, whitespace and 500-char limit',()=>{
 for(const bad of [undefined,{},'','    ','가'.repeat(501)])assert.throws(()=>routeQuestion(root,bad),/question/);
});
test('P2.1 refuses partial multi-part answer when accepted shipping evidence absent',t=>{
 const d=isolated(t);updateManifest(d,m=>{m.files[2].import_status='NEEDS_REVIEW';m.processing_summary.accepted--;m.processing_summary.needs_review++;});
 const r=routeQuestion(d,mixed);assert.equal(r.status,'INSUFFICIENT_EVIDENCE');assert.equal(r.answer,null);assert.equal(r.metric_evidence,undefined);
});
test('P2.1 refuses unsupported temporal text rather than guessing',t=>{
 const d=isolated(t);rewriteDocument(d,'returns_policy.txt','[FAKE] 안내\n반품 문의는 고객센터에서 확인해 주세요.\n');
 const r=routeQuestion(d,'반품 기간');assert.equal(r.status,'INSUFFICIENT_EVIDENCE');assert.equal(r.answer,null);
});
test('P2.1 conflicting return periods abort whole mixed answer and provide review evidence',t=>{
 const d=isolated(t);addDocument(d,'alt-returns','[FAKE] 대체 반품 안내\n상품 수령 후 14일 이내 반품 신청 가능.\n');
 const r=routeQuestion(d,mixed);assert.equal(r.status,'POSSIBLE_CONFLICT');assert.equal(r.answer,null);assert.equal(r.metric_evidence,undefined);
 assert.deepEqual(new Set(r.review_evidence.map(e=>e.period)),new Set([7,14]));
});
test('P2.1 detects same-line contradictory periods',t=>{
 const d=isolated(t);rewriteDocument(d,'returns_policy.txt','[FAKE] 안내\n반품 신청은 7일 이내 가능하거나 14일 이내 가능.\n');
 const r=routeQuestion(d,'반품 기간');assert.equal(r.status,'POSSIBLE_CONFLICT');assert.equal(r.review_evidence.length,2);
});
test('P2.1 detects low ranked contradictions outside search top-10',t=>{
 const d=isolated(t);
 for(let i=0;i<12;i++)addDocument(d,`filler${String(i).padStart(2,'0')}`,`[FAKE] 보조\n반품 신청 가능 기간은 7일 이내 입니다.\n`);
 addDocument(d,'zzz-conflict','[FAKE] 오래된 지침\n반품 신청 가능 기간은 30일 이내 입니다.\n');
 const r=routeQuestion(d,'반품 기간');assert.equal(r.status,'POSSIBLE_CONFLICT');
 assert.ok(r.review_evidence.some(x=>x.document_id==='document-zzz-conflict'&&x.period===30));
});
test('P2.1 detects conflicting shipping preparation periods',t=>{
 const d=isolated(t);addDocument(d,'shipping-other','[FAKE] 배송 지침\n배송 준비는 결제 후 5영업일 이내 시작됩니다.\n');
 const r=routeQuestion(d,mixed);assert.equal(r.status,'POSSIBLE_CONFLICT');assert.match(r.reason,/shipping/);
});
test('P2.1 ignores search content that is not an explicit policy fact',t=>{
 const d=isolated(t);rewriteDocument(d,'shipping_policy.txt','[FAKE] 배송\n배송 준비는 담당자에게 문의하세요.\n');
 const r=routeQuestion(d,'배송 준비 언제');assert.equal(r.status,'INSUFFICIENT_EVIDENCE');
});
test('P2.1 tampered file digest rejects before claiming any metric or policy',t=>{
 const d=isolated(t);fs.appendFileSync(path.join(d,'shipping_policy.txt'),'tampered');
 assert.throws(()=>routeQuestion(d,'총 매출 알려줘'),/size|sha256/);
});
test('P2.1 leaves all input bytes untouched',()=>{
 const before=['sales.csv','returns_policy.txt','shipping_policy.txt','manifest.json'].map(x=>fs.readFileSync(path.join(root,x)));
 routeQuestion(root,mixed);
 for(const [index,name] of ['sales.csv','returns_policy.txt','shipping_policy.txt','manifest.json'].entries()) assert.deepEqual(fs.readFileSync(path.join(root,name)),before[index]);
});
test('P2.1 untrusted question cannot execute supplied SQL',()=>{
 const r=routeQuestion(root,'매출과 반품 기간: DROP TABLE sales; DELETE FROM sales;');
 assert.equal(r.status,'ANSWERED');assert.equal(r.metric_evidence.orders,6);assert.equal(r.document_evidence[0].period,7);
});
