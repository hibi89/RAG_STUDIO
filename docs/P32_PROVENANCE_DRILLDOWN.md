# P3.2 — Local citation drill-down and safe error UX

Date: 2026-10-27 KST. Status: feature implementation + isolated tests; not production-ready.

## Options and selection
- Option A: separate source-file HTTP endpoint with row/line lookup. More data exposure surface, new authorization paths, additional maintenance and tests.
- Option B: link evidence already returned by the authenticated dashboard to the existing validated overview. Zero new data API, no raw file access, dependency-free client module. **Selected**.

## Behavior
- `ui/provenance.js` resolves cited CSV items against the verified overview by file ID, 1-based source line, order ID, and exact amount. It rejects missing/mismatched references.
- A document citation resolves only if its file ID + document ID match an approved overview document, with a positive safe integer line number and bounded nonempty quote. That quote originated from an existing authenticated, independently validated query/search response. The UI does not read arbitrary user-selected files.
- Client creates text nodes and safe `button` elements, highlights the existing source row/document card, and displays a citation detail. No `innerHTML` sinks, arbitrary URL navigation, or new network/paid dependencies.
- Maps selected server error codes to Korean corrective guidance without showing raw exception text or local paths.
- `src/dashboard-server.mjs` statically serves only a new allowlisted `/provenance.js` module; data APIs, token handling and host/origin gates unchanged.

## Exact checks performed
- Local Node 22.16.0: `node --test tests/provenance.test.mjs` **10 PASS / 0 FAIL / 0 SKIP** on isolated mirrored new module/test files.
- Local `node --check ui/app.js`, `node --check ui/provenance.js`, `node --check tests/provenance.test.mjs` passed. Remote Git blobs for `ui/provenance.js`, `tests/provenance.test.mjs` and `ui/app.js` matched the exact locally checked bytes.
- Full repository `npm test`, true dashboard HTTP smoke, user Windows install and browser behavior **NOT VERIFIED** this session: runtime cannot resolve github.com for clone/checkout.
- One attempt to navigate a local browser test page with headless Chromium was denied with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. This is an environment access restriction, not a proven app defect; no policy bypass or further probes.
- Earlier develop P3.1 92 PASS and P3.2 doctor 11 PASS are **historical separate batches**, not proof that a combined 113-test suite passed.
- No customer data, private SMAX code, model API or real RAG archive used. No production/Vercel deployment, original data modifications, account changes, paid Actions usage or secrets.

## Acceptance still pending
1. An authorized local checkout on Node >=22.16: full `npm test`, `npm run doctor`, dashboard CLI and HTTP smoke with actual fixture.
2. Live Chromium/Windows browser interaction: correct authenticated module load and click from query evidence to CSV row/doc card, keyboard focus, CSP/Console/Network errors, error UX, screen layout.
3. Full integration test for edited dashboard static route and UI selectors. Do not merge feature into develop or main solely from isolated tests without clear verification/risk decision.
4. Separate product gates: SMAX producer contract, original ZIP/license, PDF/Word, dense retrieval, installer, 100-question accuracy and 3 Windows installations.
