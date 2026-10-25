# STATUS — RAG Studio AX Edition

Snapshot: **2026-10-26 KST**. Source of truth is live GitHub plus runnable test evidence. Project is **not released**.

## Product decision
- Local-first, customer self-install. Private SMAX² standardization is a required **future producer integration**, followed by local verified RAG Studio data and document analysis/dashboard; SOVIA is a future optional audit addon, never a release blocker.
- Product target price 149,000 KRW / promotion 99,000 KRW is an **unvalidated business hypothesis**, not sales. 3 target demos: retail, technical/manufacturing services, solo analysts. 5 target usage modes: Document, Knowledge Base, Multi-Document, Conversational, SQL+Document. Private commercial masterplan stays in private SMAX.

## Implementation and verification (local Linux / Node v22.16.0)
| Unit | Verified state |
|---|---|
| P0 package consumer | Synthetic manifest/CSV/TXT; verified paths, sizes, SHA-256, review status and sales row provenance; 16 tests |
| P1 fixed SQLite + one TXT | In-memory database, `PRAGMA query_only=ON`, exact sales sums, single document pointer; 12 tests |
| P2 keyword multi-document retrieval | Zero-dependency, stateless BM25 + Korean 2/3-gram lexical line search; provenance/conflict status; 17 tests |
| **P2.1 evidence router** | `src/evidence-router.mjs` + CLI, fixed sales metric + cited return and shipping policy facts, no-answer when incomplete/conflicting, exhaustive bounded period check; **15 tests** |
| Full regression | `npm test` **60 PASS / 0 FAIL / 0 SKIP**, `npm run demo:router` **ANSWERED** (KRW 157000; 6 orders; 10 units; return 7 calendar days; shipping 2 business days) |
| GitHub | Base `develop` SHA `66e2436e11173133fe2c0a5c757c00e4d00812af` before P2.1. Implement on `feature/p21-evidence-router`, then integrate to `develop` only after test, remote SHA/diff review. `main` remains stable baseline `1d809ea...` |
| Private SMAX/SOVIA | Not modified; producer/consumer real integration **unverified** |
| Production/Windows/CI/browser | NOT APPLICABLE or NOT TESTED. No live deployment or customer sales |

## Explicit limitations
- Router only detects limited sales/return/shipping terms; the period regex is not a legal/policy interpretation engine, and retrieved quoted statements may omit context. Unsupported subquestions not in its vocabulary are not guaranteed to be recognized. Customer-facing general-purpose AI claims **prohibited**.
- No original `rag-studio(1).zip` found in inspected GitHub/available Library. Reusing old engine requires real file, hash, secret and OSS license review, not fictional migration.
- No external network calls, paid model, arbitrary user-supplied SQL, customer data, SMAX private code, installer or production service. `node:sqlite` experimental warning remains; Windows compatibility unverified.

## Next safe unit
P3 smallest local browser-accessible read-only dashboard for the synthetic package, with KPI, document cards, source line citations, missing/conflict states and local-only test. Recheck P2.1 remote source/test hashes and `develop` branch first. Then real SMAX producer adapter only when interface can be safely verified; Windows & 100-question gate before sale. No change to private SMAX's 2026-11-07 independent priority.

## Verified remote integration checkpoint — 2026-10-26 KST
- **Code + tests + initial handoff commit**: `c10e44b6c0eb39501483f69dcc5ac7f089229179`. Verified GitHub HEAD of both `feature/p21-evidence-router` and `develop` after fast-forward; `main` remains unchanged at `1d809ea830678b667f9223884275f3620a40ead4`.
- GitHub compare `66e2436e..c10e44b6`: **ahead 1 / behind 0 / exactly 7 expected files changed**. Remote Git blob SHA of all seven files matched local Node-tested originals; account author/committer `hibi89`. No force push.
- Linux local `npm test`: **60 passed / 0 failed / 0 skipped**; `npm run demo:router`: `ANSWERED` with source citations. GitHub CI, Windows, browser, live SMAX adapter, Production, sale remain **unverified / not applicable**.
- This checkpoint documents the inspected code SHA; any subsequent documentation-only checkpoint must be verified from GitHub before quoting its own final HEAD.