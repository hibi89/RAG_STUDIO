# P5.52/P5.53 — local source-cited report screen and review-only portable folder

**2026-11-12 KST · RAG Studio public feature branch · Customer approval NOT_GRANTED**

## Engineering decision

A. Merge pending CSV/mapping and unapproved document into the existing **approved** AX in-memory SQLite/document index and ship an installer. Risk: self-claimed customer ownership, missing private SMAX producer signature, silent trusted-source promotion. Unacceptable.
B. Keep strictly distinct unapproved review output, render source citations in a local-only static UI, and optionally export a source-free reviewed evidence folder with immutable manifest and no remote service/API. Extra verification UI, but clear provenance/rights boundary, zero paid APIs and less source exposure. Implemented B.

## P5.52: cited review browser UI

- Add a manually chosen `RAG_PREP_MIXED_PREVIEW_V1` JSON picker. Browser checks contract, SHA against the currently opened source proposal if present, bounded numeric/order fields, line monotonicity and explicit HOLD flags. Displays local preview total + source SHA plus TXT/MD excerpt line using **textContent**, never unsanitized HTML or requests.
- `PREVIEW_WITH_CITATIONS` is a reviewable source excerpt, not a final model answer. `POSSIBLE_CONFLICT` and `INSUFFICIENT_DOCUMENT_EVIDENCE` explicitly withhold conclusions. It cannot verify the authenticity of a forged report JSON without the original CLI/CSV; source bytes must be rechecked by P5.51 CLI.
- The `ui/prep-owner.html` static page and strict CSP remain; no live network, no read of customer source by local Node HTTP server.

## P5.53: explicitly selected review bundle (not an EXE, not approval)

```bash
node src/prep-review-bundle-cli.mjs "/absolute/source.csv" "/absolute/rag-prep-owner-draft.json" "/absolute/policy.txt" "/absolute/new-review-folder"
```

- Revalidates physical source CSV twice, the owner draft and local policy text; creates the **new** destination exclusively after source checks. Existing output path or symlink parent rejected. Bundle creation failure cleans only newly created folder.
- Copies only 3 UI assets and 3 Node standalone source files; writes unapproved sales and mixed JSON reports, Unix/Windows launchers, manifest.json. No source CSV/TXT/owner JSON is copied; no uploading. Manifest has SHA256/size for the fixed 10 allowlisted files and source CSV SHA. All files are locally reviewed, not digitally signed.
- `node src/review-bundle-verify.mjs` inside created folder must print `RAG_REVIEW_BUNDLE_INTEGRITY_PASS`. Launchers call it before exposing localhost UI; tampered reports or static assets refuse. Server serves only `/`, `/prep-owner.js`, `/prep-owner.css` with strict Host/Origin, CSP, no external requests or JSON report HTTP endpoints. Source files never run automatically from downloaded reports.
- A recipient must already have Node22; double-clicked Windows CMD cannot bypass SmartScreen or enterprise policy. This folder is a **review-only package**, not portable finished software, not an authenticated approval record. CSV mapping column headers, sales totals, SKU names and document snippets can be confidential: store/share only with permission.

## Evidence

- Linux Node22.16 exact local checked source: P5.47–P5.53 **63 PASS / 0 FAIL / 0 SKIP**, including P5.53 built-in manifest verifier and physically relocated standalone localhost server HTTP 200 static/404 report-route. P5.52 client schema/provenance/forgery tests, policy conflicts and missing evidence all fail closed.
- Chromium144 with synthetic injected DOM after actual direct localhost navigation was denied by environment `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Synthetic DOM: 5 mapped fields saved → real Node calculation of 3 orders / 6 units / 360 KRW → 3 cited CSV lines and 1 cited TXT line displayed; page JS errors 0/outbound HTTP 0. Because CSP injection is modified only in the harness, this **does not verify production file:// or localhost browser navigation**. Actual Node HTTP tests separately validate CSP response.
- GitHub prior p545/p547 workflows `failure` with zero Jobs at current earlier SHAs. Root cause not proven; no full GitHub `npm test`, both OS, Gold100, Negative20, Heldout24, real customer Windows GUI, private SMAX production handshake or release authorization. Keep RELEASE HOLD.

## Scoring and next release gate

Internal weighted engineering scope: previous 81% +2 reviewed evidence display +2 isolated repeatable review delivery and integrity = **85% provisional**. It is not a measured test pass ratio or proof of customer-ready feature coverage. Release gates: CI and Windows native acceptance, owner rights/consent, actual SMAX Native binding without private-code exposure, security/licensing/support QA and tested customer workloads. All deployment/permission/paid service changes remain blocked pending user approval.
