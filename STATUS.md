# STATUS — RAG Studio AX Edition

Updated: 2026-10-26 KST. Check live GitHub SHA/code on every resume; documents are not runtime evidence. **No release or production deployment.**

## Product / strategic constraints
Local-first product: Private SMAX² producer (future verified integration) → AX_DATA_PACKAGE_V0 package → RAG Studio readonly DB + document evidence + local UI; optional standalone SOVIA audit. Three market demos and five RAG use scenarios are roadmap, not completed features. 149,000 KRW list / 99,000 KRW early are unvalidated price hypotheses, not a current listing. Keep private business material outside public GitHub.

## Verified source work (Node 22.16.0 Linux / synthetic fixtures)

| Stage | Scope | Tests |
|---|---|---:|
| P0 | hash/size/path/review-checked CSV/TXT contract | 16 |
| P1 | fixed readonly in-memory SQLite + TXT citations | 12 |
| P2 | Korean lexical multi-document search, file/line pointers | 17 |
| P2.1 | evidence-gated composite router, conflict/insufficient abstention | 15 |
| P3 | 127.0.0.1 dashboard HTTP/UI, source documents & KPIs | 20 |
| **P3.1** | startup bearer capability, 401 failure, SKU revenue chart, cross-origin and integrity tests | **12** |
| **TOTAL** | `npm test` | **92 PASS / 0 FAIL / 0 SKIP** |

P3.1 HTTP smoke: unauthenticated `/api/overview` returns **401**; correct per-run Authorization bearer gives **200**, SKU revenues 72,000 + 45,000 + 40,000 = KRW 157,000; source totals 6 orders / 10 units. This is a test against a running local server, not a browser render or Windows verification.

## GitHub checkpoint
Repository `hibi89/RAG_STUDIO` PUBLIC. Verified before P3.1: `develop` **52f39a80855c558340657909fe62a83bc901c9fe**, `main` **1d809ea830678b667f9223884275f3620a40ead4**. Feature target `feature/p31-dashboard-hardening`; commit and remote HEAD must be verified from GitHub separately. Existing prior code/fixtures, private SMAX and SOVIA unchanged. Recovery baseline: `develop` 52f39a8 before P3.1.

## Not complete / not validated
- Real Chromium UI render, mobile/responsive, console/network: previous `ERR_BLOCKED_BY_ADMINISTRATOR` **not overcome**; UI browser **UNVERIFIED**.
- Windows installation/browser, original RAG ZIP hash/secrets/license, actual SMAX producer, PDF/DOCX, FAISS/dense/hybrid comparison, broader RAG modes, production safety, packaging, gold-set 100, Windows 3-PC, real customers, licensing and sales: NOT DONE.
- Local bearer reduces exposure but does **not** secure compromised host processes or create a supportable customer production release. Refresh requires full launcher URL; no persistent session store.
- Vercel, Production URL, hosted API, cloud billing, GitHub Actions CI: **NONE / NOT APPLICABLE**.

## Next `ㄱ`
P3.2 further UI interaction QA (authorized Windows/browser), source drill-down, safe error states, platform diagnostics. If browser access remains unavailable, continue synthetic nonbrowser acceptance and installation groundwork but mark browser unverified. No unapproved real data/cloud/release/security-policy changes. Update HANDOFF and STATUS after each substantive unit.


## Remote P3.1 verification checkpoint — 2026-10-26 KST
- Feature code commit **2bb18a7f8cb13892a79fbd0c2571271ac53df45e** verified as exactly one commit ahead of baseline develop **52f39a80855c558340657909fe62a83bc901c9fe**, zero behind; exactly 9 expected files changed.
- All nine GitHub blob SHA values matched the locally tested code, UI, tests and documents. Commit Git author and committer both identified as **hibi89** with matching email; no force push, no private SMAX/SOVIA changes.
- Node 22.16.0 (Linux) local `npm test`: **92 passed / 0 failed / 0 skipped**. Running local server: unauthenticated `GET /api/overview` HTTP 401, correct per-run bearer HTTP 200, exact synthetic SKU sums KRW 157,000. Not a real-browser/Windows/Production test.
- This checkpoint document is added as a separate documentation commit. Re-fetch the latest GitHub branch SHA to see the documentation commit and whether `develop` fast-forwarded; the document cannot truthfully include its own not-yet-created SHA.

