# HANDOFF — RAG Studio AX Edition · P3.1

Updated 2026-10-26 KST. Resume commands: `[RAG_STUDIO 깃헙 레포지토리 보고 작업이어가셈]` or `ㄱ`. Recheck live GitHub/code/test results; no background work is running.

## 1. Goal / requirements / stack
Local-only customer self-install data intelligence product: private SMAX² standardized package → RAG Studio verified CSV/TXT, readonly SQLite, cited search + local dashboard. SOVIA optional. 3 buyer demo markets, 5 envisioned RAG use cases, no required paid cloud. Stack Node 22.16+ built-ins; public fixtures synthetic only. Commercial price hypotheses 149k/99k KRW remain untested; strategic masterplan is private SMAX.

## 2. Completed / changed / rationale
P0 contract/validation; P1 sqlite+TXT; P2 multi-doc lexical retrieval; P2.1 evidence router; P3 local HTTP/UI. **P3.1** implemented per-run crypto bearer token delivered only in browser fragment and protected data APIs, browser captures and removes fragment and supplies Authorization header. Fixed SQLite `GROUP BY sku` produces independent verified chart rows in UI progress bars (72k/45k/40k); refuses unapproved/mismatched files. Host and Origin guards preserved. Chosen over unauthenticated loopback; OS auth broker deferred as too complex for synthetic MVP. Exact rationale: `docs/P31_SESSION_DASHBOARD.md`.

## 3. Test commands / pass / fail / unverified
Linux Node v22.16.0 `npm test`: **92 pass / 0 fail / 0 skipped** = preexisting 80 + new 12. Actual HTTP with launched server: anonymous overview **401**, bearer **200**; SKU totals sum 157k KRW with 6 orders, 10 units. First run 91/92 due to incorrect new-test assertion naming, test corrected and full 92 PASS. Previous Playwright local Chromium access blocked by `net::ERR_BLOCKED_BY_ADMINISTRATOR`, **no P3.1 browser rendering observed**. Windows/real API/deployed test NOT RUN.

## 4. Done / in progress / pending / stop
P3.1 synthetic code+test locally complete; GitHub feature push/integration is the next synchronization action until verified. Pending: real browser/Windows tests, real SMAX adapter, original RAG ZIP, PDF/Word, dense retrieval, search accuracy 100 questions, self installer and release QA. No real customers, production or sales.

## 5. Errors / causes / attempts / pivots
Chromium prior policy block was not bypassed or repeatedly probed; HTTP+test/static safety verification used instead. P3 initial Host-spoof test used fetch and corrected to node:http in earlier phase. P3.1 first test 91/92 was only a source code assertion mismatch, corrected for actual `element('progress')` helper. No confirmed app runtime failure. Original RAG ZIP absent; never fabricate reconstructed engine. Prior direct git networking failed; use authorized GitHub connector.

## 6. Repo / branches / SHA / paths
`hibi89/RAG_STUDIO` PUBLIC; before P3.1 `develop` = `52f39a80855c558340657909fe62a83bc901c9fe`; `main` = `1d809ea830678b667f9223884275f3620a40ead4`. Feature name `feature/p31-dashboard-hardening`, created from exact develop head after validation. Modified `src/dashboard-server.mjs`, `src/dashboard-cli.mjs`, `ui/{index.html,app.js,app.css}`, `tests/dashboard.test.mjs`, `docs/P31_SESSION_DASHBOARD.md`, `STATUS.md`, `HANDOFF.md`. Verify new branch SHAs after commit; do not invent future SHA. Prior `develop` commit is recovery snapshot. No force pushing.

## 7. Runtime / deployment / environment
At repo root `npm test`, `npm run dashboard`; open complete URL printed by launcher `http://127.0.0.1:8765/#session=<per-run-secret>`; refresh after hash removal requires reopening launch link; Ctrl+C stops. No Vercel project, no Production URL, no external API or automation. Vercel SHA match NOT APPLICABLE.

## 8. Originals / backups / secrets / modification prohibitions
All test packages synthetic. Never log, share or commit runtime session URL/token. No token embedded in source or static responses. SMAX private source/strategic docs never copied, SOVIA unchanged. No real data touched or uploaded. GitHub existing HEAD provides rollback by normal ref/restore; no force history change. No account/security configuration, paid service, production deployment or public sale without owner approval.

## 9. Next safe work / acceptance / approval
Verify connector author/committer = owner; commit changed synthetic files to feature; compare remote Git blob digests to test artifacts and integrate via fast-forward to `develop`, preserving `main`. Then P3.2 authorized browser+Windows test and source drill-down/diagnostics. A product sale or customer input use requires separate release gates and approval. `ㄱ` authorizes subsequent safe synthetic work, not public launch.

