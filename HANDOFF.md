# HANDOFF — RAG Studio AX Edition / P3 local dashboard

2026-10-26 KST. Exact new-chat command: `[RAG_STUDIO 깃헙 레포지토리 보고 작업이어가셈]`, `ㄱ` = next safe unit. GitHub live SHA/source/tests take priority over all historic status text.

## 1. Goal / confirmed requirements / stack
One locally installed, self-operated AX tool combining SMAX² standardized source data → RAG Studio SQLite readonly metrics + verified document search → evidence-linked dashboard, with SOVIA independent optional audit. Node >=22.16, no npm packages, 0 KRW external API; synthetic first; not a commercial ready app. Product/masterplan and price strategy retained in private SMAX; do not copy private plan or code to this PUBLIC repository.

## 2. Implemented decisions and changes
P0 typed manifest validation (synthetic sales+TXT). P1 in-memory fixed-query SQLite aggregate. P2 BM25 Korean lexical TXT line search and multi-doc conflict. P2.1 evidence-gated query router. **P3** adds local loopback HTTP+browser UI (KPI cards/approved docs/CSV source table/composite and search form/refusal states); reuses unchanged P0–P2.1 core. No uploads, arbitrary SQL, cloud or external network. Chose loopback server over `file://` due same-origin browser access and freshness of validated package. Details: `docs/P3_LOCAL_DASHBOARD.md`.

## 3. Tests / success / failure / unverified
Node v22.16.0 Linux: `npm test` **80 PASSED / 0 FAILED / 0 SKIPPED** (previous 60 plus 20 P3). Actual local server on 127.0.0.1:18961 GET `/api/overview` HTTP **200**; verified test for sales 157000 KRW, 6 orders, 10 units, 2 synthetic documents, 6 CSV lines. Host/Origin/body/method/error/immutability checks included. Playwright local Chromium navigation attempted once; **`net::ERR_BLOCKED_BY_ADMINISTRATOR`**, so actual UI display, JS interaction, mobile CSS, Console/Network **NOT VERIFIED**. Do NOT claim browser PASS or live app success. Windows/production/API/real source not tested.

## 4. Done / ongoing / pending / stop
DONE: P0–P2.1 source slices + P3 local HTTP/HTML/CSS/JS code and tests. STOP after P3 code test, source hash match, GitHub push/fast-forward and docs snapshot. Next: browser+Windows validation and local UI access security/token before real customer data. RAG original archive, SMAX actual producer, PDF/Word, dense retrieval, charting, license, self-installer, reliability/gold-set and paid launch outstanding.

## 5. Failure evidence / cause / action / pivot
Earlier git clone in container failed external DNS; use connected GitHub tools. During P3, one HTTP Host-spoof test incorrectly used high-level fetch (browser-supplied Host overrides header), corrected to `node:http` request then full test PASS. Playwright+Chromium `Page.goto(http://127.0.0.1:18961)` blocked by administrator policy; did not bypass controls; shifted to actual HTTP/curl + static asset/API validation, label browser UNVERIFIED. Old RAG ZIP not found in prior Library/repo searches; do not overwrite/fabricate and continue independent synthetic units.

## 6. Repo/branches/commits/paths
Public `https://github.com/hibi89/RAG_STUDIO`; `main` stable baseline `1d809ea830678b667f9223884275f3620a40ead4`; starting `develop` confirmed **`20575997980b511cf79ead0a1376edcff5e8f5b8`**. P3 branch `feature/p3-local-dashboard`; verify its final GitHub HEAD after current code/doc commit (cannot self-reference). Code `src/dashboard-server.mjs`, `src/dashboard-cli.mjs`, `ui/index.html`, `ui/app.js`, `ui/app.css`, `tests/dashboard.test.mjs`, `package.json`, `docs/P3_LOCAL_DASHBOARD.md`, `STATUS.md`, `HANDOFF.md`. Prior source/fixtures preserved.

## 7. Deployment / execution / environment
`npm test`, `npm run dashboard`, then open `http://127.0.0.1:8765` on same machine; Ctrl+C stop. No Vercel/Production URL, no CI configured, no server deployment. Node 22.16 `node:sqlite` emits experimental warning. Browser smoke script run had environment block. RAG Studio is NOT deployed.

## 8. Originals/backups/credentials/protected content
Prior `develop` commit provides versioned recovery; no real input files modified, only synthetic fixtures. GitHub connected login `hibi89` (last checked earlier); confirm author and committer at new commit. SMAX private plan/code, SOVIA code, tokens, credentials, .env, customer materials must not go to public GitHub. No upload/permission/paid/production changes.

## 9. Next steps / acceptance / user approvals
Verify P3 commit GitHub tree/source parity, then safe fast-forward to `develop`, verify SHA. P3.1: authorized browser UI and Windows responsive smoke, error states, source line click behavior; implement localhost session token/CSRF before real data; improve UI/chart. Production hosting, release, customer source use, repo privacy/authorization, paid spend, SaaS connections and sales need explicit user approval. Preserve SMAX Nov 7 independent schedule.

## 10. Date / verification basis / limits
2026-10-26 KST. GitHub HEAD before P3 `20575997980b511cf79ead0a1376edcff5e8f5b8`. Linux local Node 22.16 80/80 + curl 200, Chromium blocked, not a test/production pass. After P3 GitHub commit, inspect exact new HEAD and diff in connector; this document cannot encode its own future commit SHA.
