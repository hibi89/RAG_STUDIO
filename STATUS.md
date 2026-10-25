# STATUS — RAG Studio AX Edition

Updated 2026-10-26 KST. Scope: P0 independent public consumer package (not a commercial MVP).

## Implementation (feature/p0-data-contract)
- Added JSON interchange schema, a synthetic six-row sales CSV (KRW 157000; units 10) plus policy TXT, deterministic manifest with SHA256 and file metadata.
- Added built-in Node.js read-only package validator and narrowly scoped sales aggregation CLI; strict package version, path, symlink, digest/size, review and provenance checks.
- Local test evidence: Node v22.16.0; `npm test` => **16 PASS / 0 FAIL / 0 SKIP**; `npm run demo` => six rows, 10 units, 157000 KRW and a document file/source pointer. These are local synthetic tests, NOT Windows/production integration tests.
- Repo base before change `1d809ea830678b667f9223884275f3620a40ead4`, main/develop/feature all identical at inspection. This feature branch commit is to be verified from GitHub; main/develop remain unchanged.

## Explicitly not done
- Original RAG ZIP/source: not present in inspected repo; Library search did not identify the archive itself. No secret/license inspection or source migration.
- Private SMAX actual producer contract/functional handshake: UNVERIFIED. No copy of Private source.
- SQL/SQLite, RAG/BM25/FAISS, UI/dashboard, ZIP importer, Windows installer, SOVIA plugin, CI, production and user installation: NOT IMPLEMENTED/NOT TESTED.
- No paid services, customer inputs, external data transfer or marketing publication.

## Next
1. Independently review `feature/p0-data-contract`, verify remote HEAD and no secret leakage; integrate to `develop` only after review.
2. Confirm original RAG ZIP from user-accessible source when available; do not overwrite its internals.
3. P1 mixed source scenario: readonly database aggregate + TXT citation, exact test evidence, then move to UI.
4. Preserve unchanged private SMAX 2026-11-07 schedule; SOVIA optional.

## Latest integration evidence (2026-10-26 KST)
- `feature/p1-mixed-query` and `develop` confirmed at **4ca33e28d9df1bb69a05cd2089b7c29c89f53f0b**, `main` remains `1d809ea...`; compare P0→P1 = exactly 1 commit, 8 files modified/added.
- Code/test/docs file Git blobs checked equal to the locally tested originals. Commit identity author/committer mapped to `hibi89`. Node test: 28/28 in container; CI/Windows/production still unverified.
