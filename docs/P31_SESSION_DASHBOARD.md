# P3.1 — local dashboard access protection & product KPI mix

Updated 2026-10-26 KST. This is a synthetic-data-only, local test slice; **not** a release, Windows-verified app or a substitute for browser QA.

## Design options considered

| Option | Runtime / cost | Maintainability | Access tradeoff | Decision |
|---|---|---|---|---|
| 127.0.0.1 and Host/Origin checks only | Simplest, no costs | Small | Untrusted local browser pages can attempt loopback queries | Rejected before real data |
| Session bearer capability, delivered only in start URL **fragment**, API header required | Node core crypto only, no network or paid provider | Small + explicit launcher lifecycle | Less accidental cross-origin access; token exposure via copied URL/local malware still possible | **Selected P3.1** |
| OS credential broker / mutual TLS / full auth system | Extra packaging/cert/admin complexity | High | Potentially stronger protections but premature for synthetic MVP | Defer pending Windows installer/security design |

## Implementation

- Per-process `crypto.randomBytes(32)` token; 43 base64url characters. Stored only in server's memory (`WeakMap`), not in HTML, manifest, cookies, logs from HTTP requests, or query parameters.
- `npm run dashboard` prints **a secret-bearing launch URL** with `/#session=...`; do not share it or paste it into bug reports. The browser fragment is not sent to the server. The UI captures it at startup, calls `history.replaceState` to remove it from the visible URL, and adds `Authorization: Bearer ...` to API calls.
- `GET /api/overview`, `POST /api/query`, `POST /api/search` require the per-run capability; missing/wrong bearer returns HTTP 401 without data. Strict Host, cross-origin POST Origin, CSP, loopback bind, payload limits and readonly fixed SQL remain in place. `/api/health` reveals only READY/loopback status and static assets contain no session token.
- A refresh after fragment removal requires reopening the start URL from the launcher: intentionally no persistent token storage or cookie. New server = new token. Host machine access or malware is not excluded by this boundary.
- KPI adds `dataset.sku_totals` from a fixed SQLite GROUP BY on the verified CSV; totals are safe integer checked and compared against the previously verified grand total. Displays `progress` bars using DOM `textContent`, never raw HTML. SKU N-02 72,000 KRW, N-01 45,000 KRW, N-03 40,000 KRW; total 157,000 KRW.

## Run/test

```bash
npm test
npm run dashboard
# Open the full session-specific URL printed in the terminal, not bare http://127.0.0.1:8765
# Ctrl+C to stop the local server
```

- Linux Node 22.16.0 `npm test`: **92 pass, 0 fail, 0 skipped** — baseline P3 80 + new P3.1 12. First attempt 91/92 due to a **test assertion spelling mismatch** (`element('progress')` vs `createElement('progress')`); fixed assertion, full regression 92/92.
- Real local HTTP check (Python urllib against running server): anonymous `/api/overview` 401 SESSION_REQUIRED, same endpoint with correct per-run bearer 200 and SKU totals above.
- Chromium browser navigation was previously denied with `ERR_BLOCKED_BY_ADMINISTRATOR`; not repeated without changed policy or authorized browser. No screen, Console, Network, responsive behavior or real Windows QA claim. Static DOM-safety inspection is not a substitute for browser execution.
- No customer data, real SMAX output or RAG archive imported. No SaaS, cloud/production URL, Vercel, payment or external service.

## Next

P3.2: runnable Windows/browser smoke in an authorized environment; error boundary, diagnostics, provenance drill-down and missing/conflict UX. Longer term: real SMAX producer contract, verified archive inspection, PDF/DOCX, wider accuracy benchmark (100 questions), 3 PC install/recovery and commercial/license QA. Keep `main` baseline intact until release gates are met.
