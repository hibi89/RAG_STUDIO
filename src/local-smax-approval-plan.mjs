/** P5.36: pure, local review-readiness plan for already verified P5.35 HOLD input.
 * This does not verify ownership/consent, authenticate a reviewer, grant
 * approval, persist an attestation or authorize import into AX / SQLite.
 */
import crypto from 'node:crypto';

const GATE = 'REVIEW_HOLD';
const BLOCKED = 'NOT_AUTHORIZED_FOR_AX_PROMOTION';
const HEX_SHA = /^[a-f0-9]{64}$/u;
const fail = () => {throw Object.assign(Error('LOCAL_SMAX_APPROVAL_PLAN_BLOCKED'),{code:'LOCAL_SMAX_APPROVAL_PLAN_BLOCKED'});};

// Fixed public checklist codes. Never include raw data, paths, user-entered
// attestations or speculative semantic classifications in this report.
const CHECKS = Object.freeze([
  ['RIGHTS_SOURCE', 'SOURCE_OWNERSHIP_OR_LICENSE'],
  ['RIGHTS_PROCESSING', 'PROCESSING_PERMISSION_AND_DATA_SUBJECT_RIGHTS'],
  ['SEMANTICS_COLUMNS', 'SOURCE_TO_SMAX_FIELD_MAPPING'],
  ['SEMANTICS_REVENUE', 'GROSS_NET_REFUNDS_AND_DISCOUNTS'],
  ['SEMANTICS_CURRENCY', 'KRW_UNIT_AND_ROUNDING'],
  ['SEMANTICS_TAX', 'VAT_INCLUDED_OR_EXCLUDED'],
  ['DOCUMENT_RIGHTS', 'DOCUMENT_OWNERSHIP_AND_REUSE'],
  ['DOCUMENT_VALIDITY', 'POLICY_VERSION_EFFECTIVE_DATE_AND_SCOPE'],
  ['PRODUCER_PROVENANCE', 'PRIVATE_SMAX_NATIVE_SIGNOFF'],
  ['REVIEWER_AUTH', 'REVIEWER_IDENTITY_AND_EXPLICIT_APPROVAL']
].map(([area,question_code]) => Object.freeze({area,question_code,status:'UNVERIFIED'})));

/** The caller must get HOLD from stageLocalSmaxReview after local file revalidation.
 * A standalone report is NOT an authenticated rights/consent assertion.
 */
export function buildLocalSmaxApprovalPlan(report) {
  if (!report || typeof report!=='object' || Array.isArray(report) ||
      report.contract!=='RAG_LOCAL_SMAX_REVIEW_HOLD_V1' || report.status!==GATE ||
      report.source_provenance!=='ORIGINAL_CSV_DIGEST_VERIFIED' ||
      !HEX_SHA.test(report.source_sha256) ||
      !Number.isSafeInteger(report.source_rows) || report.source_rows<1 ||
      !Number.isSafeInteger(report.rows_needing_review) || report.rows_needing_review<0 ||
      report.rows_needing_review>report.source_rows ||
      !report.document || typeof report.document!=='object' ||
      report.document.status!=='UNAPPROVED_TEXT_PREVIEW' ||
      !['.txt','.md'].includes(report.document.kind) ||
      !HEX_SHA.test(report.document.sha256) ||
      !Number.isSafeInteger(report.document.line_count) || report.document.line_count<1 ||
      !Number.isSafeInteger(report.document.size_bytes) || report.document.size_bytes<1 ||
      !['REVIEW_HOLD','CALCULATED_PREVIEW_NOT_APPROVED'].includes(report.sales_preview_status) ||
      ['ax_package_created','sqlite_imported','document_indexed','authenticated_reviewer',
       'source_rights_verified','smax_native_approved','customer_data_approved',
       'remote_upload','source_files_modified'].some(key => report[key]!==false)) fail();

  if (report.sales_preview_status==='CALCULATED_PREVIEW_NOT_APPROVED' &&
      report.rows_needing_review!==0) fail();

  const reviewKey = crypto.createHash('sha256').update([
    'RAG_LOCAL_SMAX_APPROVAL_PLAN_V1',report.source_sha256,report.document.sha256,
    String(report.source_rows),String(report.rows_needing_review),report.sales_preview_status
  ].join('|')).digest('hex');
  return Object.freeze({
    contract:'RAG_LOCAL_SMAX_APPROVAL_PLAN_V1', status:GATE,
    promotion_status:BLOCKED,
    // Fingerprint of unapproved source snapshots only, not proof of rights.
    review_key_sha256:reviewKey,
    source_sha256:report.source_sha256,
    document_sha256:report.document.sha256,
    source_rows:report.source_rows,
    rows_needing_review:report.rows_needing_review,
    source_integrity:'P535_DIGEST_AND_ROW_PREVIEW_VERIFIED_ONLY',
    review_items:CHECKS,
    unresolved_review_items:CHECKS.length,
    source_row_issues_pending:report.rows_needing_review>0,
    authenticated_reviewer:false,source_rights_verified:false,
    semantic_meanings_verified:false,customer_consent_verified:false,
    private_smax_native_signoff:false,
    ax_package_created:false,sqlite_imported:false,document_indexed:false,
    approval_record_persisted:false,remote_upload:false
  });
}
