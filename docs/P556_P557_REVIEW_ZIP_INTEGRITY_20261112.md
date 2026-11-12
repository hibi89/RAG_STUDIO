# RAG Studio P5.56/P5.57 — evidence consistency and offline ZIP (2026-11-12 KST)

**Target 95% engineering; current evidence supports 90% provisional engineering, RELEASE HOLD.**

## Design alternatives
A: Accept SHA manifest alone, ship entire owner folder. Fast but internal KPI/citation fraud and accidental source leakage can survive.
B: Validate separate sales/policy report consistency and negative authorization flags, then explicitly export only a verified 11-file allowlisted review-only ZIP. No raw CSV/TXT, unsigned, no automated approval or upload. **B implemented** for safety and no paid dependencies. No self-signed SHA can authenticate owner or data rights.

## Code and behavior
- P5.56 src/review-bundle-verify.mjs exports validateReviewConsistency. It validates totals, safe decimal values, SKU subtotals, original source evidence line ordering and correspondence to the mixed report, policy citations, missing/conflicting statuses and negative approval/import/upload flags. Existing on-disk verifier invokes it after per-file hashes.
- P5.57 src/review-bundle-zip.mjs builds deterministic STORE ZIP (zero compression, fixed time, CRC32) from verified manifest+10 allowlisted files. Reads pinned file descriptors, checks bytes against manifest, re-verifies source folder, forbids source-inside output, symlink ancestors, overwrite, excess member sizes, and returns only SHA/size/status. Failed partial outputs remain HOLD and are never deleted automatically.
- src/review-bundle-zip-cli.mjs performs explicit local owner invocation; package.json script: npm run export:prep:review-zip -- "ABSOLUTE_REVIEW_FOLDER" "ABSOLUTE_NEW_FILE.zip".
- Updated tests/p553-review-bundle.test.mjs includes additional original source producer rehash regression. This integration test is registered but **NOT EXECUTED** on the original full checkout.

## Executed tests
Linux Node 22.16 exact remote Git blob-backed modules and two new test files:
- verifier blob abe72a31e6e11a8dbe143750e5a770acc4028212
- ZIP producer blob 2054f2e49dfe25deb7db8a68212756e95324e264
- CLI blob fe9070f624666265dfd102b3383ac4e1d1ca8fe4
- unit test blob 3981f61aac83e70ba677ff398039b56d010d0e9c
- physical test blob b77b05581f7f654be61c7fa3afb0b183e9abdb88

Command: node --test tests/p556-review-consistency.test.mjs tests/p556-bundle-physical.test.mjs
Result **17 PASS / 0 FAIL / 0 SKIP**. On-disk real manifest+files, forged report hash updates, no-clobber, symlink, deterministic 11-file ZIP, system unzip -t CRC test, genuine ZIP extraction to a new directory, bundled independent Node verifier after extraction, and CLI duplicate refusal all exercised with synthetic-only inputs.

## Unverified / blockers
Full original npm test, Gold100, Negative20, Heldout24, P553 actual producer, real Windows10/11 Edge/Chrome, private SMAX native source-to-review three verticals, customer consent, rights and commercial support: **NOT RUN** in current environment. Full original Git checkout network DNS unavailable; tests based on exact independently reconstructed source are narrow, not a substitute for the full repository. GitHub Actions p547/p545 on this branch still FAIL before jobs are created (0 jobs); no paid runner or permissions changes. Do not mislabel as code test failure or SUCCESS.

## Feature coverage and release gate
Earlier internal technical 85% provisional. Weighted new product coverage: P5.54/55 data-safe output/HTTP boundary +1 point, P5.56 source-cited report consistency +2 points, P5.57 fully verified offline ZIP and independent extracted verifier +2 points = **90% internal engineering provisional**. This is not a ratio of passing tests. 95% cannot be certified without original suite, owner-device Windows workflow, true end-to-end source producer and customer/release gates. Commercial **RELEASE HOLD**. No other Kmong product scoring changes.

Recovery: original feature SHA available in Git history; no main, develop, private SMAX, customer assets, secrets, deployment or domains changed. Next: recover full original test environment; diagnose zero-job Actions without blind rerun; complete native Windows and permissioned multi-vertical end-to-end; owner approval to release.
