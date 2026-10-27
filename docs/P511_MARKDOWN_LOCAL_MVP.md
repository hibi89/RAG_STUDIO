# P5.11 — MVP input and document extension: local AX package + Markdown

Date: 2026-10-27 KST. Public feature: `feature/p511-markdown-local-open`.

## Functional outcome and comparison
- Existing `npm run demo:zip` operates **only on the four pinned synthetic fixtures**. In contrast, `npm run open:package -- "/path/to/AX_DATA_PACKAGE_V0"` takes a user-selected **already standardized local folder** whose `manifest.json` and referenced source files must pass the established RAG `loadPackage` checks. It does **not** preprocess random XLSX/CSV/PDF files, auto-approve any producer, read remote URLs or upload local data.
- The local command requires an explicit folder. No silent default/example fallback. It does not write source files, copies or a persistent index; Node builds a temporary in-memory SQLite database and serves a session-specific bearer-protected browser at 127.0.0.1:8765. Stop with Ctrl+C. Supported port override `RAG_DASHBOARD_PORT` is for tests and local development. Raw filesystem paths and exceptions are never printed on failure.
- **Approval caveat:** A user-authored manifest with `ACCEPTED` is not proof of legal source rights, human identity, or Native SMAX producer approval. The CLI is a local developer preview, not customer production-ready authorization.
- Previously document search and mixed evidence routing accepted only approved `.txt` files. They now also index **SHA-256-verified UTF-8 Markdown `.md` files**, preserving original one-based source line and literal quote, keeping Markdown markup **as data**. Existing static UI inserts via textContent; no Markdown HTML rendering, remote image/link fetching, JS execution or arbitrary SQL. Routing still abstains for unknown unsupported facts. Both old TXT evidence and new Markdown evidence are supported in the same RAG search.
- Existing SQL verification, P5.10 ZIP demo, verified CSV provenance, package schema, browser auth, and default `main` are unchanged.

## User workflow (locally, not in ChatGPT)
```bash
# Node.js >=22.16.0, no npm install needed
npm run open:package -- "/absolute/path/to/verified-local-AX_DATA_PACKAGE_V0"
# Open private localhost fragment URL printed by command
# Ask: "정비 부품 안전 점검" or "총 매출과 반품 기간, 배송 준비 기간은?"
# Ctrl+C to stop

npm run demo:zip   # unchanged pinned synthetic sample
npm test           # test the codebase
```

A real prospective user's files are not included in this public repository. Tests synthesize temporary copies of existing public fixtures, add a Markdown policy/manual and recalculate manifest SHA, then discard them. Not a full general ZIP loader or SMAX producer adapter.

## Acceptance and remaining MVP gap
- `node --check` for modified files and new test; `npm test` including Markdown search, mixed SQLite+Markdown with citations, unapproved/tampered document rejection, local CLI startup/session 401/200 and live HTTP search, original source preservation.
- Existing P3.2 Chrome smoke + gold100, negative20, heldout24, doctor in `.github/workflows/p511-verify.yml`. Exact run SHA and status must be read from Actions before claiming PASS.
- **Next MVP features**: real standardization pipeline from authorized SMAX Native producer artifacts, safe local file selection/import of unsupported file types, PDF and DOCX page/paragraph evidence, multi-document knowledge collection & conversation, buyer-friendly Windows self-install. Performance, security hardening, real native Windows PC and 7-journey P5.7 browser suite remain release gates. No Production URL or Vercel deployment.
