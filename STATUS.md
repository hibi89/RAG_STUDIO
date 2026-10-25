# STATUS — RAG Studio AX Edition

Last verified local development: 2026-10-26 KST; feature branch expected to be `feature/p2-keyword-retrieval`. **This document is a development snapshot, not a runtime/Production claim.** Actual GitHub SHA overrides any earlier handoff.

## Product and constraints
- Local-first self-install workspace; private SMAX² standardization output required for final product; RAG Studio owns verified local dataset/document retrieval, readonly SQLite, evidence and dashboard; SOVIA audit is optional only after the core product works.
- Target commercial price 149,000 KRW (early 99,000 KRW) remains a strategy hypothesis, not a launched product or proof of willingness to pay. Masterplan resides in private `hibi89/SMAX` and must not be copied here.
- One product, three demo markets: small retail/distribution, small manufacturing/technical services, solo analysts. Five usage targets: Document, Knowledge Base, Multi-Document, Conversational, SQL+Document.

## GitHub status and provenance
- `main` baseline `1d809ea830678b667f9223884275f3620a40ead4` at P2 start, unchanged intentionally.
- `develop` basis `a1fd3c65d8e244e46989b4ceb4536ff1a598a5dc` at P2 start, confirmed by live GitHub; already has P0+P1.
- P2 task begins from that basis on `feature/p2-keyword-retrieval`, then fast-forward to `develop` only after review and successful local tests; check new SHA live after commit. No private code or customer data included.

## Verified implementation
| Item | Actual result |
|---|---|
| P0 `AX_DATA_PACKAGE_V0` | Tested validator, synthetic CSV/TXT, integrity, approvals, 6 orders, 10 units, revenue 157,000 KRW |
| P1 mixed SQL+TXT | Tested in-memory `node:sqlite` readonly fixed aggregate + line-cited synthetic refund evidence |
| P2 document search | Tested bounded, stateless BM25 + Hangul 2/3-gram lexical retrieval across multiple SHA-verified synthetic TXT documents, citation line/source pointers, limited return-period conflict detection |
| P0/P1 regression | 28 earlier tests unchanged and passing in same local run |
| P2 tests | 17 additional passing local tests |
| Local tests | Node 22.16.0, `npm test` 45 PASS / 0 FAIL / 0 SKIP; `npm run demo:search` FOUND with both return & shipping evidence |
| ZIP import, original RAG, SMAX real producer | NOT IMPLEMENTED / NOT VERIFIED |
| Full RAG/FAISS, conversations, PDFs, UI/dashboard, Windows installer | NOT IMPLEMENTED |
| CI/Windows/Production/browser/SOVIA/customer sale | NOT TESTED / NOT APPLICABLE |

## Next concrete work
- Implement P2.1 evidence-aware router bridging independently cited retrieval with existing P1 readonly aggregates; test abstention and complete citations. Improve multi-doc conflict detection; never claim definitive advice from rank alone.
- Inspect original RAG ZIP if made available, scan secrets/licenses before cherry-picking algorithms.
- Preserve `main` and private SMAX/SOVIA development plans; no cloud spend, external transfer or product publication.

See `HANDOFF.md`, `docs/P2_KEYWORD_SEARCH.md` and live GitHub branch SHA for continuation. `ㄱ` = next safe implementation unit.


## Verified GitHub integration checkpoint — 2026-10-26 KST
- Code commit **1e8e4742200d826b92acb8a9554873f8c722e10b** verified on `feature/p2-keyword-retrieval`, then fast-forwarded to `develop` with no force. Main remained `1d809ea830678b667f9223884275f3620a40ead4`.
- Remote Git blob hashes of P2 src/test/fixture/package/docs agree with local tested source. Author and committer: `hibi89`, email matched connected account; no credential changes.
- Linux container Node 22.16.0: `npm test` **45 passed / 0 failed / 0 skipped** (P0 16, P1 12, P2 17); `npm run demo:search` returned verified return + shipping line citations. Production/Windows/CI/SMAX original ZIP are not tested.
- This checkpoint documents verified **code** SHA. This docs-only update on top must be checked live for the final HEAD; avoid claiming its SHA from within itself.
