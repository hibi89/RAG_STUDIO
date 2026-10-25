# STATUS — RAG Studio AX Edition

Updated **2026-10-26 KST**. Live GitHub branch and execution evidence override this snapshot. No commercial product or production deployment.

## Strategy (preserved)
Local-first self-install; private SMAX² producer → `AX_DATA_PACKAGE_V0` → read-only DB/verified document search → evidence-backed dashboard. SOVIA optional only. Target customers: small retail/distribution, manufacturing/technical services, independent analysts; five roadmap modes Document / Knowledge Base / Multi-Document / Conversational / SQL+Document. Target prices 149,000 KRW / initial 99,000 KRW remain unvalidated hypotheses; private SMAX plan stays private.

## Implemented / evidence
| Stage | Scope | Local evidence |
|---|---|---|
| P0 | synthetic manifest/dataset/doc SHA verification, row lineage | 16 tests |
| P1 | SQLite readonly fixed sales aggregation + document proof | 12 tests |
| P2 | BM25 Korean ngram multiple TXT search, line pointers, conflict signal | 17 tests |
| P2.1 | composite policy+sales routing with conservative abstention and conflict detection | 15 tests |
| **P3** | **opt-in localhost dashboard**: KPI cards, document metadata cards, fixed SQL+TXT question, source-cited search, CSV row evidence, refusal states; HTTP and UI assets | **20 new tests** |
| **All Node tests** | `npm test`, Node v22.16.0 (Linux) | **80 PASS / 0 FAIL / 0 SKIP** |
| HTTP smoke | server bound only to 127.0.0.1; curl GET `/api/overview` | **HTTP 200** |
| Real Chromium browser smoke | Playwright navigation to local address | **BLOCKED BY ENVIRONMENT (`net::ERR_BLOCKED_BY_ADMINISTRATOR`)**, rendered UI **UNVERIFIED** |

## Current GitHub and development scope
- Repo `hibi89/RAG_STUDIO` PUBLIC; prior verified `develop` HEAD **`20575997980b511cf79ead0a1376edcff5e8f5b8`** (before P3 changes).
- Work branch: `feature/p3-local-dashboard`, created from exact HEAD above. Only after review and remote file parity should it be fast-forwarded to `develop`; **`main` remains `1d809ea830678b667f9223884275f3620a40ead4`** unless separately validated and released.
- Private `hibi89/SMAX` 2026-11-07 independent work priority and `hibi89/SOVIA_sovereign` untouched. P3 uses only synthetic public examples. No paid services/cloud hosting/customer data.
- P3 new paths: `src/dashboard-server.mjs`, `src/dashboard-cli.mjs`, `ui/*`, `tests/dashboard.test.mjs`, `docs/P3_LOCAL_DASHBOARD.md`; `package.json` adds `npm run dashboard`. Existing core unchanged.

## Remaining / blockers
- Real browser JS render, desktop/mobile responsive, Console/Network: UNVERIFIED due environment block, not proven to be malfunctioning.
- Windows installation/browser, original RAG ZIP reuse/license/secret review, real SMAX package producer handshake, customer sources, full PDF/Word, vector/hybrid, session context, broader questions, real dashboard charting, indexes, production security, 100-question/3-PC tests: NOT DONE.
- Local HTTP has no per-session authentication yet: **do not load real customer files** before session token/CSRF and local browser QA.
- CI, Production URL, Vercel project, sales, payment: NONE / NOT APPLICABLE.

## Next `ㄱ`
P3.1 authorized browser test/reliability and local session-token guard or, if external browser still inaccessible, incremental synthetic KPI/chart capabilities; compare blueprint gaps and preserve real-data security gate. Confirm latest GitHub SHA first. Update STATUS/HANDOFF on every meaningful change; do not promote `main` or release without appropriate review.
