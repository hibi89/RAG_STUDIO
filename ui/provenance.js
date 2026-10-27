/** Resolve only citations present in the validated overview; no filesystem access. */
export function resolveCitation(overview, citation) {
  if (!overview || !citation || typeof citation !== 'object' || Array.isArray(citation)) return null;
  if (typeof citation.file_id !== 'string' || !citation.file_id) return null;
  if (Object.hasOwn(citation, 'csv_line')) {
    if (!Array.isArray(overview.dataset?.source_rows)) return null;
    const source = overview.dataset.source_rows.find(row =>
      row.file_id === citation.file_id &&
      row.csv_line === citation.csv_line &&
      row.order_id === citation.order_id &&
      String(row.amount_krw) === String(citation.amount_krw));
    if (!source) return null;
    return {kind: 'dataset', file_id: source.file_id, csv_line: source.csv_line,
      order_id: source.order_id, amount_krw: String(source.amount_krw)};
  }
  if (!Array.isArray(overview.documents) ||
      typeof citation.document_id !== 'string' ||
      !Number.isSafeInteger(citation.line) || citation.line < 1 ||
      typeof citation.quote !== 'string' ||
      !citation.quote.trim() || citation.quote.length > 4096) return null;
  const doc = overview.documents.find(d =>
    d.document_id === citation.document_id &&
    d.file_id === citation.file_id &&
    d.import_status === 'ACCEPTED');
  if (!doc) return null;
  return {kind: 'document', document_id: doc.document_id, file_id: doc.file_id,
    line: citation.line, quote: citation.quote, source_title: doc.source_title};
}

/** JSON tuple encoding avoids ambiguous separators in source IDs. */
export function citationKey(ref) {
  if (ref.kind === 'dataset') return JSON.stringify(['dataset', ref.file_id, ref.csv_line, ref.order_id]);
  if (ref.kind === 'document') return JSON.stringify(['document', ref.document_id, ref.file_id]);
  return null;
}
