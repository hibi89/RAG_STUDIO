# P5.32 — Real Windows CMD + Edge/Chrome synthetic acceptance

Checkpoint: 2026-10-27 KST. Public `hibi89/RAG_STUDIO`. Feature `feature/p532-windows-cmd-edge-chrome-smoke` from develop `bfb46bcba4e978d205305082604dc66316d6a3dc`.

## Chosen plan versus alternatives
- Existing Node HTTP mocks or Linux-only browser tests do not prove the Windows CMD launcher and Windows browser compatibility. Rejected as acceptance evidence.
- Separate Windows 2025 GitHub-hosted machines for Edge and Chrome using the actual `RUN_SYNTHETIC_WINDOWS.cmd` launcher, with real browser automation and independent Node/doctor gates. Chosen for verifiable, isolated, synthetic-only results. Playwright is **CI-only** (`--no-save --package-lock=false`), not a product runtime dependency.

## Exact verified evidence
- [GitHub Actions P5.32 #40524154421](https://github.com/hibi89/RAG_STUDIO/actions/runs/40524154421): workflow `completed / success`, code SHA `ae72dbe6a56e94cd3d12e9025c4ca37f44f09d8a`.
- Windows-2025 Node.js **22.23.0** + installed **Microsoft Edge** (headless): `RAG_P532_WINDOWS_BROWSER_V1`, `actual_cmd_executed: true`, `real_browser_executed: true`, **11 PASS / 0 FAIL**; Windows `npm test` **441 PASS, 0 FAIL, 0 SKIP, 0 CANCEL**; Windows `WINDOWS_DEMO_PREFLIGHT_PASS`, doctor `PREFLIGHT_OK`.
- Separate Windows-2025 Node.js **22.23.0** + installed **Google Chrome** (headless): identical **11 PASS / 0 FAIL**, native suite **441 PASS / 0 FAIL / 0 SKIP / 0 CANCEL**, preflight/doctor PASS.
- Linux Ubuntu24.04 Node.js22.16.0 control: **441 PASS / 0 FAIL / 0 SKIP / 0 CANCEL**.
- Checks per Windows browser: CMD rejects an unexpected user source argument; actual CMD launches synthetic data only on loopback port 8765 (even with conflicting shell env); unauthenticated API returns 401; anonymous DOM hides data; authorized session renders 157000 KRW / 6 orders / 10 units and removes URL fragment; Playwright file selection shows `NEEDS_REVIEW` and candidate types without raw row disclosure; HTML-like header inert; unclosed CSV fails closed; >1MiB rejected before upload; 390px viewport works with original KPI unchanged, no external requests or browser JS errors; source fixture bytes unchanged.
- The test privately receives the ephemeral session URL from child stdout but **never writes it to logs, a browser trace, a screenshot, a file or a Git commit**. Child process tree is terminated by PID and localhost health checked for shutdown, regardless of success/failure.

## Security and compatibility boundaries
- No product runtime files, existing file identity/symlink/digest security checks, `.cmd` launcher or declared Node version changed in this unit.
- The Windows Node **22.16** lstat/fstat dev mismatch documented in P5.31 remains a verified incompatibility. Windows CI intentionally uses proven Node **22.23**. Product still declares Node >=22.16. Changing public runtime minimum, e.g. to tested Windows 22.23, needs owner approval; do not call the broad minimum fully validated on Windows.
- The automated CI uses a GitHub-hosted Windows VM and **headless browsers**. It does not validate 3 physical customer PCs, visible GUI rendering, browser profiles/extensions, Defender/SmartScreen, MSI/EXE signing, upgrade/uninstall, source rights, private SMAX producer integration, trained E5/FAISS, customer files, or paid commercial operation. Product remains not launched.
- `main` remains unchanged. `develop` integration is permitted only after exact CI SHA check, documentation-only delta check and non-force expected-SHA fast-forward. No Vercel production URL or public deployment.

## Reproduce
- Windows Node22.23: `npm ci --ignore-scripts --no-audit --no-fund`; `node scripts/windows-preflight.mjs`; CI-only `npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright@1.64.1`.
- In separate trusted Windows runner contexts: `$env:RAG_P532_BROWSER='msedge'` or `'chrome'`; `node scripts/p532-windows-cmd-browser.mjs`; `npm test`; `npm run doctor`. No real customer data.
- Linux: `npm ci --ignore-scripts --no-audit --no-fund` and `npm test`.

## Next P5.33
- Design a **portable, reversible, user-friendly Windows synthetic demonstration package** from already verified code with zero automatic downloads/admin actions; document installer/update/uninstall and offline constraints before any user-device changes. Independently establish approved Windows minimum support/version policy and physical device QA. Preserve exact source hashes, loopback-only bearer, and optional SMAX contract requirements.