## 2026-10-27 KST P3.2 feature checkpoint — scoped offline diagnostics
- Verified develop baseline HEAD: 45e96b7870168a7ec38e55f5ed004b9f53655eec. Kept default main unchanged; new branch feature/p32-offline-diagnostics created from develop.
- Added src/doctor.mjs, tests/doctor.test.mjs, npm run doctor script, docs/P32_OFFLINE_DIAGNOSTICS.md. No new dependencies, network listener, external calls or customer files.
- Local Linux Node 22.16.0 isolated command node --test tests/doctor.test.mjs: **11 PASS / 0 FAIL / 0 SKIP**. GitHub module/test blob SHAs matched locally tested artifacts exactly. This is a new isolated test batch; do NOT add 11 to historical 92 as if the entire 103-test suite ran.
- Existing 2026-10-26 develop P3.1 evidence remains historical 92/92 PASS; **full regression in this session NOT RUN** due blocked GitHub clone DNS. Real fixture CLI, Windows browser/install and production NOT TESTED.
- Before integration verify remote feature HEAD, author/committer and changed paths, then merge to develop by normal fast-forward only if regressions are acceptable. Keep main not released. Next P3.2 source drill-down / clear error UX; P4/P5 still pending.

### 2026-10-27 KST — P3.2 merged into develop (not release)
- Verified no-force fast-forward develop from 45e96b7870168a7ec38e55f5ed004b9f53655eec to 79801fcf5b11f89d1c87942b5efa8605580bde35; feature/p32-offline-diagnostics contained 6 targeted files, 6 commits ahead, 0 behind. Confirmed latest documentation commit author/committer hibi89.
- Isolated P3.2 offline doctor test: 11/11 pass, 0 fail (Node 22.16.0 Linux); new code and test Git blobs matched local bytes. Historical P3.1 tests: 92 PASS on 2026-10-26, not rerun. **Combined full npm test, real doctor fixture, Windows/browser/production UNVERIFIED in this session.** No production deployment or real data.
- GitHub integration reflects an additive, synthetic-only diagnostics slice, not complete P3.2 or commercial readiness. Next: actual whole-suite/fixture testing when full repo checkout is accessible, then provenance drill-down and error UX.

## 2026-10-27 KST — P3.2 provenance drill-down feature (pending full regression)
- Baseline develop at start: fd32658872a91e7b652be473c9909badfaa27e46; this work is on feature/p32-provenance-drilldown only. Neither develop nor main is promoted by this feature work.
- Implemented ui/provenance.js citation ID/row/amount matching; CSV and approved-TXT source-card navigation with text-only details; friendly 401/422 and bad-input UX; allowlisted module served from existing local HTTP static server. Existing protected data API behavior not modified. Source paths and private data are never fetched through a new endpoint.
- Local exact-blob check: node --test tests/provenance.test.mjs **10 PASS / 0 FAIL / 0 SKIP**, Node v22.16.0. node --check new module, UI app and test passed; GitHub blobs matched local checked bytes (ui/provenance.js 14be33ba..., tests/provenance.test.mjs 36fca6d9..., ui/app.js bc490762...).
- **Not verified**: full repository npm test (GitHub clone failed DNS), actual backend+frontend integration, Windows, browser DOM. A single local Chromium loopback smoke attempt stopped on net::ERR_BLOCKED_BY_ADMINISTRATOR; no bypass and not an application error finding. Historical develop 92 PASS and prior isolated doctor 11 PASS are distinct, not an accumulated suite result.
- This feature is **not merged** while full regression and browser integration are unresolved; its base develop is preserved. Next: obtain authorized checkout/test access, run full npm test / npm run doctor / dashboard HTTP fixture + browser QA, decide safe fast-forward after pass. Product release gates remain open.

### 2026-10-27 KST next ㄱ — isolated UI checks, branch not merged
- Added tests/ui-interaction.test.mjs (synthetic DOM + mocked authenticated fetch): session fragment stripping, overview render, CSV/document citation buttons, active source focus/highlight clearing, 401 response and absent token fail-closed.
- Locally executed (Node 22.16.0 Linux): node --test tests/doctor.test.mjs tests/provenance.test.mjs tests/ui-interaction.test.mjs — **24 PASS, 0 FAIL, 0 SKIP**. Exact six JS file blobs matched remote source after this addition, including new test blob 60884dd0cb4ea0313790e49010da12594086defd. node --check on same six JS files — **6/6 PASS**.
- **Full repository npm test still NOT RUN**, expected cumulative count 116 if 92 old P3.1 + 11 doctor + 10 provenance + 3 mocked-UI all discovered; do not claim 116 PASS. Real HTTP/browser/Windows and original ZIP remain NOT VERIFIED. GitHub DNS blocked container repository clone, browser loopback previously blocked by administrative policy.
- Keep feature/p32-provenance-drilldown separate from develop until full regressions. No change to main, deploy, private SMAX, SOVIA or customer data. See docs/P32_PROVENANCE_DRILLDOWN.md.
