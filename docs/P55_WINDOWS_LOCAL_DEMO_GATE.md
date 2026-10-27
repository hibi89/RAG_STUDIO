# P5.5 — Windows synthetic local demo preflight (2026-10-27 KST)

## Scope and choice

Purpose: make the existing **public synthetic dashboard** easier to start locally on a Windows development PC without treating source/demo as a packaged customer installer.

| Approach | Performance/cost | Maintainability and safety | Decision |
| --- | --- | --- | --- |
| A. Electron/EXE, auto-download Node, install dependencies | Much wider surface, install/sign/distribution cost, unverified Windows behaviors | Premature and risky with no Windows physical acceptance | Rejected |
| B. Node-built-in read-only preflight + small explicit .cmd launcher | Zero paid dependencies and no admin requirement; fast local check | Clear fail-closed criteria, static host gate and repeatable regression tests | **Selected** |

This is NOT a Windows installer, system compatibility certification, actual browser E2E pass, commercial release, ZIP import, or approval to process real customer data.

## Artifacts

1. `RUN_SYNTHETIC_WINDOWS.cmd` — optional demonstration launcher. Accepts **no command-line inputs**, switches to its own directory, uses already installed `node`, runs preflight, then invokes the existing `src/dashboard-cli.mjs` using only `fixtures/ax_multi_doc_v0`. Never installs Node, downloads modules, elevates privileges or opens arbitrary input paths. The existing dashboard binds exclusively to `127.0.0.1` and prints an ephemeral session-fragment URL; do not share the URL.
2. `src/windows-readiness.mjs` — read-only check: Node **>=22.16.0**, expected 15 repository/demo files must be regular non-symlink and nonempty, expected `AX_DATA_PACKAGE_V0` accepted source 3 files/1 dataset/2 documents must validate, canonical `synthetic-shop-001` manifest and **three fixed SHA-256 file digests** must match repository synthetic golden source. A locally rewritten manifest+CSV must NOT masquerade as canonical fixture. Readiness output only statuses/counts/platform; no paths, source records or credentials. Actual platform read from `process.platform`, **not** caller-controlled simulated `platform`.
3. `scripts/windows-preflight.mjs`, `npm run preflight:windows` — report `rag.windows-demo-preflight.v1`; exits 0 **only** when actually running on Windows with prerequisites met. On Linux/macOS it reports `WINDOWS_HOST_NOT_TESTED` and exits 1; this is intentional, not a skipped physical Windows QA gate.
4. `tests/p55-windows-readiness.test.mjs` — seven tests: synthetic canonical+flags, old Node hard stop, bad/missing directory, forged manifest+source rejection, launcher no-install/no-user-arguments static contract, real host discrimination, live loopback HTTP health plus unauthenticated/forged-Host denial. The forged Host test must use Node raw `http.request`, not `fetch`, which can override restricted Host headers.

## Developer usage — **synthetic only**

- Install Node.js >=22.16.0 separately through trusted methods. **No download, install or administrative privileges are performed by this repository**.
- Use your own trusted local checkout of `develop` **only for synthetic demo**. Do not use customer data, unsupported/modified manifests or preapproved ZIPs.
- Windows CMD: double-click `RUN_SYNTHETIC_WINDOWS.cmd` or run it from a terminal. It verifies the demo fixture and starts the loopback-only dashboard. Use the displayed unique URL locally; press Ctrl+C to stop.
- Inspect preflight independently: `node scripts/windows-preflight.mjs`. On non-Windows hosts, a nonzero exit is expected and **does not** prove Windows compatibility.
- From repository: `npm test` and existing `npm run doctor` for synthetic Node suite. Package bundling, Microsoft Defender/SmartScreen testing, Browser Chrome/Edge on real Windows, hardware comparison, service auto-start, uninstall path, update strategy, signature/certificate, installer, end-user operation and actual data access are **not included**.

## Actual validation evidence and correction

- The first Native Node test on feature source `d37e2c5f5fd52aa660bc8023d7f39d79222a433c` found **211/212 PASS, 1 FAIL**. The new test attempted to spoof the Host header with `fetch`; Node's Fetch API did not send that restricted Host override, so the valid default host got HTTP 200 rather than 403. This was a **test harness** defect; application server Host validation was **not bypassed**.
- Switched only the new test to raw `node:http` request with `Host: invalid.example`, and ran the entire suite again.
- **Exact tested public feature SHA `619631d4d4782ed39b25d302a00578aa39722cb9`** downloaded as a PUBLIC GitHub tarball to an isolated temporary compute VM running **Linux arm64, Node v22.23.4**:
  - Native `node --test tests/*.test.mjs`: **212 PASS/0 FAIL/0 SKIP/0 CANCEL**, 18 test files (205 existing +7 new).
  - P5.5 seven focused tests: **7 PASS/0 FAIL**.
  - `node scripts/windows-preflight.mjs`: exit **1**, status `WINDOWS_HOST_NOT_TESTED`, 15 required files present. This is a positive test that physical Windows success is **not fabricated**, not a Windows failure.
  - Existing P5.1 golden test: 100 PASS; P5.2 negative 20 PASS; P5.3 separate synthetic heldout 24 PASS; `node src/doctor.mjs`: PREFLIGHT_OK / CONTRACT_VALIDATED, all exit 0.
  - Real HTTP loopback listener served health on `127.0.0.1`, refused unauthenticated overview and raw forged Host. Temporary public checkout removed. No external customer data or private files.
- The full Windows CMD execution, real Edge/Chrome UI and 3-PC validation have **NOT BEEN EXECUTED**. Historical P4.2 Chrome synthetic evidence is not today's Windows evidence. No GitHub Actions was executed, no Vercel/Cloudflare production.

## Risk, rollback and next gate

- This preflight checks named demo assets and pinned data bytes, **not a signed software distribution or complete integrity of source code**. Windows launcher itself is not a hardened MSI/EXE; users must obtain code from a trusted source. A fixture being schema-valid is not human authorization or customer data approval.
- Existing `src/dashboard-cli.mjs` supports a directory argument, but the new Windows batch wrapper intentionally takes **none** and is restricted to the canonical fixture.
- Before integrating into develop: compare the last tested code SHA with feature HEAD; only documentation changes may follow. Use non-force guarded fast-forward. Preserve `main` unchanged.
- Future: real Windows Node preflight on trusted device, double-click/terminal launcher and Edge access/smoke, loopback firewall checks, multi-PC machine sizes, opt-in distribution sign/install/undo work. Separately continue approved private-only Native SMAX producer verification. Do not auto-download any model or import real customer data.
