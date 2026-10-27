# P5.34 — SMAX V1 synthetic → verified AX package → SQL + cited document answer MVP

Date: 2026-10-28 KST. Deadline-first engineering, no UI polish or paid service. Public hibi89/RAG_STUDIO, synthetic-only.

## Runnable entrypoints
- Developer checkout: `npm run mvp:smax` (no parameters). Requires Node.js and the existing public fixtures. Uses no Private SMAX source, no cloud service or customer inputs.
- Windows portable ZIP: extract the `RAG_STUDIO_P534_SMAX_SYNTHETIC_MVP` GitHub Actions artifact and then the contained ZIP, run `RUN_SMAX_SYNTHETIC_MVP.cmd` (or `RUN_MVP_WINDOWS.cmd` for original synthetic ZIP demo). Trusted Node.js **22.23.0** is required and not bundled; Windows Node22.16 is known incompatible with source-identity checks.
- Dashboard terminal prints a per-run private local `127.0.0.1:8765/#session=...` URL. Do not share. Stop process with Ctrl+C. No service registration/auto-start. Uses temporary AX package; cleans up on ordinary SIGINT/SIGTERM and process exit.

## What the code actually does
1. Read strict known-public `SMAX_PREPROCESS_GENERIC_CSV_V1` JSON, original fixed public `sales.csv` and corresponding synthetic `returns_policy.txt` fixture.
2. `previewSmaxSales` independently checks original CSV digest, every normalized cell, identifiers, positive quantity, quantity × unit price = amount, unique order ID, review queue and supported five-column sales mapping. A row needing review causes HOLD before conversion.
3. Existing P4.2 `beginSyntheticExport → syntheticReviewPlan → confirmSyntheticExport` validates exact allowlisted fixture SHA, policies, fixed semantic units, row lineage, and public AX contract. **Programmatic challenge repetition in this demo is NOT real human authorization or trusted SMAX Native approval**. Any different customer source/hash is blocked.
4. `writeSyntheticAxBundle` produces a new disposable `AX_DATA_PACKAGE_V0` with sales CSV and policy TXT, verifies SHA and expected 157000 KRW / 6 orders / 10 units through real aggregateSales.
5. `routeQuestion('매출과 반품 신청 기간은?')` must answer `SQL_DOCUMENT`, with exact read-only SQLite metric rows mapped back to original 1-based CSV lines **2–7** and at least one cited TXT policy line, without generated SQL/LLM. If unsupported, conflicting or missing evidence appears, the router abstains.
6. The real loopback server serves a bearer-protected overview, restricted `/api/query` and static browser UI. No real customer data, credentials, or unsanitized source paths are emitted. The ZIP bundles this path and a local integrity manifest.

## Actual CI evidence (not hypothetical)
- Code SHA `f3a31d72d236a1217d1162b7d51fb8dd73fdd4c3`, [GitHub Actions #40530670061](https://github.com/hibi89/RAG_STUDIO/actions/runs/40530670061), **completed / success**, separate Windows and Linux jobs.
- Windows hosted `windows-2025`, Node22.23.0: `npm test` **454 PASS / 0 FAIL / 0 skipped / 0 cancelled** (8 new tests + existing 446), existing repo real launcher to actual SQL+document HTTP **5/5 PASS**, separately built portable directory new entrypoint and evidence **6/6 PASS**, old portable demo smoke PASS, ZIP re-extracted and manifest hash **PORTABLE_MVP_INTEGRITY_PASS**. Artifact `RAG_STUDIO_P534_SMAX_SYNTHETIC_MVP` id **12747165447**, size **114003 bytes**, 7-day retention.
- Linux Ubuntu24.04 Node22.16.0: `npm test` **454/454**, direct CLI source-to-query **5/5 PASS**, portable source-to-query **6/6 PASS**, old portable demo smoke PASS.
- Original first CI #40530369388 failed 7 new tests due to `new URL(..., pathString)` test-only fixture path bug. Fixed by passing a URL object as the base. This did not weaken product behavior. Current #40530670061 retested all and is green.
- New tests explicitly cover source byte mutation, forged normalized amounts, missing approval state, review queue hold, changed policy source, substitute CSV, temporary workspace cleanup, and original source preserved.

## Remaining blocking items, not hidden by synthetic PASS
- No true real-owned-file producer identity, human consent/legal data-use verification or Private SMAX Native consumer handshake. Existing generic SMAX local preview can verify unknown CSV and calculate *unapproved* totals but must NOT mark them AX accepted.
- Full customer JSON+CSV+document selection → explicit trustworthy approved AX package → local search/DB is not verified. User data must remain local and cannot be auto-approved by a self-reported `ACCEPTED` field or automatically typed demo challenge.
- No physical 3-PC Windows tests, signed or bundled runtime installer, arbitrary CSV schema generalization, free-form LLM/dense E5 release, long-lived backups, 3-industry acceptance, paid support/terms or production deploy.
- Frontend/UI improvements intentionally deferred until the next trusted real source ingestion unit works. `main` remains untouched.

## Next P5.35 engineering decision
Implement a minimal **explicit user-selected owned/local SMAX V1 + CSV + document** `REVIEW_HOLD` staging view (no import), preserve original SHA/content and prove parser/counters across Windows and Linux. Design a separately authorized manual approval/ownership gate for turning that into an AX package. Never treat synthetic confirmation as that gate; request explicit owner authorization before modifying such a high-risk approval boundary or processing actual customer data.
