# P5.48 Offline PREP mapping form — 2026-11-11 KST

## Function
Use the local Node22.16+ command:
  node src/prep-mapping-form-cli.mjs /absolute/source.csv /absolute/review.html
This creates a new review-only HTML (refuses overwrite). Open it locally, supply a unique mapping key per CSV column and choose target type/required, then click "매핑 JSON 초안 저장". Revalidate browser-downloaded JSON:
  node src/prep-mapping-review-cli.mjs /absolute/source.csv /absolute/rag-prep-mapping-draft.json

Existing CSV inspector produces a header/type/hash-only review, not row content. The generated HTML embeds source SHA-256 and header metadata, never source rows or paths. Generated mapping JSON is strictly a DRAFT with explicit columns and the same source SHA. It cannot grant permission or create AX, SQLite, an index or external upload. Review CLI always yields REVIEW_HOLD/NOT_GRANTED. Header names may themselves contain sensitive business information: keep output local.

## Architecture choice
Compared (A) local HTTP web app to post source files against (B) self-contained static local HTML with user-triggered JSON draft download. (B) avoids services, sockets and cloud API costs, and preserves original source. Static markup is HTML-escaped; JavaScript is constant and CSP SHA256-hashed with connect-src none, object-src none and no external assets. The HTML output is exclusively created and original source remains unchanged. Any formatted draft still passes the canonical P5.47 parser and P5.46 mapping checks before trusted use.

## Verified scope and gaps
- Linux Node22.16 isolated P5.48 tests: 9 PASS / 0 FAIL / 0 SKIP. Historical P5.47 scoped tests: 10 PASS.
- Chromium headless: generated synthetic HTML rendered using Playwright set_content, edited three columns, downloaded JSON, and actual P5.47 CLI returned REVIEW_HOLD/NOT_GRANTED. No page errors or outgoing HTTP requests observed. Direct file:// navigation was blocked by environment ERR_BLOCKED_BY_ADMINISTRATOR; physical Windows double-click remains UNVERIFIED.
- Exact Git blob parity against tested local source: form 9cd719378b21ef1ba7f44ec8e2b18c0795c35428, CLI 6971751945f0399855ef7b5b02bb3b876eb05099, test 06813f84f6a18a5312e13f07355fb8ff44ea1bb3.
- Previous P5.47 YAML typo fixed at ad2953f5c1934e6f0b7c4ed242e460eefd27d250; Actions run #42941300286 succeeded on both Linux and Windows. This does NOT establish the P5.48 whole-suite result.
- P5.48 workflow is defined for Linux22.16 and Windows22.23 full Node tests/gold/negative/heldout/router. Verify runs independently; no CI result or sale approval inferred from workflow creation.

## Remaining release gates
Real private SMAX PREP Native signed producer + rights/consent, actual mapped CSV into cited RAG query, full P5.48 regression, native Windows customer browser/UI and self-install, customer file safety and licensing. RELEASE HOLD. This form is not a finished universal PREP engine.

Repository: hibi89/RAG_STUDIO, feature/p548-offline-mapping-form fork of P5.47 CI-green ad2953f5c1934e6f0b7c4ed242e460eefd27d250. Original develop/main/SMAX untouched; additive commits can be normally reverted.
