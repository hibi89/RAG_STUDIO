# P5.48 — Local owner mapping UI server (2026-11-12 KST)

## Problem and architecture
P5.47's static local `file://` editor can be blocked by browser/enterprise policies and is not a user-friendly launch path. Rather than loosening browser controls, P5.48 exposes **only three versioned static RAG assets** on an ephemeral `127.0.0.1` port with Node built-ins. No file upload, approval, CSV parser HTTP endpoint, database handler, login, Internet dependencies or installer is added.

Compared options:
- Turn off file URL policy/Chromium safety setting: rejected (security-policy modification, customer side effects).
- Loopback static-only server with host/origin and CSP restrictions: selected (no customer source ever routed through the HTTP service).

## Launch
With Node.js 22.16+ in this branch's source checkout:
```shell
npm run review:prep:owner
```
The command shows an ephemeral `http://127.0.0.1:<port>/` URL. Open it locally, provide the P5.46 proposal JSON, review draft mappings, and download unapproved JSON. Terminate with Ctrl+C.

The proposal is produced separately by `node src/prep-mapping-cli.mjs /absolute/owned-input.csv > proposal.json`. Finally `node src/prep-owner-verify-cli.mjs /absolute/owned-input.csv /absolute/rag-prep-owner-draft.json` rechecks actual original CSV bytes. Avoid uploading proposal/draft JSON: header names and hashes may be confidential.

## Security and evidence
- Bind only to loopback, port 0. No service is advertised on a public interface.
- Strict method GET/HEAD and exact paths `/`, `/prep-owner.js`, `/prep-owner.css`. All other URLs refuse with 404; POST/PUT upload refused.
- Reject arbitrary Host and mismatching Origin. `CSP: connect-src 'none'`, same-origin resource policy, no-referrer/no-store/nosniff, deny framing, no CORS grant.
- Code/data files are immutable and served from RAG repository only; browser file input remains entirely client-side, no HTTP endpoints accept file bytes.
- Linux Node22.16 isolated **19/19 PASS** combining P5.47 (14) + P5.48 (5). Includes actual local HTTP requests, bad Host/Origin/path/POST, exact assets, content-type/CSP and HEAD. Exact new source/test Git Blob SHAs match locally tested files.
- Prior Chromium144 synthetic DOM input→mapping→JSON download→real CLI passed (no outside requests), but direct `file://` was blocked by sandbox. A full browser `http://127.0.0.1` interaction and Windows Edge/Chrome remain **UNVERIFIED** in this environment; do not use a static HTTP test as a browser PASS.
- Remote GitHub Actions at previous P5.47 SHA had **0 jobs and FAILURE** before test execution; full regression and Windows CI success cannot be claimed. 85% target is not achieved.

P5.47 + P5.48 together are provisionally assessed as **70→73%** of full final RAG Studio scope: +2 for explicit reusable local owner mapping and immutable recheck, +1 for bounded customer local UI entrypoint. This is an engineering estimate, not sale/installation authorization. RELEASE HOLD remains. No private SMAX code or approval/AX/SQLite integration occurred.

Next: actual HTTP browser E2E and complete Windows/Linux regressions, then local contract-backed source-cited preview, signed customer package/Native SMAX review only with owner consent.
