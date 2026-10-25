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
