# P5.3 — Alternate-source held-out synthetic oracle (2026-10-27 KST)

## Goal, alternatives and decision

P5.1 has 100 prompts grounded in only one approved synthetic package. P5.2 changes that same package in 20 test-local ways. Neither demonstrates that the deterministic router can produce correct **different values and provenance** from a separate source. The chosen P5.3 adds a second synthetic package with its own fixed source hashes and separately authored oracle.

| Option | Cost / speed | Validity / maintainability | Decision |
| --- | --- | --- | --- |
| A. Add paraphrases of the 100 questions to the same original files | Quicker, 0 API cost | Weak holdout, risks inflated score because truth and source remain unchanged | Rejected |
| B. Add different sales CSV, separate return/shipping TXT documents, pinned manifest, source-derived oracle and 24 non-overlapping questions | Node built-ins, no paid APIs, small extra fixture maintenance | Independently exercises data-dependent numeric totals, citations, different policy periods; detects hardcoded old answers | Selected |

This is **held out from the earlier authored question/fixture set only**. The same assistant authored this new synthetic corpus, source facts and expected answers, so there is **NO independent reviewer validation, external evaluation, real customer benchmark or security certification**.

## Public synthetic source of truth (entirely separate from prior fixtures)

`fixtures/ax_heldout_v1/` contains:
- `sales.csv`: eight distinct `Q-2001..Q-2008` orders and eight lines with arithmetic checked using a different evaluator; expected **8 orders, 16 units, KRW 187,000**, cited CSV lines 2–9.
- `returns_policy.txt`: new 11-*calendar*-day return application rule at 1-based line 2.
- `shipping_policy.txt`: new 4-*business*-day shipping preparation start rule at 1-based line 2.
- `manifest.json`: separate project `synthetic-heldout-shop-002`, `AX_DATA_PACKAGE_V0`, all three public synthetic files SHA-256 pinned and explicitly approved **in this test fixture only**. All private SMAX and real customer data remain excluded.

`fixtures/p53_heldout_gold.json` is separately written before running the router: **24 distinct questions with zero exact-string overlap with P5.1’s 100**, covering fixed SQL-only, returns-only, shipping-only, supported mixed and out-of-scope complete abstention. Hardcoded oracle requires the *new* totals/lines, return 11 and shipping 4; no reference values are computed from router responses.

## Added implementation (QA only)

- `src/heldout-eval.mjs`: validates gold schema/duplicate IDs/questions, requires canonical source SHA values and approved manifest, independently recalculates amounts, checks new document lines, then compares every router result with exact amount, source row pointers, citation IDs, line numbers, quote and policy units. Rejects forged metric/citations. Returns only case IDs/statuses, not questions or business text.
- `scripts/p53-heldout.mjs` and `npm run test:heldout`: local offline read-only assessment, nonzero exit on failures. No network at program runtime.
- `tests/p53-heldout.test.mjs`: five new tests for alternate oracle, no overlap with prior question set, deliberate wrong model answers, invalid oracle/duplicate cases and fixture immutability/redacted report.
- Existing `src/evidence-router.mjs`, previous 100 gold examples, negative fixture evaluation, UI, original synthetic baseline package, `main` and Private SMAX are unchanged.

## Actual QA observations / recovery

On initial isolated PUBLIC GitHub source SHA `842df2a2d9918b7055421533ba911b409562a853`, native Node had **196 PASS / 3 FAIL** because the *new QA code* forbade underscore characters in its own `h-sql_only-..` / `h-document_only-..` case IDs (`HOLDOUT_CASE_INVALID`). Existing 100 gold and 20 negative benchmarks both passed. Corrected the single case-ID regex in the new evaluator (no product behavior or expected gold changed).

**Final exact tested source SHA `7f1dd362105d848dd7cae9eacdd30bd193a91e98`** downloaded as PUBLIC GitHub tarball into a short-lived isolated compute VM, Node **22.23.4**, Linux arm64:
- `node --test tests/*.test.mjs`: **199 PASS / 0 FAIL / 0 SKIP / 0 CANCELLED** (16 test files).
- `node scripts/p53-heldout.mjs`: **24 PASS / 0 FAIL**, exit 0.
- `node scripts/p5-gold-eval.mjs`: **100 PASS / 0 FAIL**, exit 0.
- `node scripts/p52-negative-evidence.mjs`: **20 PASS / 0 FAIL**, exit 0.
- `node src/doctor.mjs`: `CONTRACT_VALIDATED`, exit 0; original mixed router CLI `ANSWERED`, exit 0.
- Temporary PUBLIC source checkout deleted, no source or database edits to any connected third-party project. **Not GitHub Actions, Windows, Chromium/UI, actual SMAX Private native producer, original ZIP, customer data, installer or Production.**

## Integration acceptance and future gates

Only merge to `develop` via guarded non-force fast-forward if tested SHA vs current HEAD differs **only** in documentation. Leave default `main` unchanged. Continue separate validation for actual Windows multi-PC setup, real browser behavior, SMAX private native producer source contract, original historical RAG ZIP, PDF/DOCX/dense and a third-party reviewed or real-world held-out set. Do not use this result to market a percentage of real-world accuracy or readiness for sale.
