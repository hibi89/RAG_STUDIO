/** P1 minimal SQL + Document vertical slice. Synthetic-data-only demo; no LLM/agent SQL. */
import { DatabaseSync } from 'node:sqlite';
import { loadPackage, fail } from './validate.mjs';
import { aggregateSales } from './summary.mjs';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const SQL_TOTALS = 'SELECT COUNT(*) AS orders, COALESCE(SUM(quantity), 0) AS units, COALESCE(SUM(amount_krw), 0) AS revenue_krw FROM sales';
const SQL_ROWS = 'SELECT order_id, sku, amount_krw, csv_line FROM sales ORDER BY csv_line';

function checkedInteger(raw, label, positive = false) {
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) fail(`${label}: unsigned decimal required`);
  const value = BigInt(raw);
  if (value > MAX_SAFE || (positive && value === 0n)) fail(`${label}: outside supported range`);
  return Number(value);
}

/** Import only verified, explicitly approved fixture rows to a private in-memory SQLite DB. */
export function withReadOnlySales(root, operation) {
  const expected = aggregateSales(root); // validates schema, SHA-256, row arithmetic and approval
  if (BigInt(expected.revenue_krw) > MAX_SAFE || BigInt(expected.units) > MAX_SAFE) {
    fail('sales total outside supported exact SQLite number range');
  }
  const pkg = loadPackage(root);
  const sales = pkg.manifest.datasets.find(d => d.dataset_id === 'dataset-sales');
  const csv = pkg.textMap.get(sales.file_id);
  const db = new DatabaseSync(':memory:'); // no customer DB writes
  try {
    db.exec('CREATE TABLE sales (order_id TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price_krw INTEGER NOT NULL, amount_krw INTEGER NOT NULL, csv_line INTEGER NOT NULL UNIQUE)');
    const insert = db.prepare('INSERT INTO sales (order_id, sku, quantity, unit_price_krw, amount_krw, csv_line) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [index, line] of csv.replace(/\r\n/g, '\n').trimEnd().split('\n').slice(1).entries()) {
      const [order, sku, units, price, amount] = line.split(',');
      insert.run(order, sku, checkedInteger(units, 'quantity', true), checkedInteger(price, 'unit price'), checkedInteger(amount, 'amount'), index + 2);
    }
    db.exec('PRAGMA query_only = ON'); // defense in depth, no arbitrary SQL from end users
    const totals = db.prepare(SQL_TOTALS).get();
    for (const field of ['orders', 'units', 'revenue_krw']) {
      if (!Number.isSafeInteger(totals[field])) fail(`sqlite ${field}: unsafe numeric result`);
    }
    if (totals.orders !== expected.orders || String(totals.units) !== expected.units || String(totals.revenue_krw) !== expected.revenue_krw) {
      fail('SQLite aggregate differs from validated source');
    }
    return operation(Object.freeze({db, totals, expected, pkg}));
  } finally {
    db.close();
  }
}

function citedReturnPolicy(pkg) {
  const doc = pkg.manifest.documents.find(d => d.document_id === 'document-returns');
  if (!doc) return null;
  const file = pkg.fileMap.get(doc.file_id);
  if (file?.kind !== 'document' || file.import_status !== 'ACCEPTED' || !file.relative_path.toLowerCase().endsWith('.txt')) return null;
  const content = pkg.textMap.get(file.file_id);
  if (typeof content !== 'string') return null;
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const index = lines.findIndex((line, i) => i > 0 && /반품|환불/.test(line) && /가능|기간|이내|제한/.test(line) && !/테스트용|실제 약관/.test(line));
  if (index < 0) return null;
  return {document_id: doc.document_id, file_id: doc.file_id, source_title: doc.source_title, line: index + 1, quote: lines[index].trim()};
}

/** Narrow deterministic intent: one question must ask for both sales and return policy. */
export function answerMixedQuestion(root, question) {
  if (typeof question !== 'string' || question.length === 0 || question.length > 500) fail('question must be 1..500 characters');
  if (!/매출|매상|판매\s*금액|주문\s*금액/.test(question) || !/반품|환불/.test(question)) {
    return {status: 'NOT_SUPPORTED', answer: null, reason: 'Only sales totals combined with return/refund policy are supported in P1'};
  }
  return withReadOnlySales(root, ({db, totals, expected, pkg}) => {
    const docEvidence = citedReturnPolicy(pkg);
    if (!docEvidence) return {status:'INSUFFICIENT_EVIDENCE', answer:null, reason:'No approved TXT line supporting the requested policy'};
    const rowEvidence = db.prepare(SQL_ROWS).all().map(row => ({file_id:expected.dataset_file_id, csv_line:row.csv_line, order_id:row.order_id, amount_krw:String(row.amount_krw)}));
    return {
      status:'ANSWERED', kind:'SQL_DOCUMENT',
      answer:`합성 매출은 ${totals.revenue_krw.toLocaleString('ko-KR')}원이며 주문 ${totals.orders}건, 판매 수량 ${totals.units}개입니다. 반품 규정: ${docEvidence.quote}`,
      sql_evidence:{engine:'node:sqlite (in-memory)',dataset_file_id:expected.dataset_file_id,aggregation:'fixed_read_only_sales_totals',orders:totals.orders,units:String(totals.units),revenue_krw:String(totals.revenue_krw),row_evidence:rowEvidence},
      document_evidence:docEvidence,
      limits:['synthetic demo only','not an LLM','no PDF/vector retrieval','no arbitrary SQL']
    };
  });
}
