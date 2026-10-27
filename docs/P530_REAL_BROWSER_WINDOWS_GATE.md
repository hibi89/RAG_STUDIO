# P5.30 — Actual Chrome CSV E2E and Windows QA gate

Checkpoint: 2026-10-27 KST. Public synthetic data only. This is not a product release.

## Purpose and design options
- A. Native HTTP / simulated DOM tests only: cheap, but cannot verify real browser file selection or runtime errors. Rejected as browser E2E evidence.
- B. CI-only Playwright running installed Google Chrome on Ubuntu plus separate real Windows hosted-runner preflight and native tests. Chosen for actual evidence without changing product runtime dependencies.

## Verified results
- Real Chrome 155 on Ubuntu 24.04, Node 22.16.0, run https://github.com/hibi89/RAG_STUDIO/actions/runs/40519068343, tested source SHA 33bd7bd93ba6f06bb4ee0cb007dce8bb0f935f81: 11 real browser checks PASS, 0 FAIL; Linux npm test 441 PASS, 0 FAIL/skip/cancel. Doctor/gold/negative/heldout passed.
- Browser checks include unauthenticated KPI hidden, bearer session, fragment removal, verified 157000 KRW/6 orders/10 units, native setInputFiles CSV selection, type/schema review, inert HTML-like header, malformed CSV block, oversized CSV blocked before network POST, source/KPI invariants, mobile input, zero page runtime errors and no external browser request.
- Initial browser failure was a test expectation mismatch: actual UI renders 6건/10개 instead of bare 6/10. Corrected test assertions; application behavior unchanged.
- Windows 2025 runner: initial synthetic fixture SHA failed due Git LF-to-CRLF checkout changes. Added .gitattributes rule fixtures/** -text to preserve hash-pinned bytes; Windows synthetic preflight now WINDOWS_DEMO_PREFLIGHT_PASS.
- However Windows npm test is 431 PASS / 10 FAIL on run 40519068343. Windows is NOT validated. SMAX disk provenance, P5.13 local sales preview CLI, P5.27 chosen TXT/MD identity, P5.28 local CSV identity fail. There is evidence Windows path-stat/file-descriptor dev/ino handling may differ, but not complete proof for every failure.
- Earlier Windows workflow incorrectly appeared success because Powershell multiline ran npm test then doctor, returning only the final successful process status. Workflow corrected: npm test and doctor are separate fail-sensitive steps. Run https://github.com/hibi89/RAG_STUDIO/actions/runs/40519621680 explicitly marks Windows regression FAILURE while real Chrome succeeds. No false-green Windows claim.

## Security and next-stage decision
- Do not remove inode, symlink or digest checks simply to make Windows green.
- Faster A: ignore dev/ino on Windows and use size/mtime only. Lower maintenance but weaker substitution/TOCTOU defense; not recommended.
- Safer B: use Windows-compatible handle, repeated exact source-byte SHA validation plus bounded lstat/realpath checks; test symlink/junction/atomic replacement, cleanup and concurrent changes. Recommended as P5.31 candidate, subject to security-boundary review and prior approval before weakening existing protections.
- Main/default branch is intentionally unchanged. Until Windows regressions resolve, keep P5.30 on its feature branch, not develop.
- No physical 3-PC Windows/Edge/installer/SmartScreen test, private SMAX Native producer, real customer ZIP, trained Dense model, Vercel production or paid activity.

## Reproduce
- Linux: npm ci --ignore-scripts --no-audit --no-fund; CI-only npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright@1.64.1; node scripts/p530-csv-browser-e2e.mjs; npm test; npm run doctor; npm run test:gold; npm run test:negative; npm run test:heldout.
- Windows hosted runner: npm ci --ignore-scripts; node scripts/windows-preflight.mjs; npm test as a separate step; npm run doctor as a separate step. Do not treat preflight success as full Windows QA.

## Resolution addendum (2026-10-27)

Follow-up identity matrix #40520743005 proved source of 10 failures: on Windows Node22.16 lstat.dev=0 vs fstat.dev nonzero for same fixture/temp file. Windows Node22.23 and24.11 both show equality and **441/441 tests pass**. Linux Node22.16 still passes. No source-integrity guard was removed.
Acceptance workflow #40521393391 exact SHA efda0cb1eae1ceff65e6506e8c1c01155e4ec907 shows both Linux real Chrome **11/11**, Linux Node **441/441** and Windows hosted Node22.23 **441/441** fully green. Previous 431/441 Windows failure remains relevant ONLY to tested Node22.16 setup. Product's declared global >=22.16 threshold is not a verified Windows support guarantee; product min-version policy still needs owner approval. No customer ready claim.
