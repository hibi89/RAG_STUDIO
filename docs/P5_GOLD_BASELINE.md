# P5.0 — Synthetic Gold Evaluation Baseline (2026-10-27 KST)

## Decision and competing approaches

| Option | Performance/cost | Maintenance/quality | Decision |
| --- | --- | --- | --- |
| A. Only manually test dashboard queries | No coding, but costly and not reproducible | Cannot detect regressions or count incorrect unsupported answers | Rejected |
| B. Versioned synthetic gold cases + deterministic evaluator + narrow out-of-scope abstention | Zero paid API/dependency, 24 fixed local cases, one `node` command | Repeatable fail-fast checks, inspectable expectations and citation/metric integrity | Selected |

This is an **incremental, synthetic-only QA unit**, not a new review-authority system, model-based evaluation, customer-data processor or claim of real-world search accuracy. Original Private SMAX producer source stays separate.

## Implementation and scope

- `fixtures/p5_gold_v0.json`: 24 manually assembled, synthetic-only questions. 18 supported (sales, policy or mixed) + 6 deliberate unsupported/fee/ETA abstentions. Results pin exact SQL sums 6 orders, 10 units, KRW 157000, six source CSV lines, cited 7 calendar days for returns and 2 business days for shipping preparation.
- `src/gold-eval.mjs`: bounded schema checks, fail-closed per-case execution, structured metrics and source citation checks. Report contains **IDs only**, never original questions, row contents or document quotes.
- `scripts/p5-gold-eval.mjs` + `npm run test:gold`: reads a checked-in synthetic fixture only, prints safe report and exits nonzero if any mismatch. No server, API keys, network calls or writes.
- `tests/p5-gold-eval.test.mjs`: four deterministic tests cover 24 expected outcomes, fee abstention, invalid gold data and incorrect answer detection.
- `src/evidence-router.mjs`: shipping intent requires shipping/dispatch *preparation* (not arbitrary shipping mention); returns require an explicit timing/policy intent; supported fee/refund amount phrases cause complete NOT_SUPPORTED abstention, including mixed questions, rather than a misleading partial answer.
- `package.json`: new `test:gold` script. Existing synthetic fixtures and APIs unchanged.

## Actual QA evidence, exact source

- Tested public feature revision **1fe3724a55f781590df00b838f95ea2f122fe37b**, public repository archive from GitHub downloaded to isolated, temporary connected compute VM. Node **v22.23.4**, Linux arm64, 14 test files.
- Native `node --test tests/*.test.mjs`: **187 PASS / 0 FAIL / 0 SKIPPED / 0 CANCELLED / 0 TODO**, exit 0. This includes 183 historical baseline cases and 4 new tests **rerun together**.
- Native `node scripts/p5-gold-eval.mjs`: **24 PASS / 0 FAIL**, exit 0; no unsupported fee received an answer.
- Native `node src/doctor.mjs` returned `CONTRACT_VALIDATED`, exit 0, and `node src/router-cli.mjs fixtures/ax_multi_doc_v0 "총 매출과 반품 기간, 배송 준비 기간은?"` exit 0 with two cited policy documents. The entire temporary checkout was removed.
- This execution is **not GitHub Actions** and **not an actual Windows/browser/installer/production test**. No ChromeDriver was executed this unit. Prior P4.2 real Chrome 10-check success is historical, on older unchanged UI/server code.

## Honest interpretation and next gate

- The 24 cases cover a narrow deterministic vocabulary; they are NOT a statistical accuracy percentage for customers. This slice seeds the desired 100-question QA set; **76 or more diverse, independently reviewed questions are still outstanding**.
- Future phases: 100-question corpus with paraphrases and semantic near-misses, unsupported mixed-intent guards, conflict/no-evidence tests, Windows 3-PC and local installer QA. Browser recheck if accessible. Native Private SMAX producer cross-repo verification is still pending inside approved private boundaries.
- Existing SMAX V1 `NOT_GRANTED` is never authorization; RAG source review simulation is not identity verification; PDF/DOCX, dense retrieval, real ZIP/customer data, sales, licensing and Vercel Production remain unverified/not implemented.
- Merge policy: compare tested code SHA to documentation-only feature head; if only docs changed, and develop baseline is an ancestor, update develop via **non-force fast-forward only**. Keep main untouched. Rollback baseline develop `fbf8063261ffaeaa63db36125985a18212edd1d7`.
