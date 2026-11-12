# P5.58 — Offline pre-extraction ZIP integrity and original-producer contract

**2026-11-12 KST · target 95% · release HOLD · no external network or customer files.**

## Design and tradeoff
A. Ask owner/buyer to extract the ZIP, then run bundled review-bundle-verify.mjs. Simpler, but the archive is not checked before extraction; system unzip and Windows extraction can differ.
B. Add a Node22 built-in fixed-structure ZIP parser for exactly the 11 P5.57 members, CRC32, byte positions, manifest SHA and the separate P5.56 KPI/source/approval contract. No generic decompressor, network access or binary dependencies, and no extraction needed. B implemented. More maintenance logic than A, but narrow attack surface and Windows-compatible Node execution.

## Changes
- src/review-zip-verify.mjs: user-controlled absolute ZIP pathname, FD-pinned regular file, max 4MiB, symlink/hardlink rejection. Inspects ZIP central and local headers with fixed 11 entries, STORE-only, UTF-8 name bit, CRC32, fixed timestamp, no comments/extra fields, contiguous offsets/no trailing bytes, exact allowlist. Parses JSON manifest/report in memory; validates relative path list, SHA256/size, P5.56 SKU/metrics/provenance and explicit NOT_GRANTED/REVIEW_HOLD flags. Returns only RAG_REVIEW_ZIP_INTEGRITY_PASS_NOT_APPROVED, SHA, size, files; otherwise RAG_REVIEW_ZIP_INVALID. Never unzips, executes or uploads archive contents. SHA is **not an authenticated digital signature**.
- npm run verify:prep:review-zip -- "ABSOLUTE_REVIEW.zip" invokes this CLI with Node22.16+ available.
- tests/p556-bundle-physical.test.mjs adds 5 tests: genuine P5.57 archive, CRC/EOCD/trailing/truncation, zip name/path/symlink, forged KPI rejection, CLI safe failure/no private paths. Exact source Git Blob verified.
- tests/p553-review-bundle.test.mjs adds a full original source-producer CSV/owner mapping/TXT -> bundle -> ZIP -> archive verifier -> tamper refusal regression. **The full original repository test was committed but has not been executed in this isolated container**.

## Verification actually executed
- Linux container Node v22.16.0 original exact Git blobs:
  - new offline verifier SHA 6b600fc2c9b4b3861e543d61db02d795abfb587b;
  - appended synthetic physical test SHA 2545b938ef6961a7fef0171254e810b635d80b17;
  - underlying P556/557 blobs verifier abe72a31e6e11a8dbe143750e5a770acc4028212 and ZIP 2054f2e49dfe25deb7db8a68212756e95324e264.
- node --test tests/p556-review-consistency.test.mjs tests/p556-bundle-physical.test.mjs: **22 PASS / 0 FAIL / 0 SKIP**.
- Separate synthetic stub upstream in /mnt/data/rag_p554_test with exact Git-sourced prep-review-bundle.mjs, P556 verifier, P557 ZIP, and P558 independent archive verifier: **1 PASS / 0 FAIL / 0 SKIP** for folder production → ZIP → pre-extraction audit → tamper refusal. Upstream sales/policy calculators and UI assets in that **narrow integration harness are synthetic mocks**, NOT the original source; no full original pipeline claim.
- GitHub Actions P545/P547 branch runs still **FAILURE with 0 JOBS** before tests. Current 2026-11-12 official GitHub Status did not show an ongoing service-wide Actions incident; cannot conclude reason or permission/billing root cause. No blind rerun or account settings modifications.

## Provisional scope-based score
P5.56/557 previously reached **90% provisional engineering**; pre-extraction ZIP integrity, Node-only independent owner CLI and new regression add **+2 points = 92% provisional engineering**. Test numbers are not completion percentages. P95 **NOT ACHIEVED**; release still HOLD, owner consent/private SMAX integration, full original npm/Gold/Negative/Heldout, native Windows/browser and actual 3-vertical approval required.

## Next safe tasks / recovery
1. When complete source checkout is available, run npm test, npm run test:gold, test:negative, test:heldout, including full P553 original-producer integration in BOTH Linux and Windows. Inspect failures and fix conservatively.
2. Determine why GitHub Actions p545/p547 runs produce 0 jobs; no speculative workflow permission/billing modifications. Different repository Actions success does not establish current repo eligibility.
3. Real Windows 10/11 ZIP extraction + Node local UI, supported dataset verticals with customer rights and private native SMAX approved producer; no production URL/Vercel. Owner explicit commercial GO only after all gates.
4. The Kmong central product roster must retain RAG Studio [작업중] until verified owner target P95, even if the task is paused/handed off. Do not remove marker for partial progress.
