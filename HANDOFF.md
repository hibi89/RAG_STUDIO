# HANDOFF — RAG Studio AX Edition (P0)

> 2026-10-26 KST; latest actual source and GitHub branch head override this snapshot. Exact resume: `[RAG_STUDIO 깃헙 레포지토리 보고 작업이어가셈]` or `ㄱ`.

## 1. Product / requirements / technology
Local-first self-install AX data+knowledge workspace. SMAX² output standardization required, RAG+readonly DB+dashboard core, SOVIA independent optional audit. One product, 3 demo markets (retail, technical-service/manufacturing, solo analyst); 5 target RAG scenarios. Price targets 149000 KRW, early 99000 KRW, future SOVIA option; **not on sale**. Product masterplan is Private SMAX, do not disclose.

## 2. Completed scope and rationale
P0 standalone **public consumer** v0 developed from synthetic data, without needing inaccessible old RAG ZIP. Shape schema + hash/provenance manifest, approved 6-row CSV and returns TXT, readonly Node built-in validator and narrow sales summary CLI. No API spend or customer data. Chose Node built-ins (zero npm dependency) instead of Python+external schema lib, aligned with existing SMAX JS tooling; this is not an integrated SMAX adapter.

## 3. Test command/results/limitations
Node v22.16.0: run `npm test` at repo root => 16 pass, 0 fail, 0 skip on synthetic P0; run `npm run demo` => 6 orders, units 10, revenue 157000 KRW, line-linked evidence and policy TXT source. Windows install/SMAX handshake/actual source migration/DB/LLM/API/browser/production all UNVERIFIED. Schema document and custom parser both present; third-party JSON Schema compliance engine not run.

## 4. Done / in progress / pending / blockers
DONE: P0 local data-contract consumer demo and tests. PENDING: actual ZIP, private producer integration, SQL+document E2E, UI/dashboard/installer, benchmark/security/sale readiness. RAG ZIP not found in inspected repository/Library search; source migration blocked until owner provides accessible original, but synthetic P1 can continue.

## 5. Failure/recovery
GitHub repo contains docs only at base; external git network in local container unavailable (`Could not resolve host: github.com`), so remote changes use authorized GitHub connector. No retry loop; local tests independently run. For original archive, do not fabricate or silently rewrite. If future producer violates v0, fail with explicit review state and build a versioned adapter.

## 6. Repo / branches / basis SHA
Public `hibi89/RAG_STUDIO`; main/develop/feature/p0-data-contract basis `1d809ea830678b667f9223884275f3620a40ead4` at start. P0 is feature-branch-only until review. Major paths `contracts/`, `fixtures/ax_sample_v0/`, `src/`, `tests/`, `docs/DATA_CONTRACT.md`. Check latest branch HEAD after commit.

## 7. Runtime / deployments
Node >=20; `npm test`; `npm run demo`; no npm installation needed. Vercel project/Production URL: NOT APPLICABLE; local no-server library/CLI demo, no deployment.

## 8. Sources/backup/secrets
Existing main/develop/base SHA preserved; public fixture entirely synthetic. Private SMAX doc is strategy source, code not copied. Unknown `rag-studio(1).zip` remains uninspected. Never expose keys, customer files or local private scripts; no customer backups required (no original modified).

## 9. Priority / acceptance / approval
Review remote diff; P1 integrate readonly local SQLite with approved CSV data and deterministic TXT BM25 retrieval, evidence-linked mixed answer. Then compare to original design and fill UI. Sale, data transmission, spending, production deployment, privacy/permission changes require user approval, but synthetic safe code/test work can continue.

## 10. Snapshot
2026-10-26 KST; inspected GitHub repository/branches/docs/SMAX private masterplan/SOVIA docs; tested Node local fixture P0 only. Basis SHA `1d809ea`; feature commit must be checked live. Distinguish local pass from GitHub mirroring and production.

### Verified remote integration receipt (2026-10-26 KST)
- P1 exact code commit SHA: `4ca33e28d9df1bb69a05cd2089b7c29c89f53f0b` on `develop` and `feature/p1-mixed-query` before this docs-only checkpoint. P0 preserved on `feature/p0-data-contract`; `main` unchanged. GitHub identity `hibi89` for author/committer.
- GitHub source blobs exactly matched local Node 22.16.0 tested source, **28 PASS / 0 FAIL / 0 SKIP**. GitHub-hosted CI, Windows, actual service unverified.
