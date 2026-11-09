# P5.46 — RAG-owned PREP mapping handoff (2026-11-10 KST)

## Goal and source separation
RAG Studio AX Edition is the PREP-enabled customer product. The universal PREP engine remains private in SMAX. The RAG_STUDIO repository is public: no private SMAX source or private business strategy may be copied into it.

Two architectures were compared:
- Direct private-code reuse: fewer initial adapter steps but publicly discloses proprietary code and couples versioning. Rejected for public RAG_STUDIO.
- Public RAG-owned mapping adapter over existing RAG local CSV inspection and published SMAX V1 data contract. Selected for separate versioning, lower disclosure risk and maintainability.

## Implemented
- src/prep-mapping-plan.mjs: deterministic RAG_PREP_MAPPING_PLAN_V1 proposals; checks source metadata, canonical header collisions, explicit key/source/type mappings, and review blockers.
- src/prep-mapping-cli.mjs: read-only local CSV inspection -> mapping plan. Displays headers and type proposals only, not source rows or file paths. Local output should still be considered confidential because column names can reveal business data.
- tests/p546-prep-mapping-plan.test.mjs and tests/p546-prep-cli.test.mjs: 11 scoped Node tests including actual public RAG inspector, subprocess CLI and source byte preservation.

## Evidence and limitations
Linux Node 22.16.0: 11 PASS / 0 FAIL / 0 SKIP; node --check on CLI passes. Local copy of existing src/local-csv-review.mjs exactly matches remote Git blob 76fcab001cde51e71df8056a2eb51d808a57f522. Four newly tested code/test files match Git blob SHA.

Full RAG npm test, Windows CI and actual UI/browser, physical Windows PC, production, private SMAX Native integration, authorized customer data and real producer E2E have NOT been tested on this code.

## Developer commands
node src/prep-mapping-cli.mjs /absolute/authorized/local-file.csv
node --test tests/p546-*.test.mjs

From code: inspectCsvBytes(bytes) in src/local-csv-review.mjs -> buildRagPrepMappingPlan(review, [{key:'order_id',source:'order_id',type:'text',required:true}]). The result is only a proposal. Approval is NOT_GRANTED; status is REVIEW_HOLD. It is neither SMAX producer output nor AX_DATA_PACKAGE_V0.

## Next steps
1. Human-editable local mapping UI with explicit save/review state, still not approval.
2. RAG-only published contract compatibility fixture for latest private SMAX data format (no private implementation transfer).
3. Full public RAG regression and cross-platform tests, then verified PREP plan -> cited search preview.
4. Only after owner authorization and separate rights/consent and trusted-producer verification: real AX promotion and SQL/document indexing.

No other repo or branch is changed. P5.45 and develop diverged at start; do not force-push or automatically merge. Private SMAX PREP remains the single original engine.
