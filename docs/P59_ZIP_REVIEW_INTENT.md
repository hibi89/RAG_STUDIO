# P5.9 — SHA-bound ZIP review intent (not authorization)

Updated 2026-10-27 KST. Public synthetic contract. Scoped `feature/p59-zip-review-boundary`.

## Decision and design tradeoff
- A: Add an `approved` switch inside P5.8 ZIP parsing and unlock extraction when a caller supplies it. Smaller implementation, but unsafe: ZIP structure cannot establish legal ownership, privacy compliance, reviewer identity or meaningful business field semantics.
- **B (selected):** independent `src/zip-review-intent.mjs` requiring a fully P5.8-validated in-memory ZIP, exact SHA256-bound self-declaration, and typed attestation vocabulary. The strongest possible output is `UNTRUSTED_REVIEW_REQUEST_RECORDED`. No extraction, import or AX conversion can be enabled through this API. Node built-ins only, no account/login/payment/network/file writes.

## Wire contract
`assessZipReviewIntent(zipBuffer, reviewRecord = null)` runs the complete P5.8 structural CRC preflight every call, hashes the exact bytes, and returns a frozen fixed-shape report. No review -> `REVIEW_NOT_RECORDED`. `decision:HOLD` or `UNKNOWN` rights/privacy -> `REVIEW_HOLD`. Correct, complete form requesting review -> `UNTRUSTED_REVIEW_REQUEST_RECORDED`.

Exact `RAG_ZIP_REVIEW_INTENT_V1` record fields:
- `schema_version`
- `archive_sha256`: exact lowercase 64 hex digest of the current, re-inspected ZIP bytes
- `scope: LOCAL_OFFLINE_ASSESSMENT_ONLY`
- `rights_attestation: DECLARED_AUTHORIZED | UNKNOWN`
- `privacy_attestation: DECLARED_REVIEWED | UNKNOWN`
- `semantic_review: PENDING_SEPARATE_VALIDATION`
- `decision: HOLD | REQUEST_TRUSTED_REVIEW`
- `acknowledgement: I_UNDERSTAND_THIS_DOES_NOT_AUTHORIZE_IMPORT`

Unknown keys, overclaiming or malformed fields, changed ZIP bytes, unsafe archive paths and invalid CRC all fail closed. Record intentionally does NOT include names, uploaded source text, reviewer PII or a verified signature. A reviewer may fabricate every declaration; no identity, license, consent scope or data protection verification occurs.

The only permitted response status values are informational. Every response sets `reviewer_identity_verified:false`, `ownership_or_license_verified:false`, `privacy_compliance_verified:false`, `semantic_mapping_approved:false`, `malware_scanned:false`, `import_authorized:false`, `extraction_allowed:false`, `ax_package_created:false`, and `customer_data_allowed:false`. A caller must never treat `UNTRUSTED_REVIEW_REQUEST_RECORDED` as approval or as a signal to read/extract ZIP contents.

## Validation
- `node --test tests/p59-zip-review-intent.test.mjs` for 12 synthetic positive/negative tests.
- `npm test`, `npm run doctor`, `npm run test:gold`, `npm run test:negative`, `npm run test:heldout`, `node scripts/p32-browser-smoke.mjs` for regression in connected GitHub Actions. Record actual run ID and count in STATUS/HANDOFF only after execution.
- Integration of actual trusted reviewer identity and durable authorization, re-checking digest immediately before ingestion, privacy/classification, real original RAG ZIP, SMAX native producer, Windows/Edge, unsupported ZIP variants, malware scanning, real customer data, MSI/EXE, P5.7 opt-in 7-journey browser E2E remain separate/unverified.

This phase is a guardrail for future workflow design, not an implementation of an approved importer. Never promote default `main` or deploy as a saleable application from synthetic tests.
