# P3 Local Dashboard — synthetic read-only vertical slice

**2026-10-26 KST | STATUS: locally implemented / tested; browser blocked by environment; NOT a commercial release**

## Design comparison and decision
| Approach | Speed / performance | Cost | Maintenance | Decision |
|---|---|---|---|---|
| `file://` single HTML and local JSON file | simpler visual mock; browser fetch and source data access unreliable due local-file origin restrictions | zero | duplicated generated snapshots, stale data risks | rejected for interactive MVP |
| Node HTTP bound to **127.0.0.1** with fixed API and static browser UI | small locally running server, reliable same-origin queries to P2.1; fresh SHA-validated package on each request | zero, Node built-ins | server lifecycle + explicit API boundary; expandable | **chosen** |

## Components
- `src/dashboard-server.mjs`: opt-in loopback-only server; direct GET static `/, /app.js, /app.css`, `GET /api/overview`, `GET /api/health`, `POST /api/query`, `POST /api/search`.
- `src/dashboard-cli.mjs`: starts local-only dashboard at `http://127.0.0.1:8765`, accepts explicitly selected package path, optional `RAG_DASHBOARD_PORT`; Ctrl+C stops.
- `ui/index.html`, `ui/app.css`, `ui/app.js`: desktop/mobile responsive layout with four KPI cards (revenue/orders/units/approved docs), verified documents, CSV row source table, form to ask a bounded composite question or run BM25-style search; citation and refusal display.
- Server side only handles approved manifest package; source files immutable. SQLite fixed-query calculations from P1, P2 BM25 search, P2.1 answer router reused unchanged. Users cannot submit arbitrary SQL, file paths, or shell commands through UI.

## Start and test
Requires Node >=22.16, no `npm install` required:
```bash
npm test
npm run dashboard
# open http://127.0.0.1:8765 in a local browser
```
To stop: Ctrl+C. The default package is fake `fixtures/ax_multi_doc_v0`; real SMAX-produced package handling is not verified. No remote HTTP requests are made by product code and no external API keys are needed.

## Backend/HTTP verification performed
- Linux environment Node `v22.16.0` (2026-10-26 KST): `npm test` **80 pass / 0 fail / 0 skip** including previous 60 + 20 P3 tests.
- Actual server bound `127.0.0.1:18961`, `/api/overview` returned HTTP 200 by curl; browser automation tried via Python Playwright + local Chromium, but it produced `net::ERR_BLOCKED_BY_ADMINISTRATOR` upon navigation to loopback URL. This is a tool/environment/browser access restriction, **not proof of dashboard UI failure**. Treat browser rendering, JavaScript DOM activity, mobile layout and Console/Network as **UNVERIFIED** until tested in an accessible browser.
- Coverage: GET static assets and CSP, verified synthetic sales KPIs (157,000 KRW / 6 orders / 10 units), verified document metadata, original CSV row provenance, fixed SQLite+TXT question answer, document-only search, unsupported-query abstention, reject tampered package after startup, reject Host spoof / cross-origin POST / wrong Content-Type / oversize / malformed JSON / unexpected HTTP methods, source bytes unmodified and UI static restrictions. Test includes no remote URL references and prohibits unsafe HTML injection sinks in client code.

## Safety boundaries and future gaps
- Loopback binding and Host/Origin checks reduce exposure, but **local web server is not authenticated**. Before connecting real customer files, implement a per-session capability token and CSRF defense, ensure loopback access policy matches supported browsers, cap query CPU load, and perform Windows/browser security testing.
- P3 does not contain full LLM/dense RAG, PDF/DOCX, original ZIP migration, actual SMAX producer integration, real customer data, upload, application installer, persistence, Vercel, or external SaaS. `node:sqlite` is experimental in this runtime.
- `POSSIBLE_CONFLICT`, `INSUFFICIENT_EVIDENCE`, `NOT_SUPPORTED`, `NO_EVIDENCE` must be displayed as non-answer states. Retrieved quotes are untrusted content, never executable instructions or authoritative legal claims.
- No public hosting or sales are authorized. `main` intentionally unchanged. No actual SMAX or SOVIA private/public project modifications.

## Next execution priority
1. Real browser validation of rendering, mobile view, Console/Network, local-only behavior in a suitable authorized browser (Windows or an environment without `ERR_BLOCKED_BY_ADMINISTRATOR`).
2. Harden local access with session token before any customer data; expose self-diagnostics and clear browser setup instructions.
3. Verify original RAG archive and private SMAX producer contract safely when source becomes available; continue supported doc formats, dashboard charts, Windows self-install and release benchmarks.