## 10. KST update / evidence boundary / basis
2026-10-26 KST. At start live GitHub `develop` 52f39a80855c558340657909fe62a83bc901c9fe, verified src blob parity to container copy and all 80 prior tests PASS; P3.1 local 92/92 PASS and 401/200 smoke. Any new SHA after handoff write must be retrieved directly from GitHub. GitHub CI / Windows / browser / production remain unverified.


## Remote P3.1 verification checkpoint — 2026-10-26 KST
- Feature code commit **2bb18a7f8cb13892a79fbd0c2571271ac53df45e** verified as exactly one commit ahead of baseline develop **52f39a80855c558340657909fe62a83bc901c9fe**, zero behind; exactly 9 expected files changed.
- All nine GitHub blob SHA values matched the locally tested code, UI, tests and documents. Commit Git author and committer both identified as **hibi89** with matching email; no force push, no private SMAX/SOVIA changes.
- Node 22.16.0 (Linux) local `npm test`: **92 passed / 0 failed / 0 skipped**. Running local server: unauthenticated `GET /api/overview` HTTP 401, correct per-run bearer HTTP 200, exact synthetic SKU sums KRW 157,000. Not a real-browser/Windows/Production test.
- This checkpoint document is added as a separate documentation commit. Re-fetch the latest GitHub branch SHA to see the documentation commit and whether `develop` fast-forwarded; the document cannot truthfully include its own not-yet-created SHA.

## P3.2 follow-on checkpoint — 2026-10-27 KST (read with 10-point handoff above)
1. **Goal/stack:** Build a local zero-cost self-diagnosis before Windows installer, preserving readonly contract and synthetic-only scope. Node 22.16+ built-ins, no dependency added. All prior P3.1 requirements remain.
2. **Change/choice:** New feature/p32-offline-diagnostics branch from develop 45e96b7870168a7ec38e55f5ed004b9f53655eec. Standalone src/doctor.mjs chosen over a new web diagnostics endpoint to minimize network disclosure. Output contains only platform/Node/approximate total RAM, contract summary counts and fixed error codes; raw paths and exceptions are not emitted. Added tests/doctor.test.mjs, package.json doctor script, docs/P32_OFFLINE_DIAGNOSTICS.md.
3. **Tests/evidence:** Local Linux Node v22.16.0 ran node --test tests/doctor.test.mjs: **11 PASS, 0 FAIL, 0 SKIP**; bytes compared by git hash-object against the GitHub blobs of both new files (327d0d4a0279374b10f8ca8588bcb5b797fe9aab; 600445016ced79ecaa4859064b599591313a3b36). Historical P3.1 92/92 remains prior evidence only. Full repository npm test and actual default fixture/Windows/browser smoke NOT RUN in this session; GitHub DNS was unavailable in container, no fake full-suite claim.
4. **Status/stop:** New isolated source+test complete on feature branch. Integration into develop pending unless verified separately. No P3.2 browser/source-drill-down, no product release.
5. **Errors/recovery:** git ls-remote failed because container DNS could not resolve github.com. Switched to authorized GitHub connector to review/write/verify; no repeated failed clone or bypass. Browser headless probe could not establish a successful render and is not counted as QA. Unit tests were runnable locally using a mirror of the two new files only.
6. **Repo/paths/SHA:** hibi89/RAG_STUDIO Public; main documentation baseline untouched; develop baseline 45e96b7; feature branch feature/p32-offline-diagnostics. Module/test Git blob hashes above. Latest feature HEAD must be re-fetched after docs commits. Recovery base is develop 45e96b7; no force push.
7. **Runtime/deploy:** At repo root: npm run doctor (synthetic fixture by default), then npm test; npm run dashboard still existing P3.1. No Vercel/production, N/A Production SHA. Exit code 1 on blocked preflight, 0 only for scoped contract preflight.
8. **Data/security:** Existing source data untouched; only synthetic test, public-safe code; private SMAX and SOVIA unchanged. No keys, original ZIP, real customer data, cloud, paid API or account settings changed.
9. **Next/acceptance:** Re-fetch feature HEAD, compare against develop, run full npm test and real npm run doctor with available full checkout (or classify unverified). Integrate feature into develop by normal fast-forward when acceptable; keep main unchanged. Then implement P3.2 verified source drill-down and explicit error UX; Windows/browser owner acceptance when possible. Any real data, product release or security/policy changes need separate approval.
10. **Date/basis:** 2026-10-27 KST; GitHub connector inspected code/branch and blobs. Locally tested exactly new source+test, not the full project or browser. Basis: develop 45e96b7, isolated 11/11 evidence and remote feature records.
