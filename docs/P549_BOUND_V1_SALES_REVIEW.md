# P5.49 — source-bound PREP draft ↔ untrusted SMAX V1 local review

Date: 2026-11-11 KST. Public RAG_STUDIO feature/p549-prep-smax-boundary. Reuses existing public SMAX V1 intake and verified sales preview, never copies Private SMAX engine code.

## Actual integration
- src/prep-smax-boundary.mjs receives the P5.46/P5.47 validated draft and original byte-verified CSV review, public SMAX_PREPROCESS_GENERIC_CSV_V1 JSON and identical source bytes.
- Verifies draft SHA and original bytes, exact source header ordering and every requested key/source/type/required binding against producer fields, plus existing SMAX V1 source provenance and row counters.
- For the **specific public synthetic sales schema** order_id/sku/quantity/unit_price_krw/amount_krw, invokes the existing canonical row-provenance and arithmetic verifier previewSmaxSales. Verified published example has 6 orders, 10 units and 157,000 KRW in aggregate, plus no importer enabled.
- Other schemas remain REVIEW_HOLD with ROW_VALUES_UNVERIFIED and no claims about row-level provenance or revenue.
- src/prep-smax-boundary-cli.mjs reads only explicit absolute original CSV, owner draft JSON and untrusted SMAX V1 JSON locally, refusing symlinks, changes, oversized/malformed input. It emits no row values or paths.
- All outputs remain REVIEW_HOLD, approval NOT_GRANTED, customer_data_approved false, smax_native_approved false, AX/SQLite/index/remote_upload false. Reported local synthetic sales totals are not an approved business report.

## Test results and correction
- tests/p549-prep-smax-boundary.test.mjs: 9 tests covering public fixed fixture metrics, SHA/mapping/forged approval refusal, non-sales review-only, quality review, input immutability, real CLI, stale/invalid files and symlinks. Exact fixture is synthetic.
- Initial cross-platform workflow #42942736604 failed 5 tests because new code incorrectly read a SHA field from the reduced inspectSmaxV1 summary, rather than validated pkg.source.sha256. Detected with job logs and fixed in source SHA 3e3be13e057179c0fdc7ada1b8a55f1e6b6df98f; subsequent P5.49 workflow #42943026453 completed SUCCESS (Linux Node22.16 + Windows Node22.23 full suite, gold/negative/heldout/router).
- Also corrected inherited malformed P5.45 GitHub Actions workflow setup-node inline YAML in this feature branch only (commit 2499362d2a7ea63b783263c8fb6eb90014f0ce62). Previous P5.45 empty-job failures on unrelated branch were YAML parse failures, not app test evidence.
- Linux/Windows CI are runner environments, not real owner PC/browser. Developer local source copies cannot execute full P5.49 without the complete canonical dependency repo, but exact source/test SHA can be verified against GitHub and CI.

## Boundaries and next
No trusted customer Native producer, rights, signed origin, real customer CSV, production deployment, Windows 3-PC or browser file:// acceptance. Only a fixed synthetic 5-field sales V1 has verified row metrics; unrecognized mapping returns a HOLD report. Commercial RELEASE HOLD.
Next: connect the validated owner draft and synthetic P5.34 SMAX→AX→cited-RAG vertical in one acceptance entrypoint, with cross-check totals and full CI; keep synthetic-only fixture hard-pinned and do not modify private SMAX or stable main/develop. 70% may be credited only as provisional engineering completion if that full path passes and source/CI/limits are recorded.
