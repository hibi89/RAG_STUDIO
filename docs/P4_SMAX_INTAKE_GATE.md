# P4.0 SMAX Generic CSV V1 → RAG Studio consumer boundary

2026-10-27 KST. Public synthetic-only code. **Not a live integration with the private SMAX producer.**

## Source fact and design options
Checked Private SMAX repo branch preprocessing at 5fac694954bcad053b8ad9761aa969474a5d2fe9. Its generic CSV producer returns SMAX_PREPROCESS_GENERIC_CSV_V1 (explicit field map, full original cells and row numbers, processing_mode DETERMINISTIC_LOCAL, approval NOT_GRANTED). Clean rows are still READY_FOR_HUMAN_REVIEW — *not* approved. Its native end-to-end test status belongs to the SMAX maintainer, not this repository. The private implementation was **not copied** into this public repository.

| Strategy | Direct implementation | Risk | Cost / maintenance | Decision |
| --- | --- | --- | --- | --- |
| A. Import V1 rows directly as AX_DATA_PACKAGE_V0 | Fastest hypothetical query demo | Implicit approval, semantics/units and sensitive raw columns not yet checked; may break RAG contract | Zero API cost, high safety/debug debt | Rejected until real human approval and full provenance are available |
| B. RAG-owned read-only contract gate | Check bounded producer output + optional original CSV SHA, redact all content, refuse promotion | Does not yet connect producer to query; requires a future separately approved export | Zero API cost, low coupling, bounded maintenance | **Selected** |

## Implemented
- src/smax-intake.mjs: independently implements **public minimum wire-shape checks** and fixed-code errors; no SMAX source, parser implementation or strategy copied. Reads no network, writes nothing, blocks symlink/oversize/invalid UTF-8, checks producer version/NOT_GRANTED/row and review counts. Optional source CSV SHA256+bytes check protects against a mismatched raw file.
- src/smax-intake-cli.mjs and npm run inspect:smax: with checked-in synthetic unapproved JSON+CSV prints only harmless counts, status REVIEW_REQUIRED and provenance SOURCE_DIGEST_VERIFIED. Without original CSV prints SOURCE_BYTES_NOT_SUPPLIED; it never claims to verify normalized values or perform human approval.
- fixtures/smax_v1_boundary: synthetic source.csv and unapproved.json; these **are independently authored test fixtures**, not copied SMAX business/customer data.
- tests/smax-intake.test.mjs: clean/unsupported/forged approval/review counter/duplicate/source tamper/symlink/UTF-8/size/no raw leak/no modification.
- *No AX_DATA_PACKAGE_V0 is created.* A future adapter requires named human-approved field definitions, currency/tax units, source-specific row semantics, original CSV source verification and a validated SMAX output from the actual producer. Separate release authorization required for actual customer data.

## Known limitations / guardrails
- This RAG gate is **not** the full private SMAX preprocessing validator: it does not reproduce date/decimal normalization or compare all mapped values to the raw cells. Structural acceptance remains review-only. The source hash is marked verified only if raw CSV bytes are actually supplied.
- No raw source cell, file path, column name, secret or personal data is included in the JSON report. Do not print or store the input JSON in bug reports; it may contain original sensitive cells.
- No private repository is changed, no actual customer content, no token, no Vercel/Production/Windows installer or paid API.

## Acceptance
Run via GitHub Actions Ubuntu 24.04 + Node 22.16.0: npm test; npm run inspect:smax; npm run doctor; npm run demo:router; node scripts/p32-browser-smoke.mjs. Results must be collected before claiming PASS.
Pending: independent real SMAX V1 producer artifact cross-test (synthetic only, respecting the private source boundary), explicit human review flow and AX_DATA_PACKAGE_V0 export, Windows install and private SMAX Native tests.
