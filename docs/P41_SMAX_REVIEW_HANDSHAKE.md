# P4.1 — independent source-row and semantic review handshake

Date: 2026-10-27 KST. Repo Public RAG_STUDIO; feature/p41-smax-review-handshake.
**Synthetic data and operator-intent demonstration only; no authenticated human approval or production import.**

## Design comparison

| Option | Quality/security | Cost/maintenance | Decision |
| --- | --- | --- | --- |
| A. Flip V1 approval flag or infer field mapping from titles, export AX_DATA_PACKAGE_V0 directly | Breaks SMAX NOT_GRANTED semantics, no real reviewer identity, silent currency/tax misinterpretation, forged row/data risk | Short implementation, high future maintenance and liability | REJECT |
| B. Independently compare exact raw CSV rows and V1 cell/value lineage, require explicit review intent with units, tax handling and all source rows, and **still deny AX export** until authenticated human approval mechanism exists | Fail-closed, transparent and limited to 3 known columns; no false approval | Pure Node / no new dependency/API/monthly fees | SELECTED |

## Implemented

- src/smax-review.mjs: P4.0 inspectSmaxV1 + raw source SHA/byte check followed by independent simple, unquoted CSV parser; compares header, each 1-based source_record, raw source_cells and normalized values, enforces unique ASCII-safe order_id, strictly positive safe-integer quantity, nonnegative safe-integer KRW total amount. It refuses any rows/issues needing review, excess fields, unsupported quoting/multiline, invalid review shape or CSV tampering. It is a **deliberately narrow synthetic slice**, not a generic RFC4180 CSV parser or independent validator for all SMAX normalization modes.
- A review-intent object with version RAG_SMAX_REVIEW_V0 binds exact source SHA, field roles, KRW unit, LINE_TOTAL meaning, an explicit tax basis choice, every ordered source_record, decision HOLD or CONFIRM_FOR_NEXT_GATE, and a fixed acknowledgement. It does not store an operator's identity and **cannot prove the reviewer is a human** or that the declared tax status is true.
- Returns PENDING_SEMANTIC_REVIEW without intent, REVIEW_HOLD on hold, REVIEW_RECORD_READY on explicit intent. **All three have ax_package_created=false and reviewer_identity_verified=false.** No AX_DATA_PACKAGE_V0 producer/export/SQLite insertion, file write or remote network transmission.
- scripts/p41-synthetic-review.mjs and npm run demo:smax:review illustrate pending -> intended review step on public synthetic fixture, without exposing row values in output.
- tests/smax-review.test.mjs includes tampering, missed/duplicate rows, wrong currency/tax, forged normalized values, no-auto-approval, no-secret-output and source immutability.

## Security and accuracy boundaries

1. Current P4.0 inspectSmaxV1 validates a minimal public wire shape, not full Private SMAX normalization logic; the private source is not copied or changed. RAG P4.1 *rechecks* raw row values for the limited 3-column CSV only.
2. Accepted source format for this feature: UTF-8, 3 unique unquoted headers, literal comma-separated single-line records ending with a newline (CRLF or LF), at most 1000 records, bounded earlier by P4.0 2 MiB and 4 MiB JSON. Quoted fields/escaped commas and formulas, other datasets, PDF/ZIP are not supported. This must not silently mutate/normalize customer data.
3. The source SHA is a data binding/checksum, **not an approval signature or proof of human identity**. Client business semantics and tax basis must later be confirmed via trusted local review UI/approval record and supplier/consumer contract. No additional system may interpret REVIEW_RECORD_READY as a permission to create real database tables, customer analysis or public release.
4. Public repo has only synthetic fixtures. Private SMAX preprocessing source was inspected read-only, and may evolve separately; downstream adapter must stay contract-driven.
5. No Windows installer / 3-PC QA, original RAG archive, PDF/DOCX and dense retrieval, actual private producer native cross-test or customer data. No commercial readiness.

## Verification plan

Use one narrowly triggered GitHub Actions Ubuntu 24.04 Node 22.16.0 free standard runner to execute npm test, npm run inspect:smax, npm run demo:smax:review, npm run doctor, npm run demo:router, and previous real Chrome smoke. Track exact pass/fail and commit SHA. No success should be claimed until job completed. After clean acceptance fast-forward this feature to develop without force, keep main unreleased, and record STATUS/HANDOFF.
