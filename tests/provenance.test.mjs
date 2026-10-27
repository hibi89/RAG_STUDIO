import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCitation, citationKey} from '../ui/provenance.js';
const overview = Object.freeze({
  dataset: {source_rows: [Object.freeze({file_id: 'file-sales', csv_line: 3, order_id: 'O-001', amount_krw: '12000'})]},
  documents: [Object.freeze({document_id: 'doc-policy', file_id: 'file-policy', import_status: 'ACCEPTED', source_title: '환불 규정'}),
    Object.freeze({document_id: 'doc-draft', file_id: 'file-draft', import_status: 'NEEDS_REVIEW', source_title: '미승인'})]
});
const row = {file_id: 'file-sales', csv_line: 3, order_id: 'O-001', amount_krw: '12000'};
const doc = {document_id: 'doc-policy', file_id: 'file-policy', line: 2, quote: '반품은 7일 이내 신청'};
test('P3.2 exact synthetic CSV citation resolves to the original row', () => {
  assert.deepEqual(resolveCitation(overview, row), {...row, kind: 'dataset'});
});
test('P3.2 rejects a changed CSV amount', () => {
  assert.equal(resolveCitation(overview, {...row, amount_krw: '999999'}), null);
});
test('P3.2 rejects unrelated CSV row, order and file identifiers', () => {
  for (const update of [{csv_line: 5}, {order_id: 'O-002'}, {file_id: 'file-evil'}])
    assert.equal(resolveCitation(overview, {...row, ...update}), null);
});
test('P3.2 approved document resolves with exact source and quote', () => {
  assert.deepEqual(resolveCitation(overview, doc), {...doc, kind: 'document', source_title: '환불 규정'});
});
test('P3.2 unapproved document never resolves', () => {
  assert.equal(resolveCitation(overview, {...doc, file_id: 'file-draft', document_id: 'doc-draft'}), null);
});
test('P3.2 rejects invalid document line and missing quote', () => {
  for (const update of [{line: 0}, {line: 1.1}, {line: '2'}, {quote: ''}, {quote: 'x'.repeat(4097)}])
    assert.equal(resolveCitation(overview, {...doc, ...update}), null);
});
test('P3.2 rejects mismatched document identities', () => {
  assert.equal(resolveCitation(overview, {...doc, document_id: 'other'}), null);
  assert.equal(resolveCitation(overview, {...doc, file_id: 'other'}), null);
});
test('P3.2 rejects missing overview and untrusted citation types', () => {
  for (const c of [null, 'abc', [], {}, {file_id: ''}]) assert.equal(resolveCitation(overview, c), null);
  assert.equal(resolveCitation(null, doc), null);
});
test('P3.2 citation keys preserve types and prevent ambiguous concatenation', () => {
  assert.notEqual(citationKey({kind: 'dataset', file_id: 'x', csv_line: 12, order_id: '3'}),
    citationKey({kind: 'dataset', file_id: 'x', csv_line: 1, order_id: '23'}));
  assert.notEqual(citationKey({kind: 'document', document_id: 'x', file_id: 'y'}),
    citationKey({kind: 'dataset', file_id: 'x', csv_line: 'y', order_id: ''}));
});
test('P3.2 resolver does not modify caller data', () => {
  const before = JSON.stringify(overview);
  resolveCitation(overview, row);
  resolveCitation(overview, doc);
  assert.equal(JSON.stringify(overview), before);
});
