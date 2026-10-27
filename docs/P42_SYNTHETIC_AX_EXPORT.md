# P4.2 — Explicit local synthetic confirmation → verified AX_DATA_PACKAGE_V0 demo

Date: 2026-10-27 KST. Status: feature awaiting full GitHub CI acceptance. Public synthetic-only demonstration. NOT an authenticated/customer-ready import system.

## Options and selected approach
| Approach | Security / validity | Cost / complexity | Decision |
| --- | --- | --- | --- |
| A. Treat P4.1 REVIEW_RECORD_READY as final approval; convert any SMAX V1 JSON | Unsafe: anyone can provide a review object, and a clean row is still NOT_GRANTED in SMAX. Tax and source lineage may be fabricated | Fast but high support/legal risk | Rejected |
| B. Restrict exporter to two SHA-256-pinned existing public synthetic fixtures, independently check all five original CSV columns/rows and exact arithmetic, require an ephemeral typed challenge and explicit semantic review plan, then verify resulting AX contract | Fail-closed and end-to-end testable, **still NOT a real human authentication system** | 0 API cost; Node built-ins, fixed synthetic scope | Selected |

## Implemented surface
- `src/smax-synthetic-export.mjs` accepts **only** the SHA256 hash and exact row/schema contract of checked-in `fixtures/ax_multi_doc_v0/sales.csv` plus `returns_policy.txt`, and synthetic producer-shaped `fixtures/smax_p42/synthetic_v1.json`. The latter is *independently authored public test data, not a native artifact from the Private SMAX engine*. It deliberately remains `approval=NOT_GRANTED`, with row statuses `READY_FOR_HUMAN_REVIEW`.
- `beginSyntheticExport`: verifies original source bytes, V1 shape, row numbers, normalized values, unique order IDs, SKUs, positive quantity, nonnegative price, amount = qty × unit price, exact totals and approved synthetic document hash; returns ephemeral challenge status only.
- `syntheticReviewPlan`: explicit five field roles, document and source digests, all six one-based source lines, KRW integer, quantity×unit price meaning and `TAX_NOT_APPLICABLE`. The fixture contains no actual tax basis; this label is **synthetic illustration**, not a fiscal determination. No customer source allowed.
- `confirmSyntheticExport`: requires a typed challenge matching the exact in-process request plus a fully matching plan; uses private WeakMap-backed one-use handle; returns a synthetic bundle permission but **never verifies real reviewer identity**.
- `writeSyntheticAxBundle`: creates a **new** output directory only, refuses overwrite, writes synthetic sales.csv, synthetic returns_policy.txt and SHA-256/size/lineage/approved-columns manifest, then validates with the actual RAG Studio `loadPackage` and `aggregateSales` pipeline. Expects **6 orders / 10 units / 157000 KRW**. Does not modify input sources. Post-export failure attempts to remove only the newly created output dir.
- `scripts/p42-export-interactive.mjs NEW_OUTPUT_DIRECTORY` requires an actual terminal for a human to type the challenge. It only reads pinned synthetic fixtures; no user-selected business file input. The typed words demonstrate user intent, **not** proof of identity, a signature, or final commercial/data-protection approval.
- `npm run demo:smax:export`: **programmatic test-only confirmation**, exports under a temporary directory and deletes it. Do not count the automated example as actual human approval.
- `tests/smax-synthetic-export.test.mjs`: tampering, data boundaries, review plan, replay protection, immutable original files, non-overwrite, real manifest and SQLite verification. `fixtures/smax_p42/synthetic_v1.json` is synthetic producer-shaped, **not Private SMAX source or verified producer output**.

## Scope & security limitations
- Production/customers **blocked**: this exporter only allows the two known static fixture digests and a fixed synthetic project ID, not arbitrary SMAX outputs. No login, cryptographic human attestation, policy engine, durable audit trail, license authorization, document ingestion from users or real source import.
- `AX_DATA_PACKAGE_V0` in this demo uses `ACCEPTED` and `APPROVED` exclusively for the SHA-pinned **synthetic fixtures after explicit challenge**. These markers must not be reused for real customer data; clean SMAX V1 remains NOT_GRANTED outside this hardcoded demonstration.
- Local temp directory outputs may contain sensitive material in future systems; this code currently cannot export non-synthetic content. Do not publish or upload source files. No Private SMAX source, secrets, optional SOVIA or real customer data modified.
- RFC4180 quoted CSV, arbitrary tax handling, file chooser, signed reviewer identity, SMAX native producer-consumer cross-test, original RAG ZIP, PDF/DOCX, dense search, Windows 3-PC/installer, 100-query gold set, licensing and product release are **not implemented or not verified**.
- Existing RAG HTTP dashboard auth and main release baseline should stay unchanged.

## Verification gate
1. GitHub Actions standard free public Ubuntu runner Node 22.16.0: `npm test`, P4.0 intake, P4.1 review simulation, P4.2 demo, original `npm run doctor`, `npm run demo:router` and real Chrome synthetic smoke. Real test counts / SHA must come from CI log.
2. Compare source branch against tested SHA; only documentation commits may follow before a normal no-force fast-forward into `develop`. Leave `main` unpromoted.
3. Future P4.3: authorized local user interface and isolated original-data importer with complete vendor-schema validator, durable evidence and real reviewer trust boundary must be independently designed/tested; **P4.2 success does not grant this**.
