# P5.54/P5.55 — RAG Studio fail-closed review delivery security, 2026-11-12 KST

## Goal and scope
Engineering target P95; prior milestone 85% provisional. Fix genuine local review delivery risks without changing source CSV/TXT, private SMAX producers, public releases, user approval, or customer rights. This change **does not meet P95** on its own. Sale remains RELEASE HOLD.

## Design comparison and decision
- A: On a failed bundle build, recursively delete the destination directory after attempting a byte/inode ownership check. Cheaper cleanup but a TOCTOU race remains; deleting a replaced path can remove unrelated files. Rejected.
- B: Never automatically delete a failed output path; return HOLD and preserve the restricted partial directory for explicit owner inspection. Strictly open only regular UI assets by physical FD with no-follow, file and directory identity checked before and after reading. Small leftover review directory on failure; safely avoids recursive deletion. Selected.

## Implemented
- P5.54 `src/prep-review-bundle.mjs`: previous unconditional `fs.rmSync(outputDir, {recursive:true,force:true})` on build error removed. A failed write raises `RAG_PREP_BUNDLE_BLOCKED` without deleting the possibly replaced destination. Existing no-overwrite and 0700 output directory creation retained.
- P5.54 `tests/p553-review-bundle.test.mjs`: two controlled synthetic regression cases (actual path replacement with unrelated marker and normal simulated write error). This does not touch user folders.
- P5.55 `src/prep-owner-local-server.mjs`: `readPinnedStaticAsset` allows only three fixed UI names; rejects nonregular, hard-linked or symlinked files, oversized/empty assets and changed directory or file identity; reads through verified FD with no-follow and nonblocking flags where supported. Local-only HTTP, CSP, Host/Origin and no-upload routes preserved.
- P5.55 `tests/p555-local-static-integrity.test.mjs`: five new regressions (allowlist, sizes, hard/symlink, swapped file, swapped root). Real localhost browser E2E still not claimed.

## Verification
- Original P5.53 Git blob `0c9f357a3706109dbf0a3a4a7d3b4092ec67e262` reconstructed and verified by `git hash-object`. In an isolated temporary synthetic path-swap test the original error cleanup **deleted an unrelated owner's marker file**.
- Fixed P5.54 Git blob `47788b66c3268df75856022bd0a70184586b3cad`; existing standalone verifier unchanged and exact Git blob `c4accfd4a2d7a1929112dad45db82ae54526f11e`.
- P5.55 static-server exact Git blob `9e8a2933eead90268fd1c9a431ceabaa4639eb1a` independently reconstructed.
- Linux Node22.16 isolated exact-source harness `node --test race-check.mjs static-check.mjs` **11 PASS / 0 FAIL / 0 SKIP**, including real loopback HTTP allowlist and no JSON route. Local harness mocks only the upstream sales/mixed input-producing dependencies; it is **NOT** the full original repository `npm test` nor real Windows, real preview calculation or customer acceptance.
- GitHub Actions exact feature source/test commit `03e06c15d278cf094b37e1292570a36e94def288`: [P5.47 run #43221154095](https://github.com/hibi89/RAG_STUDIO/actions/runs/43221154095) `failure`, **zero jobs**, no test executed. P5.45 run #43221152060 `failure`. This is a pre-job CI execution blocker; do not claim code regression or success without logs.
- Native full original `npm test`, Gold/Negative/Heldout, actual Windows Edge/Chrome localhost, customer workloads and private SMAX E2E: **NOT VERIFIED**.

## Recovery and safe continuation
- Existing public branch and private SMAX sources/customer files remain unchanged except the scoped two product source files and two test files on current feature branch. Revert the scoped commits if later integrated regression is found. No force push, billing, workflow permission, production or deployment mutation.
- Do not auto-delete failed partial review output: inform the owner it is an unverified private directory requiring manual review.
- Next: diagnose GitHub Actions 0-job failure without repeated empty reruns or paid changes; full source checkout when available; original complete npm suite, independent Windows browser smoke, approved SMAX producer and rights/security/sales review. Customer release remains NO-GO.

**Score: 85% provisional unchanged / P95 NOT ACHIEVED / RELEASE HOLD.**
