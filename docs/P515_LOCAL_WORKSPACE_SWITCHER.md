# P5.15 — Explicit local AX project selector (working MVP)

Date: 2026-10-27 KST. Source: Public `hibi89/RAG_STUDIO`, feature `feature/p515-local-workspace-switcher`.

## Working user flow

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run workspace -- "/my/verified/AX-package-1" "/my/verified/AX-package-2"
```

Start with **one to eight explicitly provided** local directories. Each must already be a structurally valid `AX_DATA_PACKAGE_V0` folder: all referenced file bytes and SHA-256 checks must match the manifest, files marked `ACCEPTED`, dataset columns marked `APPROVED` and at least one document available. The RAG read-only SQLite sales computation must succeed before the browser listener starts. These manifest marks are still user-authored claims, **not an independent Native SMAX producer signature, consent or rights certification**.

A private localhost session URL appears in the terminal. Open it and use **로컬 프로젝트 선택** to select one of the allowlisted projects; click **선택한 프로젝트 열기**. The chosen project then drives existing SQLite KPIs, fixed routed questions, document search and source citations. The prior answer and provenance focus are reset on switching. Other source file and project folders are never scanned by the server or selectable from the browser. No arbitrary directory browser path input is accepted in HTTP.

## Implementation and limitations

- `src/dashboard-server.mjs` accepts optional `projectRoots` only at launch; `packageRoot` must be their first exact real path. Each root is validated at startup and before switching. Duplicate/unknown roots are denied. Existing single-project server API remains supported.
- `GET /api/projects` requires the per-run bearer token. It lists **opaque 128-bit random session keys**, manifest project IDs, document counts and schema versions **without absolute paths**. `POST /api/projects/select` accepts exactly `{"project_key":"<32 lowercase hex>"}`, max 256 input bytes, same bearer/Origin/Host checks. Unknown keys return 404, file mutation or rejected target returns 422. On failed switch the previous selected project stays active.
- `ui/index.html` / `ui/app.js` / `ui/app.css`: a new compact project dropdown and open control. After a successful switch it renders the newly verified overview, discards old answers, clears query and citation focus. Failed selection does not change current dashboard. If the project list itself fails to load, the verified original overview stays visible and marked healthy.
- New `src/workspace-cli.mjs` and `npm run workspace`. The local server is strictly bound to 127.0.0.1. Source directories are accessed read-only; no persistent indexes or new copies created by switching. Browser requests carry only ephemeral session keys; original local paths are never printed to clients.
- No SMAX V1 `NOT_GRANTED` data may be promoted into an AX package by the selector; only already standardized manifest-based projects can be selected. This is a developer-preview source contract, not a human approval process or commercial customer release.

## Verified evidence and next work

New `tests/p515-project-workspace.test.mjs` independently mutates a copied **synthetic** package's sales data and manifest, then validates actual two-project localhost switching from **KRW 157,000 to 158,000** and changed SQLite/QA evidence. It tests session 401, Origin 403, unknown path, invalid JSON/size, duplicate roots, switched-source mutation, CLI subprocess and original fixture preservation. `tests/p515-project-ui.test.mjs` imports the real browser JS module with synthetic DOM/HTTP to check actual rendering, switch, preservation on failure and selector-discovery isolation. `scripts/p515-browser-smoke.mjs` performs actual ChromeDriver synthetic dashboard selection.

GitHub Actions code SHA and counts: see `STATUS.md` or the latest P5.15 scoped run. Existing prior P5.14 JSON+CSV picker, PDF/DOCX read-only preview, Markdown/TXT search and SQLite citations must remain green.

**Still missing:** authentic Private SMAX Native producer → signed/consented AX package flow, arbitrary customer source ingestion, Windows Edge/physical 3-PC test, complete P5.7 seven-journey browser suite, installer, local/optional dense-hybrid RAG and conversation, production release. No real customer data processed, no Private SMAX code copied or modified. Final commercial security and compatibility checks remain.
