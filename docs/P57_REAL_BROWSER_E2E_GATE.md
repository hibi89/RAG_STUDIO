# P5.7 — Optional REAL browser E2E and native localhost contract (2026-10-27 KST)

## Purpose, implementation and decision

The previous browser validations were historical P4.2 Chrome (different source revision) or simulated UI/Node HTTP checks. P5.7 prepares an actual **Chromium/Playwright browser E2E** against the current PUBLIC synthetic RAG dashboard, without declaring a pass until the browser binary executes and interacts with the real DOM.

| Option | Cost and speed | Evidence quality and risk | Decision |
| --- | --- | --- | --- |
| A. Continue Node mock/DOM/static checks and label them browser smoke | Fast, but misleading | Cannot prove real visual DOM interactions or browser/session behavior | Rejected |
| B. Add opt-in real Playwright Chromium E2E plus independent native HTTP tests | Node-only product remains dependency-free, optional dev-only browser setup | Reproducible real DOM checklist; native HTTP pass does not pretend to be browser pass | **Selected** |

**Files**
- `scripts/p57-browser-e2e.mjs`: ESM Node runner with OPTIONAL dynamic `import('playwright')`; no Playwright dependency in runtime/package manifest and no browser auto-download. It launches Chromium headless against the existing `createDashboardServer` on a random local loopback port using only the checked-in public synthetic fixture. Isolated fresh browser contexts and `serviceWorkers:'block'` prevent reuse of an existing user profile. Aborts any asset request outside the local host origin and records only step IDs/pass/fail; reports no session URL, token, source quote or screenshot. Closes context, browser and server even on failure. Zero real files, private source, paid inference/cloud activity.
- **Seven browser checks** (will be actual tests only when Chromium starts): anonymous page has no KPI; unique fragment session loads verified 157000 KRW/6 orders/10 units, 2 documents, 6 CSV rows and a SKU chart; actual form submit and CSV/document citation highlight; unsupported question abstention; document-only search citation; invalid session; mobile viewport width and absence of external requests/browser page errors.
- `tests/p57-browser-gate.test.mjs`: five native **HTTP/source-level** tests: optional runner parses and declares true failure states, 4 static assets with restrictive CSP, real session fragment and authenticated overview, real signed-token-equivalent local query/search/abstention, missing/forged token refusal. Unlike browser E2E, these were actually executed.
- `package.json`: registers `npm run test:browser` only; **no new runtime dependency**. Browser prerequisite setup is optional on a trusted dev machine.

## Reproduce on a trusted machine with working Chromium

1. Use a trusted checkout of `develop`, with Node **>=22.16.0**. No real customer CSVs, ZIPs or Private SMAX data.
2. `npm test` for 224 native tests, and `npm run doctor` for public synthetic package contract.
3. For a real browser test, explicitly install development-only Playwright outside the project's runtime contract, e.g. `npm install --no-save --package-lock=false --no-audit playwright@1.64.1`, followed by `npx playwright install chromium` using an approved network and license/OS policy. No automatic installation is built into RAG Studio.
4. `npm run test:browser`. A true green report MUST contain `status:"PASS"`, `real_browser_executed:true`, `passed:7`, `failed:0`, process exit 0. Missing Playwright or unable to launch Chromium must explicitly exit 2 with `BROWSER_PREREQUISITE_MISSING` or `BROWSER_UNAVAILABLE`. The tool is NOT a mock.

## Actual evidence and environment limitation

- **Native actual source code tested**: public GitHub `hibi89/RAG_STUDIO` feature exact SHA **`a0b81a6cf848f82b461644175bbb3557dd2203b2`**, downloaded as a public archive to isolated ephemeral Node v22.23.4 Linux arm64 VM and deleted afterward.
- `node --test tests/*.test.mjs`: **224 PASS / 0 FAIL / 0 SKIP / 0 CANCEL**, 20 test files (219 previous + five P5.7 native tests).
- `node scripts/p5-gold-eval.mjs`: **100/100 PASS**; `node scripts/p52-negative-evidence.mjs` **20/20 PASS**; `node scripts/p53-heldout.mjs` **24/24 PASS**, all exit 0.
- `node scripts/p57-browser-e2e.mjs` on exact public archive (without optional dependency): exit **2**, `status:"BROWSER_PREREQUISITE_MISSING"`, `real_browser_executed:false`. **This is NOT a browser test pass**.
- Separate isolated browser provision probe: `npx playwright --version` reported Playwright 1.64.1. Explicit transient npm installation and Chromium headless-shell binary download completed; actual `chromium.launch` **FAILED** because the Linux runner does not provide shared library **`libglib-2.0.so.0`**. Environment and temporary browser files were cleaned; no public project's runtime or user's PC changed. The standard container Chromium also had policy restrictions preventing local navigation and was NOT used to bypass those restrictions.
- Browser physical E2E on Chromium, Edge, or Windows has **not run successfully** in this turn. No real browser 7/7 claim, no screenshots, no production/real customer accuracy/security verification.

## Risk and next unit

Current HTTP tests ensure backend session/provenance behavior; only a real Chromium runner can validate source highlight, form interaction, mobile no-overflow and actual runtime JavaScript errors. A browser PASS, if later obtained, would still be public synthetic data on one host, not Windows 3-PC or customer-ready.

Next: provision an **authorized trusted** browser host that has Playwright + Chromium system libraries; execute `npm run test:browser`, investigate real UI failures and fix only with captured evidence. Windows `.cmd`/Edge/installer/signing; Private SMAX Native current head, original RAG ZIP, PDF/DOCX/dense, approvals, customer data and release remain distinct unverified gates.

Release policy: normal feature-to-`develop` non-force FF only after comparing native-tested source SHA versus feature HEAD (docs-only drift allowed); leave `main` unchanged. Baseline `develop` at start `bb8af4e0a441797e4fc79e2b968b6da76e2d9fdc`.
