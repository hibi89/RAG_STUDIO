# P5.31 — Cross-runtime Windows identity probe (no security guard changed)

Source P5.30 base: bc01a6d005e62d94122faa71992ed5abd5d74398. Only existing public synthetic fixtures and disposable synthetic temporary file used.

## Two options
1. Run entire Windows suite under maintained newer Node runtime with existing strict checks untouched. If a newer version passes 441/441, pin a suitable minimum after verification; costs no model/API access but raises minimum Windows Node version.
2. If all versions fail, design a secure Windows-specific open-handle and path identity verifier with repeated content-digest and adversarial reparse/replacement tests. Higher complexity, explicit security change approval required. Avoid skipping device/inode, link or SHA checks.

## Evidence collection
- .github/workflows/p531-identity-matrix.yml runs real hosted Windows Node 22.16, 22.23 and 24.11, with read-only boolean-only lstat/fstat diagnosis and full npm test. Linux 22.16 is control.
- scripts/p531-windows-identity-probe.mjs prints only equality booleans and Node/OS; no paths, serial/inode values or source bytes.
- Windows baseline 431/441; Linux Chrome 11/11 and Node 441/441; no production release. This diagnostic branch remains isolated pending results.

## Observed CI evidence — 2026-10-27 KST

Matrix #40520743005 (code SHA f1fb017e2842005741fd6dcdaf360ca22959d075): Windows Node22.16.0 `lstat.dev=0` while `fstat.dev!=0`, 431/441 tests pass; Windows22.23.0 `dev`/`ino` comparisons consistent, 441/441 pass; Windows24.11.0 consistent, 441/441 pass. Linux22.16 suite 441/441 pass. Matrix workflow is red because the obsolete Windows22.16 test lane intentionally fails.

Acceptance #40521393391 (code SHA efda0cb1eae1ceff65e6506e8c1c01155e4ec907): Linux Google Chrome155 **11/11 browser checks PASS**, Node Linux **441/441**; Windows hosted Node22.23 **441/441**, `WINDOWS_DEMO_PREFLIGHT_PASS`, doctor PASS. Both acceptance jobs and full workflow `completed/success`.

Decision: retain original strict dev/ino/symlink/hash checks; change CI Windows Node runner version only, not product runtime version or safety code. Declared Windows Node >=22.16 minimum is NOT actually compatible with all source-sensitive functions; product documentation/launcher support-minimum change awaits explicit user approval. A real Windows Edge GUI and 3 hardware devices remain untested.
