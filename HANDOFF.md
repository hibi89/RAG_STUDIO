# HANDOFF — RAG Studio AX Edition (P2.1)

Updated **2026-10-26 KST**; exact resume trigger: `[RAG_STUDIO 깃헙 레포지토리 보고 작업이어가셈]`, and `ㄱ` continues safely. Fresh GitHub SHA and tests override this snapshot.

## 1. Goal, requirements, technology
Local-first/zero-fee self-installed tool: SMAX² private standardization → `AX_DATA_PACKAGE_V0` local ingestion → reliable read-only sales metrics + document evidence → dashboard. SOVIA optional audit. 3 sales demo markets, 5 RAG usage modes (Document/Knowledge Base/Multi-Document/Conversational/SQL+Document). Node >=22.16 with built-in SQLite; zero npm dependencies. Commercial target 149k KRW / early 99k KRW is not validated; private masterplan remains in private `hibi89/SMAX`.

## 2. Completed work and engineering decisions
P0 synthetic verified manifest/CSV/TXT consumer, P1 verified in-memory SQLite readonly totals + return TXT citation, P2 BM25/Hangul n-gram multi-TXT retrieval/conflict heuristic, P2.1 `src/evidence-router.mjs`/`src/router-cli.mjs`/`tests/evidence-router.test.mjs`, `docs/P21_EVIDENCE_ROUTER.md` and `npm run demo:router`. Router chooses from bounded whitelisted intents; verifies entire source, finds document citations, checks duration conflicts across all verified documents (not just ranked top hits), routes fixed SQL query, and refuses incomplete/conflicted requests. Chose simple deterministic local path over an LLM router or generated SQL for accuracy/cost/safety. No private SMAX code or real customer data in public repository.

## 3. Test evidence, successes and limits
Local Linux container Node `v22.16.0`: `npm test` **60 pass, 0 fail, 0 skip** (P0=16, P1=12, P2=17, P2.1=15). `npm run demo:router`: `ANSWERED`, 6 synthetic orders / 10 units / KRW 157000 / return 7 calendar days / shipping preparation 2 business days, CSV line 2–7 and TXT line 2 citations. Negative tests: no evidence/unsupported, modified digest, missing review approval, SQL injected question as text, conflicting same-line and >10 ranked return policies, shipping conflict, source immutability. GitHub-hosted tests, Windows, original-source migration, UI/browser, operational API, production security remain **UNVERIFIED**.

## 4. State and stop point
Completed: P0, P1, P2 and P2.1 **synthetic local slices** only. Next: P3 read-only local dashboard with KPI/line citation and refusal states. Pending: actual SMAX producer handshake, old RAG ZIP, PDF/DOCX, dense retrieval evaluation, Knowledge Base/Conversational broad support, persistent index, installer, gold-set, customers, sale. Original archive is unavailable; not a blocker for synthetic UI slice.

## 5. Errors, causes and pivot
Prior shell git host DNS failure: use authorized GitHub connector without repeated blind retries. Original RAG ZIP not accessible: no guessing or overwriting; continue independently from synthetic contracts. `node:sqlite` warns experimental, so do not guarantee Windows distribution. No P2.1 test errors observed in local 60-test run. For ambiguity, return `INSUFFICIENT_EVIDENCE` or `POSSIBLE_CONFLICT`; do not infer legal validity or universally correct policies.

## 6. Repo/branches/SHAs/paths
Public repo `hibi89/RAG_STUDIO`; default `main` remains `1d809ea830678b667f9223884275f3620a40ead4`, verified `develop` base before P2.1 `66e2436e11173133fe2c0a5c757c00e4d00812af`. P2.1 development branch `feature/p21-evidence-router`; verify actual new commit SHA live before any next work. Source `src/evidence-router.mjs`, `src/router-cli.mjs`; tests `tests/evidence-router.test.mjs`; docs `docs/P21_EVIDENCE_ROUTER.md`, `STATUS.md`, `HANDOFF.md`; rest of files preserved.

## 7. Production/deployment/runtime
Commands `npm test`, `npm run demo:router`, `npm run demo:mixed`, `npm run demo:search` at repo root. No Docker, Vercel project, Production URL, auto deployment, mandatory external API, or hosting. Deploy classification **NOT APPLICABLE**; do not equate local tests with production.

## 8. Original, backups, secrets, protected content
Prior Git history is recovery point, and original P0/P1/P2 paths are unchanged except `package.json` new demo script. All fixtures synthetic. Private SMAX code/masterplan, tokens, .env and customer materials must not enter public repo. No real original inputs modified, no paid services, changes to repo privacy or third-party access prohibited absent approval.

## 9. Next priority, procedure, acceptance, approvals
1. Fetch live remote HEAD/diff; confirm all P2.1 source blobs match tested local bytes and P0/P1/P2 unchanged.
2. Implement P3 synthetic desktop-friendly read-only dashboard/preview; show provenance and conflict/insufficient states, then run unit and real browser tests if available.
3. Later original archive hash/secrets/licenses and SMAX handshake, three Windows PCs, 100-question benchmark, install/restart/recovery, customer-data safety and licensing/returns gates.
4. Deployments, purchases, real customer files, private repo writes, account/security settings changes, live sale require separate explicit owner approval. Synthetic safe implementation proceeds without re-asking previously settled business goals.

## 10. KST snapshot and evidence base
2026-10-26 KST. Live `develop` before new work = `66e2436e11173133fe2c0a5c757c00e4d00812af`; local Node v22.16.0 60/60 PASS. Commit/branch-head created after this text must be checked live, so no self-referential final SHA appears here. This handoff records local P2.1, not deployed or customer-tested completion.

## Verified remote integration checkpoint — 2026-10-26 KST
- `feature/p21-evidence-router` and `develop` both confirmed on **code commit** `c10e44b6c0eb39501483f69dcc5ac7f089229179` after approved fast-forward; stable `main` unchanged at `1d809ea830678b667f9223884275f3620a40ead4`.
- GitHub compare: one commit ahead, zero behind, exactly seven expected files changed. All seven remote Git blob SHAs exactly matched locally tested files. GitHub commit author and committer connected to `hibi89`; no force update, secrets, private source, paid external services or production deployment.
- Node v22.16.0 Linux: **60/60 pass, 0 fail**, P2.1 demo responded using two individually cited policy texts and six sales CSV rows. Only local synthetic test evidence; Windows, GitHub CI, browser, real data, real SMAX interface and production remain unverified.
- Next atomic work: P3 synthetic local dashboard UI and browser/source-attribution tests. Verify latest develop HEAD before touching code; documentation checkpoint SHA may differ from code SHA.