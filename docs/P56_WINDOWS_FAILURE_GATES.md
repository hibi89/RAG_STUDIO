# P5.6 — Windows synthetic launcher failure-path hardening (2026-10-27 KST)

## Design decision

Keep RAG_STUDIO's Windows entrypoint deterministic, without downloading/privilege elevation or accepting user files. Existing P5.5 verified Node assets, canonical synthetic data bytes and actual OS. P5.6 adds real loopback port conflict and startup failure controls.

| Candidate | Cost/complexity | Reliability and limitation | Decision |
| --- | --- | --- | --- |
| A. Automatically select another port when 8765 is busy, or start background services | Dynamic port/session behavior, more opportunities for stale access | Changes existing fixed demo semantics and may hide another local service | Rejected |
| B. Pin 8765, detect occupied loopback before launch, also treat actual bind failure as authoritative, exit without sensitive details | Zero external API/dependency, no install | Fail closed and reproducible; initial probe is a **best-effort check with a race**, not a guaranteed reservation | **Selected** |

## Changed files, behavior and guarantees

- `src/windows-readiness.mjs`: `checkWindowsDemoReadiness` validates explicit port 1–65535 (default 8765). After the existing Node version, 15-file and **three pinned SHA-256** synthetic source checks pass, opens and closes an ephemeral loopback `127.0.0.1` listening socket on the requested port. Actual occupied/permission-blocked port -> `BLOCKED_PORT_UNAVAILABLE`, with `port_available:false`. A missing/symlinked required file -> `BLOCKED_REQUIRED_FILES`; altered source/manifest -> `BLOCKED_SYNTHETIC_SOURCE`. Invalid port -> `BLOCKED_INVALID_PORT`. No file paths, raw source records, secrets, socket contents, or downloaded dependencies returned. **Only actual `process.platform === 'win32'`** permits success status; on Linux valid tests return `WINDOWS_HOST_NOT_TESTED` and exit 1.
- `RUN_SYNTHETIC_WINDOWS.cmd`: force `RAG_DASHBOARD_PORT=8765` before preflight and the existing dashboard launcher. No arbitrary file or port args allowed. Existing external environment cannot silently bypass preflight via another port.
- `src/dashboard-cli.mjs`: actual dashboard listen remains authoritative against race after preflight; on `EADDRINUSE` or `EACCES/EPERM` exit nonzero with fixed messages, never echo local paths or an unissued capability URL. Other exceptions also return a fixed message without local file contents. The dashboard server's loopback-only binding/session authentication is unchanged.
- `tests/p56-windows-failclosed.test.mjs`: 7 extra native Node tests covering a genuinely occupied loopback port, missing UI file, symlinked required asset, modified policy file with forged matching manifest hash, actual dashboard subprocess with occupied port and no session URL, invalid port input, and fixed-port Windows script contract.
- The original CSV/TXT/manifest fixtures, public API, customer import restrictions, Private SMAX, main, browser UI and existing P5.5 tests are unchanged.

## Native verification (specific source)

- Exact **public RAG_STUDIO GitHub source SHA `82f130c0d26b961f6b234e736382fbd1c0d6c38a`**, fetched as a public tarball to isolated ephemeral compute VM, **Linux arm64 / Node v22.23.4**, directory removed after checks.
- `node --test tests/*.test.mjs` — **219 PASS / 0 FAIL / 0 SKIP / 0 CANCEL**, 19 test files. Historical 212 + 7 new tests.
- `node --test tests/p56-windows-failclosed.test.mjs` — **7 PASS / 0 FAIL**, live occupied socket and real subprocess failure tested.
- `node scripts/p5-gold-eval.mjs` **100/100 PASS**; `node scripts/p52-negative-evidence.mjs` **20/20 PASS**; `node scripts/p53-heldout.mjs` **24/24 PASS**; `node src/doctor.mjs` **PREFLIGHT_OK / CONTRACT_VALIDATED**, all exit 0.
- `node scripts/windows-preflight.mjs` on **Linux** — `WINDOWS_HOST_NOT_TESTED` exit 1, `port_available:true`, as intended. This is NOT a Windows failure or Windows acceptance result.
- Initial revision `5cb2c7f21569079cd9008651d09a9b761b51fa29` failed the newly written test module to parse due to invalid regex delimiter in one diagnostic assertion: Node suite 212 PASS and 1 test-file FAIL, no product regression. The test assertion was corrected, then actual suite re-executed at SHA above and **219/219 PASS**.
- This is **NOT GitHub Actions**, real Windows CMD, Microsoft Edge/Chrome browser test, MSI/EXE installer, customer device test, data pipeline integration, or Production verification.

## Open risks and next gate

- A port check followed by a separate dashboard bind inherently has a time-of-check/time-of-use race; P5.6 does not claim it is eliminated. The actual server's `EADDRINUSE` path now safely fails without revealing session credentials.
- This check does not assert executable integrity/code-signing, actual Windows path or shell quoting behavior, antivirus compatibility, browser view, internet firewall behavior or 3-PC readiness.
- The public source package is still **synthetic-demo-only**; no arbitrary ZIP, PDF/DOCX, customer file or Private SMAX result intake approved. Current SMAX private Native producer E2E not tested.
- Further work: actual trusted Windows shell `.cmd`, Node 22.16+, loopback 8765 and Edge URL smoke on a user-controlled machine; optional independent Windows CI only with permissions and spending approval; installer/signature/uninstall/Windows 3-machine coverage prior to commercial release.
- Merge policy: compare QA SHA to feature HEAD, only docs changes allowed; guarded, non-force fast-forward into develop, keep main unchanged. Base develop at start: `ac58bcc94a91b3eef1f1d4c6ac2b6903f8ac23d7`.
