# P5.31 — Cross-runtime Windows identity probe (no security guard changed)

Source P5.30 base: bc01a6d005e62d94122faa71992ed5abd5d74398. Only existing public synthetic fixtures and disposable synthetic temporary file used.

## Two options
1. Run entire Windows suite under maintained newer Node runtime with existing strict checks untouched. If a newer version passes 441/441, pin a suitable minimum after verification; costs no model/API access but raises minimum Windows Node version.
2. If all versions fail, design a secure Windows-specific open-handle and path identity verifier with repeated content-digest and adversarial reparse/replacement tests. Higher complexity, explicit security change approval required. Avoid skipping device/inode, link or SHA checks.

## Evidence collection
- .github/workflows/p531-identity-matrix.yml runs real hosted Windows Node 22.16, 22.23 and 24.11, with read-only boolean-only lstat/fstat diagnosis and full npm test. Linux 22.16 is control.
- scripts/p531-windows-identity-probe.mjs prints only equality booleans and Node/OS; no paths, serial/inode values or source bytes.
- Windows baseline 431/441; Linux Chrome 11/11 and Node 441/441; no production release. This diagnostic branch remains isolated pending results.
