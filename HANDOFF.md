# HANDOFF — RAG Studio AX Edition (P2 keyword search)

Updated 2026-10-26 KST. Live GitHub and actual local tests override this snapshot. New chat: `[RAG_STUDIO 깃헙 레포지토리 보고 작업이어가셈]`; `ㄱ` continues the next safe unit. Do not repeat planning or re-ask approved scope.

## 1. Goal, confirmed requirements, stack
Build one local-first, self-installed product using **SMAX² private producer** → standard verified local data package → RAG Studio read-only DB calculations and multi-doc cited retrieval → dashboard. SOVIA independent optional audit. Three customer demos: retail, small manufacturing/service, solo consultant. Five target RAG scenarios. Target 149k KRW list / early 99k KRW hypothesis, no real sales. Stack Node 22.16+, built-in `node:sqlite`, no npm dependencies so far; synthetic only.

## 2. Implemented decisions and changes
P0 verified `AX_DATA_PACKAGE_V0` fixture, hash/size/path/symlink/review validation, 6-row synthetic sales aggregation; P1 readonly SQLite fixed query plus TXT return-policy cited single mixed question; **P2** `src/document-search.mjs`, `src/search-cli.mjs`, second fixture `fixtures/ax_multi_doc_v0` including shipping policy, 17 tests and `docs/P2_KEYWORD_SEARCH.md`. Statless line-based BM25, Hangul 2/3-grams, full line/file/document citation, `NO_EVIDENCE`, `POSSIBLE_CONFLICT` where distinct return windows are retrieved. Selected on-demand lexical search over persistent vector index for zero-cost small MVP, pending real algorithm archive and benchmarks.

## 3. Tests, commands, pass/fail, scope
`cd repo && npm test`: **45 PASS, 0 FAIL, 0 SKIP** under Linux container Node v22.16.0 (P0=16, P1=12, P2=17). `npm run demo:search`: `FOUND`, returns 7-day return rule and shipping 2-business-day preparation, different document IDs, matching line 2 citations. `npm run demo:mixed`: P1 readonly aggregate remains. No GitHub-hosted CI, Windows, browser, actual customer, original RAG ZIP or production validation. Existing node:sqlite emits experimental warning.

## 4. Done / progress / pending / blocked
Done P0+P1 local synthetic vertical slice plus P2 lexical multi-doc search and synthetic tests. Pending P2.1 evidence router, core 5 RAG modes, real producer handshake, original RAG reuse, PDF/DOCX, index persistence, UI/KPI dashboard, Windows install/recovery, QA gold-set. Original `rag-studio(1).zip` not found in repo or prior accessible Library search; safe-independent coding proceeded. SOVIA optional, not release blocker.

## 5. Errors, attempts, pivots
Local container's GitHub network access previously unavailable; use connected GitHub actions for commits (not blind git retries). RAG original inaccessible; do not recreate/discard without hash/license review, use synthetic independent adapter. Single-file `node:sqlite` is experimental: pass does not establish Windows production stability. No observed failed tests in P2 run. Future corpus expansion may degrade BM25 precision; benchmark and pivot to index only with evidence.

## 6. Repositories / branches / commit SHAs / main paths
Repo `hibi89/RAG_STUDIO` PUBLIC, default `main` baseline `1d809ea830678b667f9223884275f3620a40ead4`. Start `develop` `a1fd3c65d8e244e46989b4ceb4536ff1a598a5dc`. New branch `feature/p2-keyword-retrieval` will be committed against that base; fetch latest ref for confirmed SHA (cannot self-reference its own future commit). Paths `src/document-search.mjs`, `src/search-cli.mjs`, `tests/document-search.test.mjs`, `fixtures/ax_multi_doc_v0`, `docs/P2_KEYWORD_SEARCH.md`, `package.json`, `STATUS.md`, `HANDOFF.md`. P0 and P1 source paths remain unchanged. `hibi89/SMAX` private and `hibi89/SOVIA_sovereign` independent.

## 7. Runtime/deployment info
`node >=22.16`, `npm test`, `npm run demo:search`, `npm run demo:mixed`. No Vercel project or production URL for RAG Studio, no external API/server, GitHub Actions not configured. Deploy status NOT_APPLICABLE; actual Windows install UNVERIFIED.

## 8. Originals/backups/auth/prohibited changes
Existing `main` unchanged; Git history and the prior P0/P1 source are recovery reference. Samples are fake retail data with no personal info. Do not upload private SMAX code/strategy, source archive before secrets/license review, keys, `.env`, client records or logs. Existing account GitHub identity `hibi89`. No external payments/transmission/hosting approved.

## 9. Next priorities/procedure/acceptance/approval
1. Confirm feature/develop remote SHAs, verify source blobs and CI/source parity; preserve stable main.
2. P2.1 add query router that combines trusted lexical source citations and preapproved SQLite metrics, fails closed when evidence is absent/conflicting. Keep source pointers and no arbitrary SQL; synthetic tests and CLI demo.
3. P3 start local document+dataset viewer and evidence-backed KPI mini dashboard, following masterplan gap comparison. PDF/Word and higher search quality after original code review.
4. Sell, deploy, upload real data, modify repo visibility, spend, change SMAX/SOVIA or legally change licensing only with user explicit approval.

## 10. Updated time, verification boundary, base revision
2026-10-26 KST. Verified local Node v22.16.0 P0+P1+P2 45 tests. GitHub P2 commit/merge and final HEAD to verify after upload; initial basis `a1fd3c65...`, no remote runtime evidence. No finished commercial product claim.


## Verified GitHub integration checkpoint — 2026-10-26 KST
- Code commit **1e8e4742200d826b92acb8a9554873f8c722e10b** verified on `feature/p2-keyword-retrieval`, then fast-forwarded to `develop` with no force. Main remained `1d809ea830678b667f9223884275f3620a40ead4`.
- Remote Git blob hashes of P2 src/test/fixture/package/docs agree with local tested source. Author and committer: `hibi89`, email matched connected account; no credential changes.
- Linux container Node 22.16.0: `npm test` **45 passed / 0 failed / 0 skipped** (P0 16, P1 12, P2 17); `npm run demo:search` returned verified return + shipping line citations. Production/Windows/CI/SMAX original ZIP are not tested.
- This checkpoint documents verified **code** SHA. This docs-only update on top must be checked live for the final HEAD; avoid claiming its SHA from within itself.
