# P3.2 — Offline local diagnostics (synthetic scope)

Date: 2026-10-27 KST. Branch: feature/p32-offline-diagnostics.

## Decision
Two options were compared:
- Server diagnostics endpoint: convenient in a browser, but increases network/API disclosure surface and makes local health dependent on a started session. Low direct cost; higher access-control and maintenance complexity.
- Standalone CLI preflight: no listener, no remote API or dependencies, runs before the UI. Low cost/complexity, easier fail-closed behavior. Selected for the synthetic MVP.

## Implementation and limits
Run npm run doctor from the repo root, or node src/doctor.mjs <local_package_dir> (only with data the operator is authorized to inspect). The default is checked-in synthetic multi-document fixture. Preflight tests Node >=22.16.0 and delegates integrity/manifest checks to existing src/validate.mjs. It outputs platform/architecture, approximate total RAM, manifest counts and review counts. Error output uses fixed error codes, not raw local path/source content/exception text. It changes no files and performs no network calls. Exits 1 if blocked, otherwise 0.

PREFLIGHT_OK is not an installation pass: this checks only Node version and package data contract. It does not test dashboard HTTP/DOM behavior, local model/RAM sufficiency, PDF, Windows packaging/AV, full original RAG ZIP or SMAX producer compatibility. It must never be sold as proof of a ready customer release.

## Test evidence and restrictions
2026-10-27 local Linux Node 22.16.0: node --test tests/doctor.test.mjs — 11 passed / 0 failed / 0 skipped; exact Git blobs of this new module and test matched the test artifacts (327d0d4..., 60044501...). Fixture integration CLI and entire repository npm test NOT RUN in this session because direct GitHub clone/download DNS resolution was blocked; historical develop P3.1 npm test recorded 92 PASS on 2026-10-26 and is not reconfirmed. No Windows/browser/production test.

## Next
After remote change parity and normal fast-forward integration into develop (not main), run full npm test and real default fixture CLI in an authorized clone. Continue separate provenance drill-down and error UX; browser test only where authorized. Do not touch private SMAX or SOVIA.
