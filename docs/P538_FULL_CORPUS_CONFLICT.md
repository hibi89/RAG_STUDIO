# P5.38 — Whole-verified-corpus return-policy conflict gate

2026-10-28 KST. Scope is approved-by-package **synthetic** TXT/MD search, not customer legal interpretation.

## Prior failure mode and alternatives
Old P2 BM25 source search scored all verified lines, but compared return periods only in the top `limit` hits, potentially returning `FOUND` when a contradictory line ranked lower. Its caller could ask `limit:1`.

- Increasing BM25 `limit`: cheaper to implement but cannot guarantee detecting an arbitrarily low-ranked citation, and expands returned text.
- **Independent bounded full-corpus claim scan (chosen):** inspect the already-verified `segmentsFromApprovedText` source pool (maximum 10,000 lines) regardless of lexical rank, but only for a return/refund question. Keep ranked evidence at the user's chosen limit. On different explicit `N일 이내` claims, return `POSSIBLE_CONFLICT`, `answer:null` and at most two representative one-based citations in `review_evidence`.

Same-line 7/14 days are detectable; selected knowledge sources are isolated. The experimental lexical hybrid preserves the baseline conflict rather than overriding it. No additional filesystem read, API, model, SQLite operation or mutation; the file SHA and approval validations remain mandatory.

## Output scope
Only an explicit Korean return/refund period pattern is supported. Conditions, eligibility, cohort, effective dates, legal status and implicit temporal context are **NOT** analyzed; possible historical-policy differences require human review. Shipping business-days are deliberately excluded from this return period check. Existing `evidence` remains BM25 ranked and bounded; `review_evidence` supplies a bounded safety explanation.

## Verification
`tests/p538-full-corpus-conflict.test.mjs` covers conflict outside top1, selected-document isolation, lexical-hybrid preservation, same-line contradiction, consistent policy and source tampering. Run full `npm test` and synthetic regression on Linux/Windows in `.github/workflows/p538-verify.yml`; the actual result and SHA must be checked on GitHub Actions.

No actual customer data, owner approval, Windows physical-PC installer, Vercel or public deployment. Existing stable `main` is not changed.

## Local browser handling
Knowledge Base search now displays the bounded `review_evidence` conflicting line excerpts when the verified search returns `POSSIBLE_CONFLICT` instead of presenting only top BM25-ranked hits. UI uses existing safe `textContent` construction, no raw HTML, and does not suppress the `answer:null` warning.

## Exact verified code checkpoint
- Source/UI SHA `54e714444d0fcf1f3a933d6a63cc396a726f5185`; [GitHub Actions #40540254275](https://github.com/hibi89/RAG_STUDIO/actions/runs/40540254275) completed/success; Linux22.16 482/482 PASS and Windows22.23 482/482 PASS. Both systems also passed gold/negative/heldout/router and the P5.37 read-only synthetic wizard smoke. All 5 new P5.38 tests included in the full 482.
- Source-only prior `8b7a528b1d17c1f5b2e40288c94d1c4c28a21ad4` green 482/482 on both OS at [#40540044719](https://github.com/hibi89/RAG_STUDIO/actions/runs/40540044719). UI enhancement after first green then full rerun at second green.
- Actual Chrome/Edge user-click verification of changed UI not run, although Node test syntax and other existing UI tests passed. No customer input, private SMAX source, real policy legal validity or product release tested.
