# P3.2 acceptance: full Node regression + real Chrome browser

Verified date: 2026-10-27 KST. Public synthetic-only RAG_STUDIO feature branch.
Tested commit: 85d46bebc455956c01b945f45c7c7437864eb81a.

## Evidence
- GitHub Actions [Linux full regression + actual Chrome browser job](https://github.com/hibi89/RAG_STUDIO/actions/runs/40458109672), job 122036060234, completed **SUCCESS**.
- Ubuntu 24.04, Node 22.16.0, standard GitHub-hosted runner. Public repo standard runners do not consume billable minutes. No secrets, external model API, package installs, uploads, or production deploy.
- `npm test`: **118 passed / 0 failed / 0 skipped**; includes new actual loopback HTTP module route/authorization cases, provenance resolution, mocked UI and all pre-existing regression tests.
- `npm run doctor`: **PREFLIGHT_OK** with checked-in synthetic fixture.
- `npm run demo:router`: **ANSWERED** with synthetic mixed-query evidence.
- `node scripts/p32-browser-smoke.mjs`: **Chrome real browser smoke PASS**; authenticated overview rendered, 157,000 KRW KPI, two document cards, six CSV source rows, query citation buttons, CSV focus/highlight, document highlight, old-selection cleanup, fragment scrub, uncredentialed overview 401. No browser security bypass.
- `node --check` for affected browser JS and server: PASS.
- The prior GitHub Actions job 40457738109 also completed SUCCESS with 118/118 tests, doctor and mixed demo; Chrome was added and verified by the later job.
- Earlier local browser attempts in a different environment were blocked by policy; this GitHub-hosted Chrome result supersedes browser-unverified for **Linux synthetic test scope only**.

## Scope and outstanding risks
1. Chrome acceptance is on Ubuntu CI, not the user's Windows machine, antivirus, packaging or varied hardware. No Windows installer or production URL exists.
2. Tests cover only synthetic approved CSV/TXT; SMAX private producer is not connected, original RAG archive not checked, no PDF/DOCX/dense search/LLM, no 100-question gold-set.
3. Documentation updates after the tested code SHA are not new application code. Before any future merge/release compare changed source files with tested SHA and rerun relevant checks if code changes.
4. Main is an intentionally separate documentation baseline; do not promote it as a production release. No customer material should be processed until broader release gates are met.
