/** RAG Studio-owned, public PREP handoff: mapping suggestions only.
 * Consumes RAG_LOCAL_CSV_REVIEW_V1 produced by existing local-csv-review.
 * This is never an SMAX producer, an authorization, or an AX/SQLite importer.
 */
const TYPES = Object.freeze({TEXT:'text',INTEGER:'integer',DECIMAL:'decimal',DATE:'date',BOOLEAN:'boolean'});
const VALID_TYPES = new Set(Object.values(TYPES));
const UNSAFE_HEADER = /[\u0000-\u001f\u007f-\u009f\p{Default_Ignorable_Code_Point}]/u;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fail = () => { throw Object.assign(new Error('RAG_PREP_MAPPING_BLOCKED'), {code:'RAG_PREP_MAPPING_BLOCKED'}); };
const key = x => typeof x === 'string' && /^[a-z][a-z0-9_]{0,63}$/u.test(x);
const canonical = s => s.normalize('NFKC').toLowerCase();
const integer = x => Number.isSafeInteger(x) && x >= 0;

export function buildRagPrepMappingPlan(review, requested = []) {
  if (!isObject(review) || review.schema !== 'RAG_LOCAL_CSV_REVIEW_V1' ||
      review.status !== 'NEEDS_REVIEW' || review.local_only !== true ||
      review.customer_data_approved !== false || review.smax_native_approved !== false ||
      review.ax_package_created !== false || review.imported_to_sqlite !== false ||
      review.original_modified !== false ||
      typeof review.source_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(review.source_sha256) ||
      !integer(review.source_size_bytes) || review.source_size_bytes > 1024*1024 ||
      !integer(review.row_count) || !integer(review.total_issues) ||
      !integer(review.formula_like_cell_count) || !Array.isArray(review.columns) ||
      review.columns.length < 1 || review.columns.length > 64 ||
      !Array.isArray(requested) || requested.length > 64) fail();
  const seen = new Set(), byHeader = new Map();
  for (let i = 0; i < review.columns.length; i++) {
    const c = review.columns[i];
    if (!isObject(c) || c.column_index !== i + 1 || typeof c.name !== 'string' ||
        !c.name || c.name !== c.name.trim() || UNSAFE_HEADER.test(c.name) ||
        !['EMPTY','MIXED',...Object.keys(TYPES)].includes(c.inferred_type) ||
        c.review_status !== 'NEEDS_REVIEW') fail();
    const id = canonical(c.name);
    if (seen.has(id)) fail();
    seen.add(id); byHeader.set(c.name, c);
  }
  const usedKeys = new Set(), usedSources = new Set();
  const mappings = requested.map(m => {
    if (!isObject(m) || Object.keys(m).length !== 4 || !key(m.key) ||
        typeof m.source !== 'string' || !byHeader.has(m.source) ||
        !VALID_TYPES.has(m.type) || typeof m.required !== 'boolean' ||
        usedKeys.has(m.key) || usedSources.has(m.source)) fail();
    usedKeys.add(m.key); usedSources.add(m.source);
    const c = byHeader.get(m.source);
    const inferred = TYPES[c.inferred_type] ?? null;
    // TEXT and DECIMAL are intentionally not silently coerced to numeric types.
    const typeReview = inferred === null || (inferred !== m.type &&
      !(inferred === 'integer' && m.type === 'decimal'));
    return Object.freeze({key:m.key, source:m.source, type:m.type, required:m.required,
      column_index:c.column_index, inferred_type:inferred,
      type_review_required:typeReview, approval:'NOT_GRANTED'});
  });
  const candidates = review.columns.map(c => Object.freeze({
    source:c.name, column_index:c.column_index, inferred_type:TYPES[c.inferred_type] ?? null,
    proposed_key:null, approval:'NOT_GRANTED'}));
  const blockers = ['HUMAN_FIELD_SEMANTICS_UNVERIFIED','SOURCE_RIGHTS_UNVERIFIED',
    'SMAX_NATIVE_PRODUCER_UNVERIFIED'];
  if (review.total_issues > 0 || review.formula_like_cell_count > 0)
    blockers.push('CSV_QUALITY_REVIEW_REQUIRED');
  if (mappings.some(m => m.type_review_required)) blockers.push('TYPE_MISMATCH_REVIEW_REQUIRED');
  if (!mappings.length || mappings.length !== review.columns.length)
    blockers.push('MAPPING_INCOMPLETE');
  return Object.freeze({contract:'RAG_PREP_MAPPING_PLAN_V1',status:'REVIEW_HOLD',
    input_contract:'RAG_LOCAL_CSV_REVIEW_V1',target_contract:'SMAX_PREPROCESS_GENERIC_CSV_V1',
    source_sha256:review.source_sha256,source_size_bytes:review.source_size_bytes,
    source_rows:review.row_count,quality_issues:review.total_issues,
    proposed_columns:Object.freeze(candidates), requested_mapping:Object.freeze(mappings),
    blockers:Object.freeze(blockers),
    approval:'NOT_GRANTED',source_rights_verified:false,customer_data_approved:false,
    smax_native_approved:false,ax_package_created:false,sqlite_imported:false,
    document_indexed:false,remote_upload:false,source_modified:false});
}
