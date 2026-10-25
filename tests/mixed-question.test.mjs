import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {answerMixedQuestion, withReadOnlySales} from '../src/mixed-question.mjs';
const fixture=fileURLToPath(new URL('../fixtures/ax_sample_v0/',import.meta.url));
function isolated(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p1-'));
  fs.cpSync(fixture,root,{recursive:true});
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
function update(root,callback) {
  const file=path.join(root,'manifest.json'); const json=JSON.parse(fs.readFileSync(file,'utf8')); callback(json);
  fs.writeFileSync(file,JSON.stringify(json));
}
function replaceDocument(root,text) {
  const buffer=Buffer.from(text,'utf8');fs.writeFileSync(path.join(root,'returns_policy.txt'),buffer);
  update(root,m=>{const d=m.files.find(f=>f.file_id==='file-policy');d.sha256=crypto.createHash('sha256').update(buffer).digest('hex');d.size_bytes=buffer.length;});
}
const question='이 쇼핑몰의 총 매출은 얼마이며 반품 규정은 어떻게 되나요?';
test('P1 answers one mixed SQL + TXT question with exact sums and line citation',()=>{
  const result=answerMixedQuestion(fixture,question);
  assert.equal(result.status,'ANSWERED'); assert.equal(result.kind,'SQL_DOCUMENT');
  assert.equal(result.sql_evidence.engine,'node:sqlite (in-memory)');
  assert.equal(result.sql_evidence.orders,6); assert.equal(result.sql_evidence.units,'10');
  assert.equal(result.sql_evidence.revenue_krw,'157000');
  assert.deepEqual(result.sql_evidence.row_evidence.map(r=>r.csv_line),[2,3,4,5,6,7]);
  assert.equal(result.document_evidence.file_id,'file-policy'); assert.equal(result.document_evidence.line,2);
  assert.match(result.document_evidence.quote,/7일 이내/);
  assert.match(result.answer,/157,000원/);
});
test('P1 really queries SQLite and enforces read-only mode',()=>{
  withReadOnlySales(fixture,({db,totals})=>{
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sales').get().n,6);
    assert.equal(totals.revenue_krw,157000);
    assert.throws(()=>db.exec('DELETE FROM sales'),/readonly|read.only/i);
  });
});
test('P1 source bytes remain untouched after querying',()=>{
  const a=fs.readFileSync(path.join(fixture,'sales.csv'));const b=fs.readFileSync(path.join(fixture,'returns_policy.txt'));
  answerMixedQuestion(fixture,question);
  assert.deepEqual(fs.readFileSync(path.join(fixture,'sales.csv')),a);
  assert.deepEqual(fs.readFileSync(path.join(fixture,'returns_policy.txt')),b);
});
test('P1 rejects unsupported questions instead of fabricating answer',()=>{
  assert.deepEqual(answerMixedQuestion(fixture,'내일 날씨 알려줘').status,'NOT_SUPPORTED');
});
test('P1 blocks LLM-style SQL injection by never executing question text',()=>{
  const r=answerMixedQuestion(fixture,"매출과 반품 규정 알려줘; DELETE FROM sales; DROP TABLE sales;");
  assert.equal(r.status,'ANSWERED');assert.equal(r.sql_evidence.orders,6);
});
test('P1 rejects invalid input length and type',()=>{
  assert.throws(()=>answerMixedQuestion(fixture,{}),/question/);
  assert.throws(()=>answerMixedQuestion(fixture,'A'.repeat(501)),/question/);
});
test('P1 tampered policy digest rejects response',t=>{
  const root=isolated(t);fs.appendFileSync(path.join(root,'returns_policy.txt'),'tamper');
  assert.throws(()=>answerMixedQuestion(root,question),/size|sha256/);
});
test('P1 policy content changes only with updated source citation, not fixed 7-day guess',t=>{
  const root=isolated(t);replaceDocument(root,'[FAKE] 안내\n상품 수령일부터 30일 이내 반품 신청 가능.\n');
  const r=answerMixedQuestion(root,question);
  assert.match(r.answer,/30일 이내/); assert.equal(r.document_evidence.line,2);
  assert.doesNotMatch(r.answer,/7일 이내/);
});
test('P1 no policy claim when verified TXT has no usable evidence',t=>{
  const root=isolated(t);replaceDocument(root,'[FAKE] 반품 정책\n담당자에게 문의하세요.\n');
  const r=answerMixedQuestion(root,question);
  assert.equal(r.status,'INSUFFICIENT_EVIDENCE');assert.equal(r.answer,null);
});
test('P1 blocks unapproved sales schema',t=>{
  const root=isolated(t);update(root,m=>m.datasets[0].columns[2].review_status='NEEDS_REVIEW');
  assert.throws(()=>answerMixedQuestion(root,question),/review/);
});
test('P1 rejects unsupported oversized integer before loss of precision',t=>{
  const root=isolated(t);const csv=fs.readFileSync(path.join(root,'sales.csv'),'utf8').replace('O-1001,N-01,2,15000,30000','O-1001,N-01,2,9007199254740993,18014398509481986');
  fs.writeFileSync(path.join(root,'sales.csv'),csv);
  update(root,m=>{const buf=fs.readFileSync(path.join(root,'sales.csv'));m.files[0].sha256=crypto.createHash('sha256').update(buf).digest('hex');m.files[0].size_bytes=buf.length;});
  assert.throws(()=>answerMixedQuestion(root,question),/range/);
});
test('P1 refuses missing document source pointer',t=>{
  const root=isolated(t);update(root,m=>m.documents[0].file_id='file-not-exist');
  assert.throws(()=>answerMixedQuestion(root,question),/reference/);
});
