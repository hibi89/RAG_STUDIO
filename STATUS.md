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

## 2026-10-27 KST — P3.2 source drill-down VERIFIED and fast-forwarded into develop
- Baseline develop fd32658872a91e7b652be473c9909badfaa27e46 → P3.2 feature + acceptance documentation d30d56c4778f00219aff7c8a5bece1da01ba0ef8, **normal non-force fast-forward**. Default main intentionally unchanged, not a release. Tested application SHA **85d46bebc455956c01b945f45c7c7437864eb81a**; one subsequent documentation-only commit added docs/P32_CI_ACCEPTANCE_20261027.md before merge. No code changes after tested SHA.
- Live GitHub Actions Ubuntu 24.04 / Node 22.16.0: [full regression + real Chrome 40458109672](https://github.com/hibi89/RAG_STUDIO/actions/runs/40458109672) **SUCCESS**, exact npm test **118 PASS / 0 FAIL / 0 SKIP**. Real loopback HTTP citation module, authenticated/anonymous responses, UI tests included.
- Same job: npm run doctor **PREFLIGHT_OK**, npm run demo:router **ANSWERED**, JavaScript syntax PASS; ChromeDriver opened actual local synthetic dashboard and verified fragment scrubbing, KPI, CSV/document source click/focus/highlight, selection cleanup, no-token UI and API 401. Browser smoke **PASS (reported 10 checks)**. This resolves previous *Linux synthetic browser* unverified flag, **not Windows**.
- New synthetic feature: ui/provenance.js source ID matching; safe CSV/document citation drill-down and Korean error guidance; controlled static module route, tests/provenance.test.mjs, tests/ui-interaction.test.mjs, tests/p32-route.test.mjs, scripts/p32-browser-smoke.mjs; single-branch, workflow-file-change-only CI trigger .github/workflows/p32-verify.yml. GitHub public standard runner free; no paid service or customer material.
- **Outstanding**: user Windows PC/3-machine self-install, real original RAG ZIP/license, SMAX Private producer interface acceptance, PDF/DOCX+dense/hybrid, 100 gold questions, packaging/commercial policies, production, real customer safety. No Vercel Production URL (N/A). Continue MVP-first by inspecting source and selecting next synthetic integration slice; do not repeat P3.2 source click work.
- This STATUS edit and subsequent HANDOFF edit generate documentation-only develop commits after acceptance; retrieve final SHA before reporting. No forced ref/history, account settings or private repo writes.

## 2026-10-27 KST — P4.0 read-only SMAX V1 consumer boundary
- Inspected connected Private SMAX preprocessing branch HEAD 5fac694954bcad053b8ad9761aa969474a5d2fe9 (read-only); version SMAX_PREPROCESS_GENERIC_CSV_V1, top-level approval NOT_GRANTED and clean row READY_FOR_HUMAN_REVIEW are **not RAG approved**. Preserved the private producer source, backend/frontend branches and 2026-11-07 SMAX focus schedule. No private implementation copied into Public RAG_STUDIO.
- Implemented in feature/p4-smax-contract-gate from develop 724d66e81316be23d2973b7be026fa3bb2f83c7c: src/smax-intake.mjs, src/smax-intake-cli.mjs, tests/smax-intake.test.mjs (15), synthetic fixtures/smax_v1_boundary, npm run inspect:smax, docs/P4_SMAX_INTAKE_GATE.md, narrowly triggered read-only GitHub Actions .github/workflows/p4-verify.yml.
- Choice: bounded, read-only **REVIEW_REQUIRED** wire-contract gate instead of automatically converting SMAX output to accepted AX_DATA_PACKAGE_V0. Independently checks structure, source metadata, row/review counters, issue states, optional original CSV SHA; outputs only safe counts/fixed status. Does **not** validate private producer normalization, approve business meaning or create any AX package.
- GitHub Actions CI [40459044289](https://github.com/hibi89/RAG_STUDIO/actions/runs/40459044289), Ubuntu 24.04 Node 22.16.0, source SHA b31256d772ed6916f9d5915bfbfe03ff94e70c4d: **npm test 133 PASS, 0 FAIL, 0 SKIP**; SMAX synthetic CLI REVIEW_REQUIRED + SOURCE_DIGEST_VERIFIED + AX package false, doctor PREFLIGHT_OK, mixed router ANSWERED, existing Chrome browser E2E smoke 10 checks PASS. Full job SUCCESS. Prior CI 40458950837 had 133/133 test PASS but workflow failed because npm command banner was parsed as JSON; repaired workflow capture test, final run green. No unresolved product regression from that issue.
- Scope: **consumer contract + synthetic validation only**. SMAX native producer CLI, cross-repo artifact transfer, real ZIP/actual customer data, human approval workflow, actual package conversion, Windows 3-PC/installer, PDF/DOCX/vector and 100-gold questions still NOT VERIFIED/NOT IMPLEMENTED. No production/Vercel, GitHub default main release unchanged, no payment or external API.
- Resume: after feature documentation commit, verify CI-tested source SHA versus current code (docs-only differences), fast-forward develop without force if no new conflicts, update HANDOFF and STATUS accordingly. Do not start external SMAX production artifact processing without review/approval gates.

### 2026-10-27 KST integration checkpoint
- P4.0 SMAX review-only synthetic boundary integrated into develop by non-force fast-forward from 724d66e81316be23d2973b7be026fa3bb2f83c7c to e93d708f218234c1125e64fedb7a977e81192988, 11 commits ahead, 0 behind. Default main remains unreleased. Private SMAX and SOVIA unchanged.
- Tested code SHA b31256d772ed6916f9d5915bfbfe03ff94e70c4d via Actions run 40459044289: npm test 133/0/0 and existing Chrome E2E smoke passed. Compare tested SHA to merged feature HEAD: only STATUS.md and HANDOFF.md differed (docs only), no code changes. See docs/P4_SMAX_INTAKE_GATE.md.
- This STATUS entry is documentation-only after integration. Re-fetch final develop SHA for next chat. No Production/Vercel/Windows/real SMAX producer output or approval/export completed.

## 2026-10-27 KST — P4.1 synthetic semantic review handshake, tested
- Starting develop: 8a433e518e78625b5381664abe6ef6cc26aa82e7; created feature/p41-smax-review-handshake. Checked current Private SMAX preprocessing HEAD 73ff80a7646d611823be623ea7ed6f35dd18b09f in read-only mode; no private source published, copied, modified or deployed.
- Implemented src/smax-review.mjs (strict UTF-8 3-column unquoted CSV subset, exact original source hash/rows/field semantic consistency, KRW integer and explicit tax-basis acknowledgement, no-auto-approval or AX output), tests/smax-review.test.mjs (18 tests), scripts/p41-synthetic-review.mjs and package.json demo:smax:review. Design decision and limitations documented in docs/P41_SMAX_REVIEW_HANDSHAKE.md.
- **Actual complete CI evidence:** public GitHub Actions Ubuntu 24.04 Node 22.16.0 run https://github.com/hibi89/RAG_STUDIO/actions/runs/40460231010, source commit 898bf998a541dbd534cebd553960b6eaef9f695b, completed SUCCESS. npm test **151 PASS / 0 FAIL / 0 SKIP** (133 prior +18 new). Existing SMAX intake, new review demo, doctor, mixed router and actual P3.2 Chrome synthetic UI 10-check smoke all PASS. No failures or skipped tests.
- P4.1 returns PENDING_SEMANTIC_REVIEW without plan, REVIEW_HOLD on HOLD, REVIEW_RECORD_READY with valid explicitly supplied synthetic intent. All report ax_package_created=false; reviewer_identity_verified=false. REVIEW_RECORD_READY is **not** real approved business input, authenticated reviewer, signed audit or authorization to access customer data. No full RFC 4180, Windows installer, actual SMAX native producer synthetic cross-test, original ZIP, product release or Production.
- Next: verify no source diff from green tested SHA, integrate to develop only via normal fast-forward if clean, keep main untouched. Then P4.2 trusted local human approval UI/schema and audited AX_DATA_PACKAGE_V0 producer on synthetic fixture; no real customers until explicit gate. No costs, production, Vercel, SOVIA, private SMAX mutation.

### 2026-10-27 KST — P4.1 develop integration verified
- Source branch feature/p41-smax-review-handshake fast-forwarded normally from develop 8a433e518e78625b5381664abe6ef6cc26aa82e7 to af44cd60afa35ca441e9760c6d440e50b748bb68, 9 commits ahead, 0 behind, no force. Main unchanged. Private SMAX and SOVIA untouched.
- Tested application/workflow SHA 898bf998a541dbd534cebd553960b6eaef9f695b, completed GitHub Actions SUCCESS run https://github.com/hibi89/RAG_STUDIO/actions/runs/40460231010: npm test 151 PASS, 0 FAIL, 0 SKIP, synthetic review no-import and real Linux Chrome smoke PASS. Compared tested SHA to integration SHA: changed files only STATUS.md and HANDOFF.md (documentation), not runtime code.
- This is P4.1 synthetic REVIEW_RECORD_READY protocol only, NEVER an authenticated approval or accepted AX_DATA_PACKAGE_V0. No real data, original ZIP, Windows install, commercial release, Vercel or Production. The current STATUS and following HANDOFF are documentation-only commits; re-query final develop SHA on resume.
